# XDigest Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a personal web tool that fetches today's posts from tracked X users, generates an AI summary via OpenRouter, and supports follow-up chat about that content.

**Architecture:** FastAPI backend handles Twikit scraping and OpenRouter AI calls; React + Vite frontend provides a two-panel layout (sidebar user list + main summary/chat area). All state is in-memory per session; users list persists in `users.json`; X session cookies persist in `cookies.json`.

**Tech Stack:** Python 3.11+, FastAPI, Twikit, httpx, python-dotenv, pytest, pytest-asyncio; React 18, Vite, Tailwind CSS, Zustand.

---

## File Map

```
XDigest/
├── backend/
│   ├── main.py           # FastAPI app: routes, CORS, error handling
│   ├── scraper.py        # Twikit login + tweet fetching
│   ├── ai.py             # OpenRouter summarize + chat stream
│   ├── users.json        # Tracked user list (auto-created)
│   ├── cookies.json      # X session (gitignored)
│   ├── .env              # OPENROUTER_API_KEY (gitignored)
│   ├── requirements.txt
│   └── tests/
│       ├── conftest.py   # Mock scraper + ai modules
│       ├── test_users.py # User CRUD routes
│       └── test_ai.py    # AI module with mocked httpx
├── frontend/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── store.js
│   │   └── components/
│   │       ├── Sidebar.jsx
│   │       ├── LoginModal.jsx
│   │       ├── Summary.jsx
│   │       └── ChatBox.jsx
│   ├── index.html
│   ├── vite.config.js
│   ├── tailwind.config.js
│   └── package.json
├── .gitignore
└── docs/
```

---

## Task 1: Project Scaffolding

**Files:**
- Create: `.gitignore`
- Create: `backend/requirements.txt`
- Create: `backend/.env.example`
- Create: `backend/users.json`

- [ ] **Step 1: Create .gitignore**

```
backend/cookies.json
backend/.env
backend/__pycache__/
backend/.pytest_cache/
frontend/node_modules/
frontend/dist/
.DS_Store
```

Save to `XDigest/.gitignore`.

- [ ] **Step 2: Create requirements.txt**

```
fastapi>=0.115.0
uvicorn>=0.30.0
twikit>=2.0.0
httpx>=0.27.0
python-dotenv>=1.0.0
pytest>=8.0.0
pytest-asyncio>=0.24.0
```

Save to `backend/requirements.txt`.

- [ ] **Step 3: Create .env.example**

```
OPENROUTER_API_KEY=your_openrouter_key_here
OPENROUTER_MODEL=meta-llama/llama-3.1-8b-instruct:free
```

Save to `backend/.env.example`.

- [ ] **Step 4: Create initial users.json**

```json
[]
```

Save to `backend/users.json`.

- [ ] **Step 5: Install backend dependencies**

```bash
cd backend && python -m venv venv && source venv/bin/activate && pip install -r requirements.txt
```

Expected: packages install without error.

- [ ] **Step 6: Commit**

```bash
git add .gitignore backend/requirements.txt backend/.env.example backend/users.json
git commit -m "chore: project scaffolding and dependencies"
```

---

## Task 2: Backend — AI Module

**Files:**
- Create: `backend/ai.py`
- Create: `backend/tests/test_ai.py`

- [ ] **Step 1: Write failing tests**

Create `backend/tests/__init__.py` (empty), then create `backend/tests/test_ai.py`:

