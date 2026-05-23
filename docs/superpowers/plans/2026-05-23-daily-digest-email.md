# Daily Digest Email Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 每天北京时间 08:30 自动抓取监控列表中已勾选账号的推文，AI 总结后合并为一封 HTML 邮件发送给用户。

**Architecture:** APScheduler（asyncio 模式）内置到 FastAPI lifespan，定时调用 `run_daily_digest()`；新建 `emailer.py` 负责构建 HTML 邮件并通过 Gmail SMTP 发送；`users.json` 新增 `digest` 字段控制每个账号是否纳入早报；前端 Sidebar 增加每用户的开关按钮。

**Tech Stack:** Python APScheduler 3.10+, smtplib (stdlib), markdown 3.6+, FastAPI lifespan, React Zustand

---

## 文件变更清单

| 文件 | 操作 | 说明 |
|------|------|------|
| `backend/requirements.txt` | 修改 | 新增 `apscheduler>=3.10`、`markdown>=3.6` |
| `backend/.env.example` | 修改 | 新增 Gmail 三个环境变量示例 |
| `backend/emailer.py` | 新建 | `build_html()` 和 `send_digest()` |
| `backend/tests/test_emailer.py` | 新建 | emailer 单元测试 |
| `backend/tests/test_digest.py` | 新建 | `run_daily_digest()` 集成测试 |
| `backend/tests/test_users.py` | 修改 | 新增 PATCH 端点测试 |
| `backend/main.py` | 修改 | 新增 lifespan、`run_daily_digest()`、`PATCH /api/users/{username}`、更新 `_load_users()` |
| `frontend/src/store.js` | 修改 | 新增 `toggleDigest` action |
| `frontend/src/components/Sidebar.jsx` | 修改 | 每用户行新增 digest 开关按钮 |

---

## Task 1: 安装依赖，更新环境变量示例

**Files:**
- Modify: `backend/requirements.txt`
- Modify: `backend/.env.example`

- [ ] **Step 1: 更新 requirements.txt**

将 `backend/requirements.txt` 改为：

```
fastapi>=0.115.0
uvicorn>=0.30.0
twikit>=2.0.0
httpx>=0.27.0
python-dotenv>=1.0.0
pytest>=8.0.0
pytest-asyncio>=0.24.0
apscheduler>=3.10
markdown>=3.6
```

- [ ] **Step 2: 安装新依赖**

```bash
cd backend && source venv/bin/activate && pip install apscheduler>=3.10 "markdown>=3.6"
```

预期输出：`Successfully installed apscheduler-... markdown-...`

- [ ] **Step 3: 更新 .env.example**

将 `backend/.env.example` 改为：

```
OPENROUTER_API_KEY=your_openrouter_key_here
OPENROUTER_MODEL=meta-llama/llama-3.1-8b-instruct:free

# Gmail 早报推送（需在 Google 账号后台生成"应用专用密码"）
GMAIL_USER=your_gmail@gmail.com
GMAIL_APP_PASSWORD=xxxx-xxxx-xxxx-xxxx
DIGEST_TO=recipient@gmail.com
```

- [ ] **Step 4: 把真实的 Gmail 配置写入 backend/.env**

在 `backend/.env` 末尾追加：

```
GMAIL_USER=z261459808@gmail.com
GMAIL_APP_PASSWORD=<在 Google 账号后台生成的应用专用密码>
DIGEST_TO=z261459808@gmail.com
```

> 获取应用专用密码：Google 账号 → 安全性 → 两步验证 → 应用专用密码 → 生成

- [ ] **Step 5: 提交**

```bash
git add backend/requirements.txt backend/.env.example
git commit -m "chore: add apscheduler and markdown dependencies for daily digest"
```

---

## Task 2: emailer.py — build_html（TDD）

**Files:**
- Create: `backend/tests/test_emailer.py`
- Create: `backend/emailer.py`

- [ ] **Step 1: 写失败测试**

新建 `backend/tests/test_emailer.py`：

