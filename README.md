# XDigest

追踪 X（推特）用户的发言，自动生成 AI 摘要，并支持针对内容进行对话提问。

## 功能

- 添加/删除需要追踪的 X 用户
- 按时间段（今日 / 本周 / 本月）抓取用户发言
- AI 自动生成结构化摘要，包含：
  - 主要话题与关键观点
  - 值得关注的内容
  - 强烈看多 / 看空的股票列表（含理由）
- 针对抓取内容进行流式 AI 对话

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | React + Vite + Tailwind CSS + Zustand |
| 后端 | FastAPI + Python |
| 数据采集 | twikit（X 非官方客户端） |
| AI | OpenRouter API（默认 `openrouter/auto`） |

## 快速开始

### 环境要求

- Python 3.11+
- Node.js 18+

### 后端

```bash
cd backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt

# 配置环境变量
cp .env.example .env
# 编辑 .env，填入 OPENROUTER_API_KEY

uvicorn main:app --reload
```

### 前端

```bash
cd frontend
npm install
npm run dev
```

前端默认运行在 `http://localhost:5173`，后端运行在 `http://localhost:8000`。

## 配置

**`backend/.env`**

```env
OPENROUTER_API_KEY=your_key_here
OPENROUTER_MODEL=openrouter/auto   # 可替换为任意 OpenRouter 模型
```

**`frontend/.env`**

```env
VITE_API_URL=http://localhost:8000
```

## 使用方式

1. 启动前后端服务
2. 点击左下角「X 账号登录」，输入 X 账号凭证完成登录（Cookie 保存在本地）
3. 在左侧输入框添加要追踪的 X 用户名
4. 选择时间段（今日 / 本週 / 本月），点击「抓取发言」
5. 查看 AI 摘要，或在下方对话框针对内容提问

## 项目结构

```
├── backend/
│   ├── main.py              # FastAPI 路由
│   ├── scraper.py           # X 数据采集（twikit）
│   ├── ai.py                # OpenRouter AI 调用
│   ├── twikit_patches.py    # twikit 2.3.x 兼容性补丁
│   └── tests/               # 后端单元测试
└── frontend/
    └── src/
        ├── store.js          # Zustand 全局状态
        └── components/       # React 组件
```

## 开发

```bash
# 运行后端测试
cd backend && pytest

# 前端代码检查
cd frontend && npm run lint
```