```python
import pytest
import json
from unittest.mock import AsyncMock, MagicMock, patch

SAMPLE_TWEETS = [
    {"id": "1", "text": "Hello world", "created_at": "Mon Jan 01 00:00:00 +0000 2024", "is_retweet": False},
    {"id": "2", "text": "Another post", "created_at": "Mon Jan 01 01:00:00 +0000 2024", "is_retweet": False},
]

@pytest.mark.asyncio
async def test_summarize_returns_string():
    mock_response = MagicMock()
    mock_response.raise_for_status = MagicMock()
    mock_response.json.return_value = {
        "choices": [{"message": {"content": "这是摘要内容"}}]
    }

    mock_client = AsyncMock()
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=None)
    mock_client.post = AsyncMock(return_value=mock_response)

    with patch("ai.httpx.AsyncClient", return_value=mock_client):
        with patch.dict("os.environ", {"OPENROUTER_API_KEY": "test-key"}):
            from ai import summarize
            result = await summarize(SAMPLE_TWEETS)
            assert isinstance(result, str)
            assert "摘要" in result

@pytest.mark.asyncio
async def test_summarize_raises_without_api_key():
    import os
    os.environ.pop("OPENROUTER_API_KEY", None)
    with patch.dict("os.environ", {}, clear=True):
        from ai import summarize
        with pytest.raises(ValueError, match="OPENROUTER_API_KEY"):
            await summarize(SAMPLE_TWEETS)

@pytest.mark.asyncio
async def test_chat_stream_yields_content():
    lines = [
        b'data: {"choices":[{"delta":{"content":"你好"}}]}\n',
        b'data: {"choices":[{"delta":{"content":"世界"}}]}\n',
        b'data: [DONE]\n',
    ]

    async def mock_aiter_lines():
        for line in [l.decode().strip() for l in lines]:
            yield line

    mock_response = MagicMock()
    mock_response.raise_for_status = MagicMock()
    mock_response.aiter_lines = mock_aiter_lines

    mock_stream_ctx = AsyncMock()
    mock_stream_ctx.__aenter__ = AsyncMock(return_value=mock_response)
    mock_stream_ctx.__aexit__ = AsyncMock(return_value=None)

    mock_client = MagicMock()
    mock_client.stream = MagicMock(return_value=mock_stream_ctx)
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=None)

    with patch("ai.httpx.AsyncClient", return_value=mock_client):
        with patch.dict("os.environ", {"OPENROUTER_API_KEY": "test-key"}):
            from ai import chat_stream
            chunks = []
            async for chunk in chat_stream([{"role": "user", "content": "hi"}], SAMPLE_TWEETS):
                chunks.append(chunk)
            assert chunks == ["你好", "世界"]
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd backend && source venv/bin/activate && python -m pytest tests/test_ai.py -v
```

Expected: `ModuleNotFoundError: No module named 'ai'`

- [ ] **Step 3: Create backend/ai.py**

```python
import httpx
import json
import os
from typing import AsyncGenerator

OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions"


def _get_headers() -> dict:
    api_key = os.getenv("OPENROUTER_API_KEY")
    if not api_key:
        raise ValueError("OPENROUTER_API_KEY not set")
    return {
        "Authorization": f"Bearer {api_key}",
        "HTTP-Referer": "http://localhost:5173",
        "X-Title": "XDigest",
        "Content-Type": "application/json",
    }


def _model() -> str:
    return os.getenv("OPENROUTER_MODEL", "meta-llama/llama-3.1-8b-instruct:free")


def _format_tweets(tweets: list[dict]) -> str:
    lines = []
    for t in tweets:
        prefix = "(转发) " if t.get("is_retweet") else ""
        lines.append(f"[{t['created_at']}] {prefix}{t['text']}")
    return "\n\n".join(lines)


async def summarize(tweets: list[dict]) -> str:
    tweets_text = _format_tweets(tweets)
    messages = [
        {
            "role": "user",
            "content": (
                "请对以下 X 用户今日发言进行结构化总结，包含：\n"
                "1. 主要话题（3-5个要点）\n"
                "2. 关键观点\n"
                "3. 值得关注的内容\n\n"
                f"发言内容：\n{tweets_text}\n\n请用中文回答。"
            ),
        }
    ]
    async with httpx.AsyncClient(timeout=60) as client:
        response = await client.post(
            OPENROUTER_API_URL,
            headers=_get_headers(),
            json={"model": _model(), "messages": messages},
        )
        response.raise_for_status()
        return response.json()["choices"][0]["message"]["content"]


async def chat_stream(
    messages: list[dict], tweets: list[dict]
) -> AsyncGenerator[str, None]:
    system_prompt = (
        "你是一个帮助分析 X（推特）用户发言的助手。\n\n"
        f"以下是该用户今日的所有发言：\n\n{_format_tweets(tweets)}\n\n"
        "请基于以上内容回答用户的问题，用中文回答。"
    )
    full_messages = [{"role": "system", "content": system_prompt}] + messages
    async with httpx.AsyncClient(timeout=60) as client:
        async with client.stream(
            "POST",
            OPENROUTER_API_URL,
            headers=_get_headers(),
            json={"model": _model(), "messages": full_messages, "stream": True},
        ) as response:
            response.raise_for_status()
            async for line in response.aiter_lines():
                if not line.startswith("data: "):
                    continue
                data_str = line[6:]
                if data_str == "[DONE]":
                    break
                try:
                    data = json.loads(data_str)
                    content = data["choices"][0]["delta"].get("content", "")
                    if content:
                        yield content
                except (json.JSONDecodeError, KeyError):
                    continue
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd backend && source venv/bin/activate && python -m pytest tests/test_ai.py -v
```