```python
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import emailer


def test_build_html_contains_username():
    sections = [{"username": "alice", "summary": "## 主要话题\n内容A", "tweet_count": 5}]
    html = emailer.build_html(sections)
    assert "@alice" in html


def test_build_html_renders_tweet_count():
    sections = [{"username": "alice", "summary": "内容", "tweet_count": 5}]
    html = emailer.build_html(sections)
    assert "5" in html


def test_build_html_no_tweets_shows_placeholder():
    sections = [{"username": "quiet", "summary": None, "tweet_count": 0}]
    html = emailer.build_html(sections)
    assert "暂无发言" in html
    assert "@quiet" in html


def test_build_html_multiple_sections():
    sections = [
        {"username": "alice", "summary": "内容A", "tweet_count": 3},
        {"username": "bob", "summary": None, "tweet_count": 0},
    ]
    html = emailer.build_html(sections)
    assert "@alice" in html
    assert "@bob" in html
    assert "暂无发言" in html


def test_build_html_includes_date():
    from datetime import date
    today = date.today().strftime("%Y-%m-%d")
    sections = [{"username": "alice", "summary": "内容", "tweet_count": 1}]
    html = emailer.build_html(sections)
    assert today in html
```

- [ ] **Step 2: 运行测试，确认失败**

```bash
cd backend && source venv/bin/activate && pytest tests/test_emailer.py -v
```

预期：`ERROR` 或 `ModuleNotFoundError: No module named 'emailer'`

- [ ] **Step 3: 实现 emailer.build_html**

新建 `backend/emailer.py`：

```python
import logging
import smtplib
import os
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from datetime import date

import markdown as md_lib

logger = logging.getLogger(__name__)


def build_html(sections: list[dict]) -> str:
    today = date.today().strftime("%Y-%m-%d")
    parts = [
        "<html><body>",
        f"<h1>XDigest 早报 &middot; {today}</h1>",
        "<hr>",
    ]
    for s in sections:
        parts.append(f"<h2>@{s['username']}</h2>")
        if s["summary"]:
            parts.append(md_lib.markdown(s["summary"]))
            parts.append(f"<p><small>共 {s['tweet_count']} 条推文</small></p>")
        else:
            parts.append("<p><em>暂无发言</em></p>")
        parts.append("<hr>")
    parts.append("</body></html>")
    return "\n".join(parts)
```

- [ ] **Step 4: 运行测试，确认全部通过**

```bash
cd backend && source venv/bin/activate && pytest tests/test_emailer.py -v
```

预期：5 个测试全部 `PASSED`

- [ ] **Step 5: 提交**

```bash
git add backend/emailer.py backend/tests/test_emailer.py
git commit -m "feat: add emailer.build_html for daily digest HTML generation"
```

---

## Task 3: emailer.py — send_digest（TDD）

**Files:**
- Modify: `backend/tests/test_emailer.py`
- Modify: `backend/emailer.py`

- [ ] **Step 1: 在 test_emailer.py 末尾追加 send_digest 测试**

```python
from unittest.mock import MagicMock


def test_send_digest_calls_smtp(monkeypatch):
    monkeypatch.setenv("GMAIL_USER", "sender@gmail.com")
    monkeypatch.setenv("GMAIL_APP_PASSWORD", "app-pass")
    monkeypatch.setenv("DIGEST_TO", "receiver@gmail.com")

    mock_server = MagicMock()
    mock_smtp_cls = MagicMock()
    mock_smtp_cls.return_value.__enter__ = MagicMock(return_value=mock_server)
    mock_smtp_cls.return_value.__exit__ = MagicMock(return_value=False)

    sections = [{"username": "alice", "summary": "内容", "tweet_count": 2}]
    emailer.send_digest(sections, smtp_class=mock_smtp_cls)

    mock_smtp_cls.assert_called_once_with("smtp.gmail.com", 465)
    mock_server.login.assert_called_once_with("sender@gmail.com", "app-pass")
    mock_server.sendmail.assert_called_once()
    args = mock_server.sendmail.call_args[0]
    assert args[0] == "sender@gmail.com"
    assert args[1] == "receiver@gmail.com"


def test_send_digest_skips_when_config_missing(monkeypatch):
    monkeypatch.delenv("GMAIL_USER", raising=False)
    monkeypatch.delenv("GMAIL_APP_PASSWORD", raising=False)
    monkeypatch.delenv("DIGEST_TO", raising=False)

    mock_smtp_cls = MagicMock()
    sections = [{"username": "alice", "summary": "内容", "tweet_count": 1}]
    emailer.send_digest(sections, smtp_class=mock_smtp_cls)

    mock_smtp_cls.assert_not_called()


def test_send_digest_logs_on_smtp_error(monkeypatch, caplog):
    import logging
    monkeypatch.setenv("GMAIL_USER", "sender@gmail.com")
    monkeypatch.setenv("GMAIL_APP_PASSWORD", "app-pass")
    monkeypatch.setenv("DIGEST_TO", "receiver@gmail.com")

    mock_smtp_cls = MagicMock()
    mock_smtp_cls.return_value.__enter__ = MagicMock(side_effect=Exception("connection refused"))
    mock_smtp_cls.return_value.__exit__ = MagicMock(return_value=False)

    sections = [{"username": "alice", "summary": "内容", "tweet_count": 1}]
    with caplog.at_level(logging.ERROR, logger="emailer"):
        emailer.send_digest(sections, smtp_class=mock_smtp_cls)

    assert any("connection refused" in r.message for r in caplog.records)
```

