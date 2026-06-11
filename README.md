# XDigest

自动追踪 X（Twitter）用户的发言，通过 AI 生成结构化摘要，每天早上 08:30 发送邮件日报。支持对收集到的内容进行聊天式深度追问，并在邮件顶部附带当日**大盘快报**（Fear & Greed 指数 + 板块 ETF 涨跌 + 科技股表现）。

## 功能

- 追踪 X 用户的发言，添加/删除/备注管理
- 按时间段（今天 / 本周 / 本月）抓取推文
- AI 生成结构化中文摘要
  - 主要话题与重要观点
  - 值得关注的信息
  - 看涨/看跌标的列表（附理由）
- 流式 AI 聊天，深度追问收集内容
- 每天 08:30（Asia/Shanghai）发送邮件日报，支持按用户开关订阅
- **大盘快报**：邮件顶部展示当日市场情绪（Fear & Greed）、板块 ETF 涨跌、科技股表现的 AI 中文摘要

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | React + Vite + Tailwind CSS + Zustand |
| 后端 | FastAPI + Python 3.11 |
| 数据采集 | twikit（X 非官方客户端） |
| 市场数据 | feargreedmeter.com + Alpha Vantage 免费 API |
| AI | OpenRouter API（默认：`openrouter/auto`） |
| 定时任务 | macOS launchd（每天 08:30 自动执行） |
| 邮件发送 | Gmail SMTP（SSL） |

## 环境要求

- Python 3.11 及以上
- Node.js 18 及以上
- X 账号（用于登录抓取）
- OpenRouter API Key
- Alpha Vantage API Key（免费，每天 25 次额度）
- Gmail 账号（发送日报邮件，需要应用专用密码）

## 安装

### 后端

```bash
cd backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt

cp .env.example .env
# 编辑 .env，填写所有必要的环境变量
```

### 前端

```bash
cd frontend
npm install
```

## 环境变量

**`backend/.env`**

```env
# OpenRouter
OPENROUTER_API_KEY=your_openrouter_key
OPENROUTER_MODEL=openrouter/auto        # 可替换为任意 OpenRouter 模型

# Gmail 邮件推送（需要 Google 应用专用密码）
GMAIL_USER=your_address@gmail.com
GMAIL_APP_PASSWORD=xxxx-xxxx-xxxx-xxxx
DIGEST_TO=recipient@gmail.com

# Alpha Vantage 市场数据（免费，25 次/天）
AlphaVantage_API_Key=your_alpha_vantage_key
```

> **获取 Gmail 应用专用密码**：Google 账户 → 安全性 → 两步验证 → 应用专用密码 → 生成

**`frontend/.env`**

```env
VITE_API_URL=http://localhost:8000
```

## 启动

**后端**（端口 8000）

```bash
cd backend
source venv/bin/activate
uvicorn main:app --reload
```

**前端**（端口 5173）

```bash
cd frontend
npm run dev
```

浏览器打开 `http://localhost:5173`。

## 使用方式

1. 点击左下角「⚙ X 账号登录」，输入 X 账号密码完成登录（Cookie 保存在本地）
2. 在侧边栏输入框中输入要追踪的 X 用户名，点击添加
3. 点击 ✎ 图标为用户添加备注（便于区分）
4. 点击 ✉ 图标开启/关闭该用户的邮件订阅
5. 选择用户，选择时间段（今天 / 本周 / 本月），点击「获取发言」
6. 查看 AI 摘要，在聊天框中进行深度追问

## 项目结构

```
├── backend/
│   ├── main.py              # FastAPI 路由
│   ├── digest_job.py        # 本地定时执行脚本（无需 FastAPI 服务器）
│   ├── scraper.py           # X 数据抓取（twikit）
│   ├── ai.py                # OpenRouter AI 调用
│   ├── emailer.py           # 邮件生成与发送
│   ├── market_data.py       # 市场数据抓取（Fear & Greed + Alpha Vantage）
│   ├── twikit_patches.py    # twikit 2.3.x 兼容性补丁
│   └── tests/               # 后端单元测试
├── frontend/
│   └── src/
│       ├── store.js          # Zustand 全局状态
│       └── components/       # React 组件
├── feature_list.json         # 功能状态列表
├── progress.md               # 开发进度日志
└── init.sh                   # 环境验证脚本
```

## 本地定时执行（macOS）

每天 08:30 自动发送邮件日报，使用 macOS launchd。无需 FastAPI 服务器常驻。

### 手动执行

```bash
cd backend
venv/bin/python digest_job.py
```

### 注册 launchd

创建文件 `~/Library/LaunchAgents/com.xdigest.digest.plist`（路径根据实际调整）：

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.xdigest.digest</string>
    <key>ProgramArguments</key>
    <array>
        <string>/path/to/x/backend/venv/bin/python</string>
        <string>/path/to/x/backend/digest_job.py</string>
    </array>
    <key>WorkingDirectory</key>
    <string>/path/to/x/backend</string>
    <key>StartCalendarInterval</key>
    <dict>
        <key>Hour</key><integer>8</integer>
        <key>Minute</key><integer>30</integer>
    </dict>
    <key>StandardOutPath</key>
    <string>/Users/your_name/Library/Logs/xdigest.log</string>
    <key>StandardErrorPath</key>
    <string>/Users/your_name/Library/Logs/xdigest.log</string>
    <key>RunAtLoad</key>
    <false/>
</dict>
</plist>
```

注册与验证：

```bash
# 注册
launchctl load ~/Library/LaunchAgents/com.xdigest.digest.plist

# 验证
launchctl list | grep xdigest

# 查看日志
tail -50 ~/Library/Logs/xdigest.log
```

> **休眠说明**：仅关闭屏幕（显示器休眠）时，08:30 正常执行。系统休眠（合盖等）期间跳过，Mac 唤醒后立即补跑。

## 开发

```bash
# 运行后端测试
cd backend && pytest

# 前端 Lint
cd frontend && npm run lint

# 环境验证（测试 + lint）
./init.sh
```
