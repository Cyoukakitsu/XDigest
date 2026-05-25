# Railway + Cloudflare Pages 部署实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 XDigest 后端部署到 Railway（含持久 Volume），前端部署到 Cloudflare Pages，使每日 digest 定时任务可靠运行。

**Architecture:** 后端用 Nixpacks 在 Railway 上构建，`users.json` 和 `cookies.json` 存储在 Railway Volume（挂载到 `/data`），路径通过 `DATA_DIR` 环境变量配置。前端构建后部署到 Cloudflare Pages，通过 `VITE_API_URL` 指向 Railway 后端，CORS 来源由 `ALLOWED_ORIGINS` 环境变量控制。

**Tech Stack:** FastAPI, APScheduler, Railway Nixpacks, Cloudflare Pages, pytest, monkeypatch

---

## 文件结构

| 操作 | 文件 | 说明 |
|------|------|------|
| Modify | `backend/scraper.py` | `COOKIES_PATH` 改用 `DATA_DIR` 环境变量 |
| Modify | `backend/main.py` | `USERS_PATH` 改用 `DATA_DIR`，CORS 改用 `ALLOWED_ORIGINS` |
| Create | `backend/railway.toml` | Railway Nixpacks 构建和启动命令 |
| Create | `backend/tests/test_config.py` | 环境变量配置测试 |
| Create | `frontend/public/_redirects` | Cloudflare Pages SPA 路由回退 |

---

### Task 1: scraper.py — COOKIES_PATH 使用 DATA_DIR 环境变量

**Files:**
- Modify: `backend/scraper.py:1-7`
- Test: `backend/tests/test_config.py`（新建）

- [ ] **Step 1: 创建 test_config.py，写入失败测试**

```python
# backend/tests/test_config.py
import importlib
import pytest


def test_cookies_path_uses_data_dir(monkeypatch, tmp_path):
    monkeypatch.setenv("DATA_DIR", str(tmp_path))
    import scraper
    importlib.reload(scraper)
    assert scraper.COOKIES_PATH == tmp_path / "cookies.json"
```

- [ ] **Step 2: 运行测试，确认 FAIL**

```bash
cd backend && source venv/bin/activate
pytest tests/test_config.py::test_cookies_path_uses_data_dir -v
```

预期：`FAILED` — `AssertionError`（当前 COOKIES_PATH 不读取 DATA_DIR）

- [ ] **Step 3: 修改 scraper.py，加入 DATA_DIR 支持**

将 `backend/scraper.py` 开头改为：

```python
import json
import os
from datetime import datetime, timedelta, timezone
from pathlib import Path

from twikit import Client

DATA_DIR = Path(os.getenv("DATA_DIR", str(Path(__file__).parent)))
COOKIES_PATH = DATA_DIR / "cookies.json"
```

- [ ] **Step 4: 运行测试，确认 PASS**

```bash
pytest tests/test_config.py::test_cookies_path_uses_data_dir -v
```

预期：`PASSED`

- [ ] **Step 5: 运行全部测试，确认无回归**

```bash
pytest --tb=short -q
```

预期：所有已有测试仍通过

- [ ] **Step 6: 提交**

```bash
git add backend/scraper.py backend/tests/test_config.py
git commit -m "feat: use DATA_DIR env var for COOKIES_PATH in scraper"
```

---

### Task 2: main.py — USERS_PATH 和 CORS 使用环境变量

**Files:**
- Modify: `backend/main.py:41` (USERS_PATH)，`backend/main.py:34-39` (CORS)
- Test: `backend/tests/test_config.py`（追加）

- [ ] **Step 1: 在 test_config.py 追加两个失败测试**

在 `test_config.py` 末尾追加：

```python
import sys


def test_users_path_uses_data_dir(monkeypatch, tmp_path, patched_modules):
    monkeypatch.setenv("DATA_DIR", str(tmp_path))
    sys.modules.pop("main", None)
    import main
    assert main.USERS_PATH == tmp_path / "users.json"


def test_cors_allows_configured_origin(monkeypatch, patched_modules):
    monkeypatch.setenv("ALLOWED_ORIGINS", "https://myapp.pages.dev,http://localhost:5173")
    sys.modules.pop("main", None)
    import main
    from fastapi.testclient import TestClient
    client = TestClient(main.app)
    resp = client.get("/api/users", headers={"Origin": "https://myapp.pages.dev"})
    assert resp.headers.get("access-control-allow-origin") == "https://myapp.pages.dev"
```

- [ ] **Step 2: 运行两个新测试，确认 FAIL**

```bash
pytest tests/test_config.py::test_users_path_uses_data_dir tests/test_config.py::test_cors_allows_configured_origin -v
```