- [ ] **Step 2: 运行测试，确认新测试失败**

```bash
cd backend && source venv/bin/activate && pytest tests/test_emailer.py::test_send_digest_calls_smtp -v
```

预期：`FAILED` 或 `AttributeError: module 'emailer' has no attribute 'send_digest'`

- [ ] **Step 3: 在 emailer.py 末尾追加 send_digest**

```python

def send_digest(sections: list[dict], *, smtp_class=None) -> None:
    if smtp_class is None:
        smtp_class = smtplib.SMTP_SSL

    gmail_user = os.getenv("GMAIL_USER")
    app_password = os.getenv("GMAIL_APP_PASSWORD")
    to_addr = os.getenv("DIGEST_TO")

    if not all([gmail_user, app_password, to_addr]):
        logger.warning(
            "Daily digest skipped: GMAIL_USER / GMAIL_APP_PASSWORD / DIGEST_TO not set"
        )
        return

    today = date.today().strftime("%Y-%m-%d")
    html = build_html(sections)

    msg = MIMEMultipart("alternative")
    msg["Subject"] = f"XDigest 早报 · {today}"
    msg["From"] = gmail_user
    msg["To"] = to_addr
    msg.attach(MIMEText(html, "html", "utf-8"))

    try:
        with smtp_class("smtp.gmail.com", 465) as server:
            server.login(gmail_user, app_password)
            server.sendmail(gmail_user, to_addr, msg.as_string())
        logger.info("Daily digest sent to %s", to_addr)
    except Exception as e:
        logger.error("Failed to send daily digest: %s", e)
```

- [ ] **Step 4: 运行全部 emailer 测试，确认通过**

```bash
cd backend && source venv/bin/activate && pytest tests/test_emailer.py -v
```

预期：8 个测试全部 `PASSED`

- [ ] **Step 5: 提交**

```bash
git add backend/emailer.py backend/tests/test_emailer.py
git commit -m "feat: add emailer.send_digest via Gmail SMTP"
```

---

## Task 4: _load_users 向后兼容 + PATCH 端点（TDD）

**Files:**
- Modify: `backend/tests/test_users.py`
- Modify: `backend/main.py`

- [ ] **Step 1: 在 test_users.py 末尾追加测试**

```python
def test_load_users_defaults_digest_to_true(client, tmp_path, monkeypatch):
    import main
    monkeypatch.setattr(main, "USERS_PATH", tmp_path / "users.json")
    (tmp_path / "users.json").write_text(
        '[{"username": "legacy", "note": ""}]'
    )
    users = client.get("/api/users").json()
    assert users[0]["digest"] is True


def test_patch_user_digest_false(client):
    client.post("/api/users", json={"username": "patchme"})
    response = client.patch("/api/users/patchme", json={"digest": False})
    assert response.status_code == 200
    assert response.json() == {"ok": True}
    users = client.get("/api/users").json()
    assert users[0]["digest"] is False


def test_patch_user_digest_true(client):
    client.post("/api/users", json={"username": "patchme"})
    client.patch("/api/users/patchme", json={"digest": False})
    client.patch("/api/users/patchme", json={"digest": True})
    users = client.get("/api/users").json()
    assert users[0]["digest"] is True


def test_patch_nonexistent_user_returns_404(client):
    response = client.patch("/api/users/nobody", json={"digest": False})
    assert response.status_code == 404
```

- [ ] **Step 2: 运行测试，确认失败**

