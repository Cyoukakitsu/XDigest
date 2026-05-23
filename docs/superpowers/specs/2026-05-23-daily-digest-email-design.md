# XDigest 每日邮件摘要 — 设计文档

**日期**：2026-05-23  
**状态**：已确认，待实现

---

## 概述

在现有 XDigest（FastAPI + twikit + OpenRouter）的基础上，新增每日自动邮件摘要功能：
每天北京时间 08:30，自动抓取监控列表中已勾选账号的最新推文，通过 AI 生成总结，合并为一封 HTML 邮件发送到指定收件人。

---

## 目标与范围

- **目标**：零手动操作，每天早晨收到一封包含所有关注账号摘要的邮件
- **不在范围内**：多收件人、邮件模板自定义、历史摘要存档、前端订阅管理页面

---

## 方案选择

采用**方案 A（最小侵入式）**：
- APScheduler（asyncio 模式）内置到 FastAPI `lifespan`，无需额外进程
- Gmail SMTP（Python `smtplib`），无需第三方邮件服务商
- 不新增手动触发端点，保持代码最简

---

## 数据层

### `users.json` 结构扩展

每条用户记录新增 `digest` 布尔字段（默认 `true`）：

```json
[
  { "username": "octopusycc",     "note": "", "digest": true },
  { "username": "aleabitoreddit", "note": "", "digest": false },
  { "username": "SayNoToTrading", "note": "", "digest": true }
]
```

向后兼容：`_load_users()` 读取时若缺少 `digest` 字段，默认视为 `true`。

### 新增 API 端点

`PATCH /api/users/{username}` — 接收 `{ "digest": true/false }`，更新对应用户的 digest 开关。

---

## 新增模块：`backend/emailer.py`

职责：构建 HTML 邮件并通过 Gmail SMTP 发送。

### 环境变量（写入 `backend/.env`）

```
GMAIL_USER=你的Gmail地址@gmail.com
GMAIL_APP_PASSWORD=xxxx-xxxx-xxxx-xxxx
DIGEST_TO=收件人地址@gmail.com
```

`GMAIL_APP_PASSWORD` 需在 Google 账号的"应用专用密码"处生成，非账号登录密码。

### 邮件格式

- **主题**：`XDigest 早报 · YYYY-MM-DD`
- **正文**：HTML，每个用户一节
  - 节标题：`@username`
  - AI 总结内容（Markdown 转 HTML，使用 `markdown` 库）
  - 末尾注明推文条数
  - 若当天无推文：显示"暂无发言"，跳过 AI 调用

### 错误处理

发送失败时用 `logging.error()` 记录到 stderr，不抛出异常，不影响 uvicorn 正常运行。

---

## 调度器集成（`main.py`）

使用 FastAPI `lifespan` 上下文管理器：

```python
from contextlib import asynccontextmanager
from apscheduler.schedulers.asyncio import AsyncIOScheduler

@asynccontextmanager
async def lifespan(app: FastAPI):
    scheduler = AsyncIOScheduler(timezone="Asia/Shanghai")
    scheduler.add_job(run_daily_digest, "cron", hour=8, minute=30)
    scheduler.start()
    yield
    scheduler.shutdown()

app = FastAPI(lifespan=lifespan)
```

### `run_daily_digest` 执行流程

1. 读取 `users.json`，筛出 `digest == true` 的账号
2. 检查 `cookies.json` 是否存在（未登录则记录警告并跳过）
3. 逐个调用 `scraper.fetch_tweets(username, days=1)`
4. 有推文 → 调用 `ai.summarize(tweets, days=1)`
5. 无推文 → 标注"暂无发言"
6. 汇总所有结果调用 `emailer.send_digest(sections)`

**时区**：固定 `Asia/Shanghai`（北京时间 08:30）。

---

## 依赖变更

`backend/requirements.txt` 新增：

```
apscheduler>=3.10
markdown>=3.6
```

---

## 文件变更清单

| 文件 | 变更类型 | 说明 |
|------|----------|------|
| `backend/requirements.txt` | 修改 | 新增 `apscheduler`、`markdown` |
| `backend/.env.example` | 修改 | 新增 Gmail 相关变量示例 |
| `backend/emailer.py` | 新建 | HTML 邮件构建与发送 |
| `backend/main.py` | 修改 | 新增 `lifespan`、`run_daily_digest`、`PATCH /api/users/{username}` |
| `frontend/src/components/Sidebar.jsx` | 修改 | 每个用户行新增 digest 开关（checkbox） |
| `frontend/src/store.js` | 修改 | 新增 `toggleDigest` action，调用 `PATCH /api/users/{username}` |

---

## 测试策略

- `emailer.py` 中 SMTP 发送部分保持可 mock（接受 `smtp_class` 参数，默认为 `smtplib.SMTP_SSL`）
- `run_daily_digest` 依赖的 `scraper` 和 `ai` 已有 mock fixture，可直接复用
- 不对调度器本身写集成测试，触发逻辑在单元层覆盖即可