Expected: all 3 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/ai.py backend/tests/
git commit -m "feat: add OpenRouter AI module with summarize and streaming chat"
```

---

## Task 3: Backend — Scraper Module

**Files:**
- Create: `backend/scraper.py`

> Note: Twikit makes real HTTP calls to X; we do not unit-test it. This task only creates the module.

- [ ] **Step 1: Create backend/scraper.py**

```python
import json
from datetime import datetime, timedelta, timezone
from pathlib import Path

from twikit import Client

COOKIES_PATH = Path(__file__).parent / "cookies.json"


async def login(auth_info_1: str, password: str, auth_info_2: str | None = None) -> None:
    client = Client("en-US")
    kwargs: dict = {"auth_info_1": auth_info_1, "password": password}
    if auth_info_2:
        kwargs["auth_info_2"] = auth_info_2
    await client.login(**kwargs)
    client.save_cookies(str(COOKIES_PATH))


def _load_client() -> Client:
    client = Client("en-US")
    client.load_cookies(str(COOKIES_PATH))
    return client


async def fetch_today_tweets(username: str) -> list[dict]:
    client = _load_client()
    user = await client.get_user_by_screen_name(username)
    if user is None:
        raise ValueError(f"User '{username}' not found")

    cutoff = datetime.now(timezone.utc) - timedelta(hours=24)
    tweets = []

    result = await client.get_user_tweets(user.id, "Tweets", count=50)
    for tweet in result:
        created_at_str = tweet.created_at
        tweet_time = datetime.strptime(created_at_str, "%a %b %d %H:%M:%S %z %Y")
        if tweet_time < cutoff:
            break
        tweets.append(
            {
                "id": tweet.id,
                "text": tweet.text,
                "created_at": created_at_str,
                "is_retweet": tweet.retweeted_tweet is not None,
            }
        )

    return tweets
```

- [ ] **Step 2: Verify import works**

```bash
cd backend && source venv/bin/activate && python -c "from scraper import login, fetch_today_tweets, COOKIES_PATH; print('OK')"
```

Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add backend/scraper.py
git commit -m "feat: add Twikit scraper module"
```

---

## Task 4: Backend — FastAPI App & Routes

**Files:**
- Create: `backend/main.py`
- Create: `backend/tests/conftest.py`
- Create: `backend/tests/test_users.py`

- [ ] **Step 1: Create conftest.py to mock dependencies**

```python
# backend/tests/conftest.py
import sys
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock

mock_scraper = MagicMock()
mock_scraper.login = AsyncMock(return_value=None)
mock_scraper.fetch_today_tweets = AsyncMock(return_value=[])
mock_scraper.COOKIES_PATH = Path("/tmp/xdigest_test_cookies.json")

mock_ai = MagicMock()
mock_ai.summarize = AsyncMock(return_value="测试摘要")

async def _mock_stream(messages, tweets):
    yield "你好"
    yield "世界"

mock_ai.chat_stream = _mock_stream

sys.modules["scraper"] = mock_scraper
sys.modules["ai"] = mock_ai
```