```bash
cd backend && source venv/bin/activate && pytest tests/test_users.py::test_patch_user_digest_false -v
```

预期：`FAILED` — 404 Method Not Allowed（端点不存在）

- [ ] **Step 3: 更新 main.py**

在 `main.py` 中：

**a) 更新 `_load_users()`，在文件读取后为每条记录补全 `digest` 默认值：**

```python
def _load_users() -> list[dict]:
    if not USERS_PATH.exists():
        return []
    users = json.loads(USERS_PATH.read_text(encoding="utf-8"))
    for u in users:
        u.setdefault("digest", True)
    return users
```

**b) 在现有 Pydantic 模型后新增 `PatchUserRequest`：**

```python
class PatchUserRequest(BaseModel):
    digest: bool
```

**c) 在 `delete_user` 端点后新增 PATCH 端点：**

```python
@app.patch("/api/users/{username}")
def patch_user(username: str, req: PatchUserRequest):
    users = _load_users()
    for user in users:
        if user["username"] == username:
            user["digest"] = req.digest
            _save_users(users)
            return {"ok": True}
    raise HTTPException(status_code=404, detail="User not found")
```

- [ ] **Step 4: 运行全部 users 测试，确认通过**

```bash
cd backend && source venv/bin/activate && pytest tests/test_users.py -v
```

预期：全部 `PASSED`（包含 4 个新测试）

- [ ] **Step 5: 提交**

```bash
git add backend/main.py backend/tests/test_users.py
git commit -m "feat: add digest field to users and PATCH /api/users/{username} endpoint"
```

---

## Task 5: run_daily_digest（TDD）

**Files:**
- Create: `backend/tests/test_digest.py`
- Modify: `backend/main.py`

- [ ] **Step 1: 新建 backend/tests/test_digest.py**

```python
import json
import sys
import pytest
from unittest.mock import AsyncMock, MagicMock


@pytest.fixture
def digest_env(tmp_path, monkeypatch):
    users_path = tmp_path / "users.json"
    cookies_path = tmp_path / "cookies.json"
    cookies_path.write_text("{}")

    mock_scraper = MagicMock()
    mock_scraper.COOKIES_PATH = cookies_path
    mock_scraper.fetch_tweets = AsyncMock(return_value=[
        {
            "id": "1",
            "text": "hello",
            "created_at": "Mon Jan 01 00:00:00 +0000 2024",
            "is_retweet": False,
        }
    ])

    mock_ai = MagicMock()
    mock_ai.summarize = AsyncMock(return_value="AI总结内容")

    mock_emailer = MagicMock()
    mock_emailer.send_digest = MagicMock()

    saved = {k: sys.modules.get(k) for k in ("scraper", "ai", "emailer", "main")}
    sys.modules["scraper"] = mock_scraper
    sys.modules["ai"] = mock_ai
    sys.modules["emailer"] = mock_emailer
    sys.modules.pop("main", None)

    import main
    monkeypatch.setattr(main, "USERS_PATH", users_path)

    yield main, users_path, mock_scraper, mock_ai, mock_emailer

    for key, val in saved.items():
        if val is None:
            sys.modules.pop(key, None)
        else:
            sys.modules[key] = val


@pytest.mark.asyncio
async def test_run_daily_digest_fetches_and_sends(digest_env):
    main, users_path, mock_scraper, mock_ai, mock_emailer = digest_env
    users_path.write_text(json.dumps([
        {"username": "alice", "note": "", "digest": True}
    ]))

    await main.run_daily_digest()

    mock_scraper.fetch_tweets.assert_awaited_once_with("alice", days=1)
    mock_ai.summarize.assert_awaited_once()
    mock_emailer.send_digest.assert_called_once()
    sections = mock_emailer.send_digest.call_args[0][0]
    assert sections[0]["username"] == "alice"
    assert sections[0]["summary"] == "AI总结内容"
    assert sections[0]["tweet_count"] == 1


@pytest.mark.asyncio
async def test_run_daily_digest_skips_digest_false_users(digest_env):
    main, users_path, mock_scraper, mock_ai, mock_emailer = digest_env
    users_path.write_text(json.dumps([
        {"username": "bob", "note": "", "digest": False}
    ]))

    await main.run_daily_digest()

    mock_scraper.fetch_tweets.assert_not_awaited()
    mock_emailer.send_digest.assert_not_called()


@pytest.mark.asyncio
async def test_run_daily_digest_no_tweets_skips_ai(digest_env):
    main, users_path, mock_scraper, mock_ai, mock_emailer = digest_env
    mock_scraper.fetch_tweets = AsyncMock(return_value=[])
    users_path.write_text(json.dumps([
        {"username": "quiet", "note": "", "digest": True}
    ]))

    await main.run_daily_digest()

    mock_ai.summarize.assert_not_awaited()
    mock_emailer.send_digest.assert_called_once()
    sections = mock_emailer.send_digest.call_args[0][0]
    assert sections[0]["summary"] is None
    assert sections[0]["tweet_count"] == 0


@pytest.mark.asyncio
async def test_run_daily_digest_skips_if_not_logged_in(digest_env, tmp_path):
    main, users_path, mock_scraper, mock_ai, mock_emailer = digest_env
    mock_scraper.COOKIES_PATH = tmp_path / "no_cookies.json"
    users_path.write_text(json.dumps([
        {"username": "alice", "note": "", "digest": True}
    ]))

    await main.run_daily_digest()

    mock_scraper.fetch_tweets.assert_not_awaited()
    mock_emailer.send_digest.assert_not_called()


@pytest.mark.asyncio
async def test_run_daily_digest_continues_after_fetch_error(digest_env):
    main, users_path, mock_scraper, mock_ai, mock_emailer = digest_env
    mock_scraper.fetch_tweets = AsyncMock(side_effect=[
        Exception("rate limited"),
        [{"id": "2", "text": "ok", "created_at": "Mon Jan 01 00:00:00 +0000 2024", "is_retweet": False}],
    ])
    mock_ai.summarize = AsyncMock(return_value="Bob 总结")
    users_path.write_text(json.dumps([
        {"username": "alice", "note": "", "digest": True},
        {"username": "bob", "note": "", "digest": True},
    ]))

    await main.run_daily_digest()

    mock_emailer.send_digest.assert_called_once()
    sections = mock_emailer.send_digest.call_args[0][0]
    usernames = [s["username"] for s in sections]
    assert "bob" in usernames
    assert "alice" not in usernames
```

