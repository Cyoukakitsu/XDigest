# CLAUDE.md

本文件为 Claude Code 提供项目指引。

## 项目简介

XDigest — 个人 X（Twitter）动态追踪工具。将 X 账号加入关注列表，每天自动抓取推文并生成 AI 摘要邮件，支持大盘快报和聊天追问功能。

## 开发命令

### 后端（FastAPI + Python）

```bash
cd backend
source venv/bin/activate

# 启动开发服务器
uvicorn main:app --reload

# 运行全部测试
pytest

# 运行单个测试文件
pytest tests/test_users.py

# 运行单个测试
pytest tests/test_users.py::test_add_user
```

### 前端（React + Vite + Tailwind）

```bash
cd frontend

# 开发服务器（http://localhost:5173）
npm run dev

# 生产构建
npm run build

# Lint 检查
npm run lint
```

## 架构说明

### 后端（`backend/`）

- **`main.py`** — FastAPI 应用，所有路由在这里。读写 `users.json` 管理关注列表，调用 `scraper` 和 `ai` 模块。
- **`scraper.py`** — 用 `twikit` 登录 X，抓取指定用户过去 24 小时的推文。登录状态存在 `cookies.json`。
- **`ai.py`** — 调用 OpenRouter 做一次性摘要、SSE 流式聊天、以及大盘快报摘要（`summarize_market()`）。模型通过 `OPENROUTER_MODEL` 配置。
- **`market_data.py`** — 抓取 feargreedmeter.com 的 Fear & Greed 指数，以及 Alpha Vantage GLOBAL_QUOTE 端点的板块 ETF 和科技股数据（每天约 21 次 API 调用，上限 25 次）。
- **`emailer.py`** — 通过 Gmail SMTP 发送每日邮件，支持可选的大盘快报块（`market_summary` 参数）。
- **`digest_job.py`** — 独立脚本，由 macOS launchd 每天 8:30 触发。先抓市场数据，再遍历用户抓推文，最后发邮件。
- **`twikit_patches.py`** — **必须在 `twikit` 之前导入**（见 `main.py` 第 13 行）。修复 twikit 2.3.x 的两个兼容性问题。

运行时持久化文件：`backend/cookies.json`（X 登录态）、`backend/users.json`（关注列表）。

### 前端（`frontend/src/`）

- **`store.js`** — Zustand 状态管理。维护用户列表、选中用户、推文数据、AI 摘要、聊天记录。
- **`App.jsx`** — 根布局：左侧 `<Sidebar>` + 右侧 `<Summary>` + `<ChatBox>` + `<LoginModal>` 浮层。
- 所有组件通过 `useStore` 读写状态。API 地址通过 `VITE_API_URL` 环境变量配置（默认 `http://localhost:8000`）。

### 数据流

1. 添加账号 → `POST /api/users` → 存入 `users.json`
2. 选中账号 → `POST /api/fetch/{username}` → 抓推文 → AI 摘要 → 返回 `{tweets, summary}`
3. 聊天 → `POST /api/chat`，带 `{messages, tweets}` → OpenRouter SSE 流 → 分块追加到 store

### 每日邮件流程（digest_job.py）

1. `market_data.fetch_market_data()` — 抓取市场数据（~25 秒，Alpha Vantage 限速）
2. `ai.summarize_market(data)` — 生成大盘快报摘要
3. 遍历用户，抓推文 + AI 摘要
4. `emailer.send_digest(sections, market_summary=...)` — 发送邮件

## 环境变量

**`backend/.env`**
```
OPENROUTER_API_KEY=...
OPENROUTER_MODEL=openrouter/auto
GMAIL_USER=...
GMAIL_APP_PASSWORD=...
DIGEST_TO=...
AlphaVantage_API_Key=...
```

**`frontend/.env`**
```
VITE_API_URL=http://localhost:8000
```

## 测试说明

测试通过 `conftest.py` 完整 mock `scraper`、`ai`、`market_data` 模块，不发起真实网络请求。`USERS_PATH` 重定向到 `tmp_path`，每个测试相互隔离。