- [ ] **Step 2: Write failing user route tests**

Create `backend/tests/test_users.py`:

```python
import json
import pytest
from pathlib import Path
from fastapi.testclient import TestClient


@pytest.fixture()
def client(tmp_path, monkeypatch):
    import main
    monkeypatch.setattr(main, "USERS_PATH", tmp_path / "users.json")
    from fastapi.testclient import TestClient
    return TestClient(main.app)


def test_get_users_returns_empty_list(client):
    response = client.get("/api/users")
    assert response.status_code == 200
    assert response.json() == []


def test_add_user(client):
    response = client.post("/api/users", json={"username": "elonmusk"})
    assert response.status_code == 200
    assert response.json() == {"ok": True}


def test_add_duplicate_user_returns_400(client):
    client.post("/api/users", json={"username": "elonmusk"})
    response = client.post("/api/users", json={"username": "elonmusk"})
    assert response.status_code == 400


def test_delete_user(client):
    client.post("/api/users", json={"username": "elonmusk"})
    response = client.delete("/api/users/elonmusk")
    assert response.status_code == 200
    users = client.get("/api/users").json()
    assert users == []


def test_get_users_returns_added_users(client):
    client.post("/api/users", json={"username": "sama", "note": "OpenAI CEO"})
    users = client.get("/api/users").json()
    assert len(users) == 1
    assert users[0]["username"] == "sama"
    assert users[0]["note"] == "OpenAI CEO"
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
cd backend && source venv/bin/activate && python -m pytest tests/test_users.py -v
```

Expected: `ModuleNotFoundError: No module named 'main'`

- [ ] **Step 4: Create backend/main.py**

```python
import json
import os
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

load_dotenv()

import scraper
import ai

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

USERS_PATH = Path(__file__).parent / "users.json"


def _load_users() -> list[dict]:
    if not USERS_PATH.exists():
        return []
    return json.loads(USERS_PATH.read_text(encoding="utf-8"))


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


@app.post("/api/login")
async def do_login(req: LoginRequest):
    if scraper.COOKIES_PATH.exists():
        return {"ok": True, "already_logged_in": True}
    try:
        await scraper.login(req.auth_info_1, req.password, req.auth_info_2)
        return {"ok": True}
    except Exception as e:
        raise HTTPException(status_code=401, detail=str(e))


@app.post("/api/fetch/{username}")
async def fetch_user(username: str):
    if not scraper.COOKIES_PATH.exists():
        raise HTTPException(status_code=401, detail="Not logged in to X")
    try:
        tweets = await scraper.fetch_today_tweets(username)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        msg = str(e)
        if "429" in msg or "rate" in msg.lower():
            raise HTTPException(status_code=429, detail="Rate limited, please try later")
        raise HTTPException(status_code=500, detail=msg)

    if not tweets:
        return {"tweets": [], "summary": "该用户今日暂无发言"}

    summary = await ai.summarize(tweets)
    return {"tweets": tweets, "summary": summary}


@app.post("/api/chat")
async def chat(req: ChatRequest):
    async def generate():
        async for chunk in ai.chat_stream(req.messages, req.tweets):
            yield f"data: {json.dumps({'content': chunk}, ensure_ascii=False)}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream")
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd backend && source venv/bin/activate && python -m pytest tests/ -v
```

Expected: all 5 user tests + 3 AI tests PASS (8 total).

- [ ] **Step 6: Verify server starts**

```bash
cd backend && source venv/bin/activate && uvicorn main:app --reload &
sleep 2 && curl http://localhost:8000/api/users && kill %1
```

Expected: `[]`

- [ ] **Step 7: Commit**

```bash
git add backend/main.py backend/tests/conftest.py backend/tests/test_users.py
git commit -m "feat: add FastAPI app with user management, fetch, and chat routes"
```

---

