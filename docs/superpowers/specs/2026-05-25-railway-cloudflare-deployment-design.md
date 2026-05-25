# XDigest 部署设计：Railway（后端）+ Cloudflare Pages（前端）

**日期：** 2026-05-25
**状态：** 待实现

## 背景

XDigest 后端内嵌 APScheduler，每天 08:30 Asia/Shanghai 自动抓取推文并发送 digest 邮件。该定时任务依赖后端进程常驻运行；本地开发服务器无法保证，需部署到云端。

## 架构

```
Cloudflare Pages (前端 React)
  └─ VITE_API_URL → Railway 后端 URL
         │
Railway Service (后端 FastAPI + APScheduler)
  ├─ Volume 挂载到 /data
  │    ├─ users.json   （关注列表，持久化）
  │    └─ cookies.json （X 登录状态，持久化）
  └─ 环境变量
       DATA_DIR=/data
       OPENROUTER_API_KEY
       OPENROUTER_MODEL
       GMAIL_USER
       GMAIL_APP_PASSWORD
       DIGEST_TO
       ALLOWED_ORIGINS
```

## 代码改动

### 1. `backend/scraper.py`
`COOKIES_PATH` 改为读 `DATA_DIR` 环境变量：
```python
DATA_DIR = Path(os.getenv("DATA_DIR", str(Path(__file__).parent)))
COOKIES_PATH = DATA_DIR / "cookies.json"
```

### 2. `backend/main.py`
- `USERS_PATH` 改为读 `DATA_DIR`：
  ```python
  DATA_DIR = Path(os.getenv("DATA_DIR", str(Path(__file__).parent)))
  USERS_PATH = DATA_DIR / "users.json"
  ```
- CORS `allow_origins` 改为读 `ALLOWED_ORIGINS` 环境变量（逗号分隔），默认保留本地地址：
  ```python
  _origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:5173,http://localhost:3000")
  allow_origins=_origins.split(",")
  ```

### 3. 新增 `backend/railway.toml`
```toml
[build]
builder = "NIXPACKS"

[deploy]
startCommand = "uvicorn main:app --host 0.0.0.0 --port $PORT"
```

### 4. 新增 `frontend/public/_redirects`
```
/* /index.html 200
```
让 Cloudflare Pages 正确处理 React SPA 路由。

## 部署流程

### Railway 后端
1. 在 Railway 创建新项目，连接 GitHub 仓库，根目录选 `backend/`
2. 添加 Volume，挂载路径 `/data`
3. 在环境变量面板填写：
   - `DATA_DIR=/data`
   - `OPENROUTER_API_KEY`、`OPENROUTER_MODEL`
   - `GMAIL_USER`、`GMAIL_APP_PASSWORD`、`DIGEST_TO`
   - `ALLOWED_ORIGINS`（部署 Cloudflare Pages 后填写，格式：`https://xxx.pages.dev,http://localhost:5173`）
4. 部署完成，记下后端 URL（`https://xxx.railway.app`）
5. 打开前端页面，通过 LoginModal 登录 X → `cookies.json` 写入 Volume

### Cloudflare Pages 前端
1. 在 Cloudflare Pages 连接同一 GitHub 仓库，根目录选 `frontend/`
2. 构建命令：`npm run build`，输出目录：`dist`
3. 添加环境变量：`VITE_API_URL=https://xxx.railway.app`
4. 部署完成后，把 Cloudflare Pages 域名填回 Railway 的 `ALLOWED_ORIGINS`

## 边界情况

| 场景 | 处理方式 |
|------|----------|
| X 会话过期 | 删除 `/data/cookies.json`（Railway Volume 文件管理）或调用登出接口，再用前端 LoginModal 重新登录 |
| Railway 重新部署 | Volume 数据不受影响；APScheduler 随进程启动自动重新注册 |
| `users.json` 不存在 | `_load_users()` 已有保护，返回空列表 |
| 本地开发 | `DATA_DIR` 未设置时默认 `./`（`backend/` 目录），行为与现在完全一致 |

## 测试验证

- 部署后手动调用 `POST /api/fetch/{username}` 验证 scraper 正常
- 通过前端 LoginModal 登录 X，确认 `/data/cookies.json` 已创建
- 检查 Railway 日志确认 08:30 定时任务触发并发送邮件
