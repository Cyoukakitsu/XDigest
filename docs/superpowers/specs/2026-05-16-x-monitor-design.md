# X 用户发言监控与 AI 分析工具 — 设计文档

**日期：** 2026-05-16  
**状态：** 已确认，待实现

---

## 1. 背景与目标

个人研究用工具。用户每天追踪 5-20 个 X 平台公开账号，当这些账号发帖过多时难以全部阅读。工具的目标是：点击一个按钮，自动抓取指定用户今日发言，由 AI 生成摘要，并支持针对该内容继续追问。

**核心价值：** 帮助用户消化信息过载，快速掌握关注用户的发言要点。

---

## 2. 整体架构

```
浏览器 (React + Vite + Tailwind)
    │
    │ HTTP / SSE
    ▼
FastAPI 后端 (Python)
    ├── scraper.py     → Twikit（抓取 X 数据）
    ├── ai.py          → OpenRouter API（AI 分析与对话）
    ├── users.json     → 追踪用户列表
    └── cookies.json   → X 登录 Session（gitignore）
```

**部署方案（本地开发完成后）：**
- 前端 → Vercel 或 Cloudflare Pages
- 后端 → Railway（支持持久化 Python 进程，免费套餐够用）
- Cookie 存储 → Railway 环境变量（部署时一行代码改动）

---

## 3. 核心功能

### 3.1 用户列表管理
- 左侧侧栏展示追踪用户列表
- 支持添加用户（输入 X 用户名）和删除用户
- 用户列表持久化存储在 `users.json`

### 3.2 抓取今日发言
- 选中用户后，点击「抓取今日发言」按钮
- 后端调用 Twikit 抓取该用户最近 24 小时内的推文
- 抓取范围：原创推文 + 转发，单次最多 50 条
- 抓取完成后自动调用 OpenRouter 生成摘要

### 3.3 AI 摘要
- 将所有抓取到的推文打包作为上下文
- 调用 OpenRouter 免费模型生成结构化摘要
- 摘要展示在主区域，包含：主要话题、关键观点、值得关注的内容

### 3.4 聊天对话
- 摘要下方提供聊天输入框
- 用户可针对该用户今日发言继续追问
- 每次对话携带：系统提示 + 原始推文上下文 + 当次聊天历史
- AI 回复通过 SSE 流式输出（逐字显示）
- 切换用户时聊天历史清空，刷新页面后清空

---

## 4. 数据流

```
1. 首次启动
   └─► 输入 X 账号密码 → Twikit 登录 → 保存 cookies.json

2. 日常使用
   点击用户名
   └─► 点击「抓取今日发言」
       └─► POST /api/fetch/{username}
           └─► Twikit 抓取最近 24h 推文（最多 50 条）
               └─► 推文列表 → OpenRouter → 生成摘要
                   └─► 摘要显示在页面

3. 追问
   输入问题 → POST /api/chat
   └─► 携带 [系统提示 + 原始推文 + 历史对话 + 新问题]
       └─► OpenRouter 流式回复 → SSE → 前端逐字渲染
```

---

## 5. API 接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/users` | 获取追踪用户列表 |
| POST | `/api/users` | 添加用户 `{username}` |
| DELETE | `/api/users/{username}` | 删除用户 |
| POST | `/api/fetch/{username}` | 抓取指定用户今日推文并生成摘要 |
| POST | `/api/chat` | 聊天对话（SSE 流式）|
| POST | `/api/login` | X 账号登录（首次使用）|

---

## 6. 技术栈

| 层级 | 技术 | 说明 |
|------|------|------|
| 后端框架 | FastAPI + uvicorn | 轻量，支持 SSE 流式响应 |
| X 数据抓取 | Twikit | 无需官方 API Key，使用账号凭证 |
| AI 调用 | OpenRouter API（免费模型） | 兼容 OpenAI 格式，用 httpx 调用 |
| 前端框架 | React + Vite | 快速开发，热重载 |
| 前端样式 | Tailwind CSS | 无需手写 CSS |
| 前端状态 | Zustand | 轻量状态管理 |
| 流式输出 | SSE（Server-Sent Events） | AI 回复逐字流式显示 |

---

## 7. 项目目录结构

```
x/
├── backend/
│   ├── main.py          # FastAPI 入口，路由定义
│   ├── scraper.py       # Twikit 抓取逻辑
│   ├── ai.py            # OpenRouter 调用 + 流式输出
│   ├── users.json       # 追踪用户列表
│   ├── cookies.json     # X 登录凭证（已加入 .gitignore）
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── components/
│   │   │   ├── Sidebar.jsx      # 用户列表侧栏
│   │   │   ├── Summary.jsx      # AI 摘要展示
│   │   │   └── ChatBox.jsx      # 聊天对话框
│   │   └── store.js             # Zustand 全局状态
│   ├── index.html
│   └── package.json
├── .env                 # OpenRouter API Key（已加入 .gitignore）
├── .gitignore
└── docs/
    └── superpowers/specs/
        └── 2026-05-16-x-monitor-design.md
```

---

## 8. 错误处理

| 场景 | 处理方式 |
|------|---------|
| 目标用户今日无发帖 | 提示「该用户今日暂无发言」 |
| Twikit 登录过期 | 提示重新登录，引导输入账号密码 |
| X 限流（临时封锁） | 提示「请稍后再试」，返回 429 状态码 |
| 用户名不存在 | 提示「找不到该用户」 |
| OpenRouter 无可用额度 | 显示错误信息，提示更换免费模型 |

---

## 9. 不在范围内

- 不存储历史抓取记录（每次按需抓取）
- 不支持私密账号（仅限公开账号）
- 不做用户认证（工具仅供个人使用）
- 不支持搜索或过滤推文
- 暂不支持定时自动推送（按需查询即可）

---

## 10. 部署路径

1. 本地开发与调试完成
2. 推送到 GitHub 仓库
3. 前端：连接 Vercel / Cloudflare Pages，自动构建
4. 后端：连接 Railway，设置环境变量（OpenRouter Key、X Cookie）
5. 前端配置后端 API 地址环境变量