## Task 5: Frontend — Vite + React + Tailwind Setup

**Files:**
- Create: `frontend/` (via npm)
- Modify: `frontend/vite.config.js`
- Create: `frontend/tailwind.config.js`
- Create: `frontend/.env`

- [ ] **Step 1: Scaffold Vite + React project**

```bash
cd /Users/zhaojiayi/Desktop/x && npm create vite@latest frontend -- --template react && cd frontend && npm install
```

Expected: `frontend/` directory created with React template.

- [ ] **Step 2: Install Tailwind and Zustand**

```bash
cd frontend && npm install -D tailwindcss postcss autoprefixer && npx tailwindcss init -p && npm install zustand
```

- [ ] **Step 3: Configure Tailwind**

Replace the content of `frontend/tailwind.config.js` with:

```js
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: { extend: {} },
  plugins: [],
}
```

- [ ] **Step 4: Add Tailwind directives to CSS**

Replace `frontend/src/index.css` with:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

- [ ] **Step 5: Create frontend .env**

Create `frontend/.env`:

```
VITE_API_URL=http://localhost:8000
```

- [ ] **Step 6: Verify dev server starts**

```bash
cd frontend && npm run dev &
sleep 3 && curl -s http://localhost:5173 | head -5 && kill %1
```

Expected: HTML output containing `<html`.

- [ ] **Step 7: Commit**

```bash
cd .. && git add frontend/ && git commit -m "chore: scaffold React + Vite + Tailwind frontend"
```

---

## Task 6: Frontend — Zustand Store

**Files:**
- Create: `frontend/src/store.js`

- [ ] **Step 1: Create store.js**

```js
// frontend/src/store.js
import { create } from 'zustand'

const useStore = create((set, get) => ({
  users: [],
  selectedUser: null,
  tweets: [],
  summary: '',
  chatHistory: [],
  isLoading: false,
  isChatLoading: false,

  setUsers: (users) => set({ users }),

  selectUser: (user) => set({
    selectedUser: user,
    tweets: [],
    summary: '',
    chatHistory: [],
  }),

  setFetchResult: (tweets, summary) => set({ tweets, summary }),

  setIsLoading: (isLoading) => set({ isLoading }),

  setIsChatLoading: (isChatLoading) => set({ isChatLoading }),

  addUserMessage: (content) =>
    set((state) => ({
      chatHistory: [
        ...state.chatHistory,
        { role: 'user', content },
        { role: 'assistant', content: '' },
      ],
    })),

  appendAssistantChunk: (chunk) =>
    set((state) => {
      const history = [...state.chatHistory]
      const last = history[history.length - 1]
      if (last && last.role === 'assistant') {
        history[history.length - 1] = { ...last, content: last.content + chunk }
      }
      return { chatHistory: history }
    }),
}))

export default useStore
```

- [ ] **Step 2: Verify import compiles**

```bash
cd frontend && node -e "import('./src/store.js').then(() => console.log('OK')).catch(e => console.error(e))"
```

Expected: `OK` (or no error if using ESM).

- [ ] **Step 3: Commit**

```bash
git add frontend/src/store.js
git commit -m "feat: add Zustand store for app state"
```

---

## Task 7: Frontend — LoginModal Component

**Files:**
- Create: `frontend/src/components/LoginModal.jsx`

- [ ] **Step 1: Create LoginModal.jsx**