- [ ] **Step 2: 运行测试，确认失败**

```bash
cd backend && source venv/bin/activate && pytest tests/test_digest.py -v
```

预期：`AttributeError: module 'main' has no attribute 'run_daily_digest'`

- [ ] **Step 3: 在 main.py 顶部新增 import**

在 `import ai` 那行之后添加：

```python
import emailer
import logging
```

- [ ] **Step 4: 在 main.py 末尾（chat 端点之后）新增 run_daily_digest**

```python
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
```

- [ ] **Step 5: 运行全部 digest 测试，确认通过**

```bash
cd backend && source venv/bin/activate && pytest tests/test_digest.py -v
```

预期：5 个测试全部 `PASSED`

- [ ] **Step 6: 运行所有测试，确认无回归**

```bash
cd backend && source venv/bin/activate && pytest -v
```

预期：全部 `PASSED`

- [ ] **Step 7: 提交**

```bash
git add backend/main.py backend/tests/test_digest.py
git commit -m "feat: add run_daily_digest function"
```

---

## Task 6: APScheduler lifespan 集成

**Files:**
- Modify: `backend/main.py`

- [ ] **Step 1: 在 main.py 顶部新增 import**

在已有 import 块中添加：

```python
from contextlib import asynccontextmanager
from apscheduler.schedulers.asyncio import AsyncIOScheduler
```

- [ ] **Step 2: 在 `app = FastAPI()` 之前添加 lifespan**

```python
@asynccontextmanager
async def lifespan(app: FastAPI):
    scheduler = AsyncIOScheduler(timezone="Asia/Shanghai")
    scheduler.add_job(run_daily_digest, "cron", hour=8, minute=30)
    scheduler.start()
    logging.info("Daily digest scheduler started (08:30 Asia/Shanghai)")
    yield
    scheduler.shutdown()
```

- [ ] **Step 3: 将 lifespan 传入 FastAPI**

将 `app = FastAPI()` 改为：

```python
app = FastAPI(lifespan=lifespan)
```

- [ ] **Step 4: run_daily_digest 移到 lifespan 定义之前**