预期：两个均 `FAILED`

- [ ] **Step 3: 修改 main.py 的 USERS_PATH**

将 `backend/main.py` 第 41 行：
```python
USERS_PATH = Path(__file__).parent / "users.json"
```
改为（紧接 `load_dotenv()` 之后，在模块顶层加一行 DATA_DIR，再改 USERS_PATH）：
```python
DATA_DIR = Path(os.getenv("DATA_DIR", str(Path(__file__).parent)))
USERS_PATH = DATA_DIR / "users.json"
```

- [ ] **Step 4: 修改 main.py 的 CORS allow_origins**

将 `backend/main.py` 中：
```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)
```
改为：
```python
_origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:5173,http://localhost:3000")
app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins.split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)
```

- [ ] **Step 5: 运行新测试，确认 PASS**

```bash
pytest tests/test_config.py -v
```

预期：3 个测试全部 `PASSED`

- [ ] **Step 6: 运行全部测试，确认无回归**

```bash
pytest --tb=short -q
```

预期：所有测试通过

- [ ] **Step 7: 提交**

```bash
git add backend/main.py backend/tests/test_config.py
git commit -m "feat: use DATA_DIR and ALLOWED_ORIGINS env vars in main"
```

---

### Task 3: 创建 backend/railway.toml

**Files:**
- Create: `backend/railway.toml`

- [ ] **Step 1: 创建 railway.toml**

新建 `backend/railway.toml`，内容：

```toml
[build]
builder = "NIXPACKS"

[deploy]
startCommand = "uvicorn main:app --host 0.0.0.0 --port $PORT"
```

- [ ] **Step 2: 提交**

```bash
git add backend/railway.toml
git commit -m "feat: add railway.toml for Nixpacks deployment"
```

---

### Task 4: 创建 frontend/public/_redirects

**Files:**
- Create: `frontend/public/_redirects`

- [ ] **Step 1: 创建 _redirects 文件**

新建 `frontend/public/_redirects`，内容（一行）：

```
/* /index.html 200
```

这让 Cloudflare Pages 把所有路径都回退到 `index.html`，使 React Router 客户端路由正常工作。

- [ ] **Step 2: 提交**

```bash
git add frontend/public/_redirects
git commit -m "feat: add Cloudflare Pages SPA redirect rule"
```

---

## 部署操作手册（代码完成后）

> 以下步骤在 Railway 和 Cloudflare Pages 控制台操作，不涉及代码改动。

### Railway 后端

1. 登录 [railway.app](https://railway.app)，新建项目 → Deploy from GitHub repo
2. 选择本仓库，**Root Directory** 填 `backend`
3. 部署成功后，进入服务 → **Volumes** → Add Volume，挂载路径填 `/data`
4. 进入 **Variables** 面板，填写以下环境变量：

   | 变量名 | 值 |
   |--------|-----|
   | `DATA_DIR` | `/data` |
   | `OPENROUTER_API_KEY` | （从本地 .env 复制） |
   | `OPENROUTER_MODEL` | `openrouter/auto` |
   | `GMAIL_USER` | `z261459808@gmail.com` |
   | `GMAIL_APP_PASSWORD` | （从本地 .env 复制） |
   | `DIGEST_TO` | `z261459808@gmail.com` |
   | `ALLOWED_ORIGINS` | 先填 `http://localhost:5173`，Cloudflare Pages 部署后更新 |

5. 触发 Redeploy，等待部署完成，记下服务 URL（形如 `https://xxx.railway.app`）

### Cloudflare Pages 前端

1. 登录 [pages.cloudflare.com](https://pages.cloudflare.com)，新建项目 → Connect to Git
2. 选择本仓库，配置：
   - **Root directory（构建根目录）：** `frontend`
   - **Build command：** `npm run build`
   - **Build output directory：** `dist`
3. **Environment variables** 填写：

   | 变量名 | 值 |
   |--------|-----|
   | `VITE_API_URL` | `https://xxx.railway.app`（第 5 步的 URL） |

4. 部署完成，记下分配的域名（形如 `https://xdigest.pages.dev`）

### 完成收尾

1. 回到 Railway **Variables** 面板，将 `ALLOWED_ORIGINS` 更新为：
   `https://xdigest.pages.dev,http://localhost:5173`
2. 触发 Railway Redeploy

### 验证

- [ ] 打开 Cloudflare Pages URL，LoginModal 正常显示
- [ ] 用 X 账号登录，Railway 日志出现 `cookies saved` 类日志
- [ ] 添加一个用户，刷新页面后仍存在（Volume 写入正常）
- [ ] 等待或手动触发 `run_daily_digest`（在 Railway 控制台查看日志），确认邮件发出