```jsx
// frontend/src/components/LoginModal.jsx
import { useState } from 'react'

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'

export default function LoginModal({ onClose }) {
  const [form, setForm] = useState({ auth_info_1: '', auth_info_2: '', password: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const update = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }))

  const handleLogin = async () => {
    if (!form.auth_info_1 || !form.password) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`${API}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) {
        const err = await res.json()
        setError(err.detail || '登录失败')
        return
      }
      onClose()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-xl p-6 w-80 space-y-4">
        <h2 className="text-white text-lg font-semibold">登录 X 账号</h2>
        <p className="text-gray-400 text-xs">凭证仅保存在本地 cookies.json，不会上传。</p>
        <input
          className="w-full bg-gray-700 text-white text-sm rounded px-3 py-2 focus:outline-none"
          placeholder="用户名或邮箱 *"
          value={form.auth_info_1}
          onChange={update('auth_info_1')}
        />
        <input
          className="w-full bg-gray-700 text-white text-sm rounded px-3 py-2 focus:outline-none"
          placeholder="备用邮箱（可选，X 有时会要求验证）"
          value={form.auth_info_2}
          onChange={update('auth_info_2')}
        />
        <input
          type="password"
          className="w-full bg-gray-700 text-white text-sm rounded px-3 py-2 focus:outline-none"
          placeholder="密码 *"
          value={form.password}
          onChange={update('password')}
          onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
        />
        {error && <p className="text-red-400 text-xs">{error}</p>}
        <div className="flex gap-2 pt-1">
          <button
            onClick={handleLogin}
            disabled={loading || !form.auth_info_1 || !form.password}
            className="flex-1 bg-blue-500 text-white py-2 rounded hover:bg-blue-600 disabled:opacity-40 text-sm"
          >
            {loading ? '登录中...' : '登录'}
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-400 hover:text-white text-sm"
          >
            取消
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/LoginModal.jsx
git commit -m "feat: add X login modal component"
```

---

## Task 8: Frontend — Sidebar Component

**Files:**
- Create: `frontend/src/components/Sidebar.jsx`

- [ ] **Step 1: Create Sidebar.jsx**

```jsx
// frontend/src/components/Sidebar.jsx
import { useEffect, useState } from 'react'
import useStore from '../store'

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'