确认文件中 `run_daily_digest` 函数定义出现在 `lifespan` 函数之前（Python 函数引用在调用时才解析，但保持顺序清晰）。实际上 APScheduler 在调用 job 时才查找函数引用，所以顺序无关紧要——但为了可读性，将 `run_daily_digest` 放在 `lifespan` 上面。

- [ ] **Step 5: 运行所有测试，确认通过**

```bash
cd backend && source venv/bin/activate && pytest -v
```

预期：全部 `PASSED`（lifespan 在 TestClient 中不会真正触发 scheduler，不影响测试）

- [ ] **Step 6: 手动验证调度器启动**

```bash
cd backend && source venv/bin/activate && uvicorn main:app --reload
```

观察日志输出中是否有：
```
INFO:root:Daily digest scheduler started (08:30 Asia/Shanghai)
```

验证后 Ctrl+C 停止。

- [ ] **Step 7: 提交**

```bash
git add backend/main.py
git commit -m "feat: integrate APScheduler into FastAPI lifespan for 08:30 daily digest"
```

---

## Task 7: 前端 — store.js 和 Sidebar digest 开关

**Files:**
- Modify: `frontend/src/store.js`
- Modify: `frontend/src/components/Sidebar.jsx`

- [ ] **Step 1: 在 store.js 顶部（`create` 调用之前）定义 API 常量**

在 `import { create } from 'zustand'` 之后添加：

```javascript
const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'
```

- [ ] **Step 2: 在 store.js 的 store 对象中新增 toggleDigest action**

在 `appendAssistantChunk` 之后，紧接着 `}))` 前加入（注意逗号）：

```javascript
  toggleDigest: async (username, digest) => {
    try {
      await fetch(`${API}/api/users/${username}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ digest }),
      })
      set((state) => ({
        users: state.users.map((u) =>
          u.username === username ? { ...u, digest } : u
        ),
      }))
    } catch (_) {}
  },
```

- [ ] **Step 3: 在 Sidebar.jsx 中从 store 取出 toggleDigest**

将：
```javascript
const { users, setUsers, selectedUser, selectUser } = useStore()
```
改为：
```javascript
const { users, setUsers, selectedUser, selectUser, toggleDigest } = useStore()
```

- [ ] **Step 4: 在 Sidebar.jsx 的用户列表项中新增 digest 开关按钮**

将 `<li>` 内部替换为（在 `✕` 按钮之前插入 `✉` 按钮）：

```jsx
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
    onClick={(e) => {
      e.stopPropagation()
      toggleDigest(user.username, !(user.digest ?? true))
    }}
    className={`opacity-0 group-hover:opacity-100 text-xs ml-1 transition-colors ${
      (user.digest ?? true)
        ? 'text-blue-400 hover:text-blue-200'
        : 'text-gray-600 hover:text-gray-400'
    }`}
    title={(user.digest ?? true) ? '已订阅早报，点击取消' : '未订阅早报，点击开启'}
  >
    ✉
  </button>
  <button
    onClick={() => deleteUser(user.username)}
    className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-400 text-xs ml-1"
  >
    ✕
  </button>
</li>
```

- [ ] **Step 5: 启动前端验证**

```bash
cd frontend && npm run dev
```

在浏览器打开 http://localhost:5173，hover 每个用户行，确认：
- 出现蓝色 `✉` 和灰色 `✕` 两个按钮
- 点击 `✉` 后图标变为灰色（表示已取消订阅）
- 再次点击变回蓝色
- 刷新页面后状态保持（从服务器重新加载）

- [ ] **Step 6: 提交**

```bash
git add frontend/src/store.js frontend/src/components/Sidebar.jsx
git commit -m "feat: add per-user digest toggle in Sidebar"
```

---

## 验证完整流程

完成所有任务后，按以下步骤端到端验证：

1. 启动后端：`cd backend && source venv/bin/activate && uvicorn main:app --reload`
2. 确认日志中出现 `Daily digest scheduler started`
3. 在前端开启至少一个用户的 `✉` 订阅
4. 临时修改 main.py 中的调度时间为 1-2 分钟后触发（测试完删除）：

   ```python
   scheduler.add_job(run_daily_digest, "date", run_date=<近期时间>)
   ```

   或直接在终端调用 API 手动触发（若将来添加了手动端点）
5. 检查 `z261459808@gmail.com` 收件箱，确认收到格式正确的早报邮件
