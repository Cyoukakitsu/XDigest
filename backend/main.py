import json
import os
from pathlib import Path
from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from apscheduler.schedulers.asyncio import AsyncIOScheduler

load_dotenv()

import twikit_patches  # noqa: F401 — must be imported before twikit is used
import scraper
import ai
import emailer
import logging


@asynccontextmanager
async def lifespan(app: FastAPI):
    scheduler = AsyncIOScheduler(timezone="Asia/Shanghai")
    scheduler.add_job(run_daily_digest, "cron", hour=8, minute=30)
    scheduler.start()
    logging.info("Daily digest scheduler started (08:30 Asia/Shanghai)")
    yield
    scheduler.shutdown()


app = FastAPI(lifespan=lifespan)

_origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:5173,http://localhost:3000")
app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins.split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)

DATA_DIR = Path(os.getenv("DATA_DIR", str(Path(__file__).parent)))
USERS_PATH = DATA_DIR / "users.json"


def _load_users() -> list[dict]:
    if not USERS_PATH.exists():
        return []
    users = json.loads(USERS_PATH.read_text(encoding="utf-8"))
    for u in users:
        u.setdefault("digest", True)
    return users


def _save_users(users: list[dict]) -> None:
    USERS_PATH.write_text(
        json.dumps(users, ensure_ascii=False, indent=2), encoding="utf-8"
    )


class LoginRequest(BaseModel):
    auth_info_1: str
    password: str
    auth_info_2: str | None = None


class AddUserRequest(BaseModel):
    username: str
    note: str = ""


class ChatRequest(BaseModel):
    messages: list[dict]
    tweets: list[dict]
    days: int = 1


class PatchUserRequest(BaseModel):
    digest: bool | None = None
    note: str | None = None


@app.get("/api/users")
def get_users():
    return _load_users()


@app.post("/api/users")
def add_user(req: AddUserRequest):
    users = _load_users()
    if any(u["username"] == req.username for u in users):
        raise HTTPException(status_code=400, detail="User already exists")
    users.append({"username": req.username, "note": req.note})
    _save_users(users)
    return {"ok": True}


@app.delete("/api/users/{username}")
def delete_user(username: str):
    users = _load_users()
    _save_users([u for u in users if u["username"] != username])
    return {"ok": True}


@app.patch("/api/users/{username}")
def patch_user(username: str, req: PatchUserRequest):
    users = _load_users()
    for user in users:
        if user["username"] == username:
            if req.digest is not None:
                user["digest"] = req.digest
            if req.note is not None:
                user["note"] = req.note
            _save_users(users)
            return {"ok": True}
    raise HTTPException(status_code=404, detail="User not found")


@app.get("/api/login/status")
def login_status():
    return {"logged_in": scraper.COOKIES_PATH.exists()}


@app.post("/api/login")
async def do_login(req: LoginRequest):
    if scraper.COOKIES_PATH.exists():
        return {"ok": True, "already_logged_in": True}
    try:
        await scraper.login(req.auth_info_1, req.password, req.auth_info_2)
        return {"ok": True}
    except Exception as e:
        raise HTTPException(status_code=401, detail=str(e))


def _period_label(days: int) -> str:
    return {1: "今日", 7: "本周", 30: "本月"}.get(days, f"近{days}天")


@app.post("/api/fetch/{username}")
async def fetch_user(username: str, days: int = Query(1, ge=1, le=30)):
    if not scraper.COOKIES_PATH.exists():
        raise HTTPException(status_code=401, detail="Not logged in to X")
    try:
        tweets = await scraper.fetch_tweets(username, days=days)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        msg = str(e)
        if "429" in msg or "rate" in msg.lower():
            raise HTTPException(status_code=429, detail="Rate limited, please try later")
        raise HTTPException(status_code=500, detail=msg)

    if not tweets:
        return {"tweets": [], "summary": f"该用户{_period_label(days)}暂无发言"}

    summary = await ai.summarize(tweets, days=days)
    return {"tweets": tweets, "summary": summary}


@app.post("/api/chat")
async def chat(req: ChatRequest):
    async def generate():
        async for chunk in ai.chat_stream(req.messages, req.tweets, days=req.days):
            yield f"data: {json.dumps({'content': chunk}, ensure_ascii=False)}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream")


async def run_daily_digest() -> None:
    users = [u for u in _load_users() if u.get("digest", True)]
    if not users:
        return

    if not scraper.COOKIES_PATH.exists():
        logging.warning("Daily digest skipped: not logged in to X")
        return

    sections = []
    for user in users:
        try:
            tweets = await scraper.fetch_tweets(user["username"], days=1)
            summary = await ai.summarize(tweets, days=1) if tweets else None
            sections.append({
                "username": user["username"],
                "summary": summary,
                "tweet_count": len(tweets),
            })
        except Exception as e:
            logging.error("Digest: failed to fetch %s: %s", user["username"], e)

    if sections:
        emailer.send_digest(sections)