export default function Sidebar({ onLoginClick }) {
  const { users, setUsers, selectedUser, selectUser } = useStore()
  const [input, setInput] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    fetch(`${API}/api/users`)
      .then((r) => r.json())
      .then(setUsers)
      .catch(() => {})
  }, [])

  const refreshUsers = () =>
    fetch(`${API}/api/users`).then((r) => r.json()).then(setUsers)

  const addUser = async () => {
    const username = input.trim()
    if (!username) return
    setError('')
    const res = await fetch(`${API}/api/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username }),
    })
    if (!res.ok) {
      const err = await res.json()
      setError(err.detail || '添加失败')
      return
    }
    setInput('')
    await refreshUsers()
  }

  const deleteUser = async (username) => {
    await fetch(`${API}/api/users/${username}`, { method: 'DELETE' })
    if (selectedUser?.username === username) selectUser(null)
    await refreshUsers()
  }

  return (
    <aside className="w-60 bg-gray-900 h-screen flex flex-col border-r border-gray-700">
      <div className="p-4 border-b border-gray-700">
        <h1 className="text-white text-lg font-bold tracking-tight">XDigest</h1>
      </div>

      <div className="p-3 border-b border-gray-700 space-y-2">
        <div className="flex gap-1">
          <input
            className="flex-1 bg-gray-700 text-white text-sm rounded px-2 py-1 focus:outline-none"
            placeholder="添加用户名"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addUser()}
          />
          <button
            onClick={addUser}
            className="bg-blue-500 text-white text-sm px-2 py-1 rounded hover:bg-blue-600"
          >
            +
          </button>
        </div>
        {error && <p className="text-red-400 text-xs">{error}</p>}
      </div>

      <ul className="flex-1 overflow-y-auto p-2 space-y-1">
        {users.map((user) => (
          <li
            key={user.username}
            className={`flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer group ${
              selectedUser?.username === user.username
                ? 'bg-blue-600 text-white'
                : 'text-gray-300 hover:bg-gray-700'
            }`}
          >
            <span
              onClick={() => selectUser(user)}
              className="flex-1 text-sm truncate"
            >
              @{user.username}
            </span>
            <button
              onClick={() => deleteUser(user.username)}
              className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-400 text-xs ml-1"
            >
              ✕
            </button>
          </li>
        ))}
        {users.length === 0 && (
          <p className="text-gray-600 text-xs text-center pt-4">暂无追踪用户</p>
        )}
      </ul>

      <div className="p-3 border-t border-gray-700">
        <button
          onClick={onLoginClick}
          className="w-full text-gray-400 text-xs hover:text-white py-1"
        >
          ⚙ X 账号登录
        </button>
      </div>
    </aside>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/Sidebar.jsx
git commit -m "feat: add user list sidebar component"
```

---

## Task 9: Frontend — Summary Component

**Files:**
- Create: `frontend/src/components/Summary.jsx`

- [ ] **Step 1: Create Summary.jsx**

```jsx
// frontend/src/components/Summary.jsx
import useStore from '../store'

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'

export default function Summary() {
  const { selectedUser, tweets, summary, isLoading, setIsLoading, setFetchResult } =
    useStore()

  const fetchTweets = async () => {
    if (!selectedUser || isLoading) return
    setIsLoading(true)
    setFetchResult([], '')
    try {
      const res = await fetch(`${API}/api/fetch/${selectedUser.username}`, {
        method: 'POST',
      })
      const data = await res.json()
      if (!res.ok) {
        setFetchResult([], `错误：${data.detail}`)
        return
      }
      setFetchResult(data.tweets, data.summary)
    } catch {
      setFetchResult([], '网络错误，请检查后端是否启动')
    } finally {
      setIsLoading(false)
    }
  }

  if (!selectedUser) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-500 text-sm">
        请从左侧选择一个用户
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-white text-base font-semibold">@{selectedUser.username}</h2>
          {tweets.length > 0 && (
            <p className="text-gray-500 text-xs mt-0.5">今日共 {tweets.length} 条发言</p>
          )}
        </div>
        <button
          onClick={fetchTweets}
          disabled={isLoading}
          className="bg-blue-500 text-white text-sm px-4 py-2 rounded-lg hover:bg-blue-600 disabled:opacity-50 transition-colors"
        >
          {isLoading ? '抓取中...' : '抓取今日发言'}
        </button>
      </div>

      {summary && (
        <div className="bg-gray-800 rounded-xl p-5 text-gray-200 text-sm leading-7 whitespace-pre-wrap">
          {summary}
        </div>
      )}

      {!summary && !isLoading && (
        <div className="text-gray-600 text-sm text-center pt-10">
          点击「抓取今日发言」开始
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/Summary.jsx
git commit -m "feat: add summary display component with fetch button"
```

---

## Task 10: Frontend — ChatBox Component

**Files:**
- Create: `frontend/src/components/ChatBox.jsx`

- [ ] **Step 1: Create ChatBox.jsx**

```jsx
// frontend/src/components/ChatBox.jsx
import { useEffect, useRef, useState } from 'react'
import useStore from '../store'

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'

export default function ChatBox() {
  const {
    tweets,
    chatHistory,
    isChatLoading,
    setIsChatLoading,
    addUserMessage,
    appendAssistantChunk,
  } = useStore()
  const [input, setInput] = useState('')
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatHistory])

  const sendMessage = async () => {
    const text = input.trim()
    if (!text || isChatLoading || tweets.length === 0) return

    setInput('')
    addUserMessage(text)
    setIsChatLoading(true)

    const messages = [
      ...chatHistory.filter((m) => m.content),
      { role: 'user', content: text },
    ]

    try {
      const res = await fetch(`${API}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages, tweets }),
      })

      const reader = res.body.getReader()
      const decoder = new TextDecoder()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const text = decoder.decode(value)
        for (const line of text.split('\n')) {
          if (!line.startsWith('data: ')) continue
          const data = line.slice(6)
          if (data === '[DONE]') break
          try {
            const parsed = JSON.parse(data)
            if (parsed.content) appendAssistantChunk(parsed.content)
          } catch {}
        }
      }
    } catch {
      appendAssistantChunk('（回复出错，请重试）')
    } finally {
      setIsChatLoading(false)
    }
  }

  if (tweets.length === 0) return null

  return (
    <div className="border-t border-gray-700 flex flex-col" style={{ height: '42vh' }}>
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {chatHistory.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-lg px-3 py-2 rounded-xl text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-200'
              }`}
            >
              {msg.content || <span className="animate-pulse">▋</span>}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <div className="flex gap-2 p-3 border-t border-gray-700">
        <input
          className="flex-1 bg-gray-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none"
          placeholder="针对今日发言提问..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
        />
        <button
          onClick={sendMessage}
          disabled={isChatLoading || !input.trim()}
          className="bg-blue-500 text-white text-sm px-4 py-2 rounded-lg hover:bg-blue-600 disabled:opacity-40 transition-colors"
        >
          发送
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/ChatBox.jsx
git commit -m "feat: add SSE-streaming chat component"
```

---

## Task 11: Frontend — App Layout Assembly

**Files:**
- Modify: `frontend/src/App.jsx`
- Modify: `frontend/index.html`

- [ ] **Step 1: Update index.html title**

Replace `<title>Vite + React</title>` with `<title>XDigest</title>` in `frontend/index.html`.

- [ ] **Step 2: Replace App.jsx**

```jsx
// frontend/src/App.jsx
import { useState } from 'react'
import Sidebar from './components/Sidebar'
import Summary from './components/Summary'
import ChatBox from './components/ChatBox'
import LoginModal from './components/LoginModal'

export default function App() {
  const [showLogin, setShowLogin] = useState(false)

  return (
    <div className="flex h-screen bg-gray-900 text-white overflow-hidden">
      <Sidebar onLoginClick={() => setShowLogin(true)} />
      <main className="flex-1 flex flex-col overflow-hidden">
        <Summary />
        <ChatBox />
      </main>
      {showLogin && <LoginModal onClose={() => setShowLogin(false)} />}
    </div>
  )
}
```

- [ ] **Step 3: Remove default Vite styles**

Delete the contents of `frontend/src/App.css` (leave the file empty or delete it). Remove the `import './App.css'` line from `App.jsx` if present.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/App.jsx frontend/index.html frontend/src/App.css
git commit -m "feat: assemble full app layout"
```

---

## Task 12: End-to-End Smoke Test

- [ ] **Step 1: Copy .env.example and fill in your OpenRouter API key**

```bash
cp backend/.env.example backend/.env
# Edit backend/.env and set OPENROUTER_API_KEY=your_real_key
```

- [ ] **Step 2: Start the backend**

```bash
cd backend && source venv/bin/activate && uvicorn main:app --reload --port 8000
```

Expected: `Application startup complete.` in terminal.

- [ ] **Step 3: Start the frontend (new terminal)**

```bash
cd frontend && npm run dev
```

Expected: `Local: http://localhost:5173` in terminal.

- [ ] **Step 4: Verify user management**

Open `http://localhost:5173` in browser.
- Add a user (e.g., `sama`) via the sidebar input → user appears in list
- Delete the user → user disappears

- [ ] **Step 5: Verify X login**

Click「⚙ X 账号登录」→ fill in your X credentials → click 登录.
Expected: modal closes without error.
Verify: `backend/cookies.json` file is created.

- [ ] **Step 6: Verify fetch + summary**

Select a tracked user → click「抓取今日发言」.
Expected: loading state appears, then summary text renders.

- [ ] **Step 7: Verify chat**

After summary loads, type a question in the chat box → click 发送.
Expected: AI reply streams in character-by-character.

- [ ] **Step 8: Final commit and push**

```bash
git add -A && git commit -m "feat: complete XDigest v1 implementation"
git push origin main
```

---

## Error Reference

| Symptom | Fix |
|---------|-----|
| `401 Not logged in to X` | Click「X 账号登录」and complete login |
| `404 User not found` | Check the X username is correct |
| `429 Rate limited` | Wait ~15 minutes and try again |
| `ValueError: OPENROUTER_API_KEY not set` | Check `backend/.env` has the key |
| Frontend shows `网络错误` | Ensure `uvicorn` is running on port 8000 |
