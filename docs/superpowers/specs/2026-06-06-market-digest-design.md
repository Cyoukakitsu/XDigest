# Market Digest 设计文档

**日期：** 2026-06-06  
**状态：** 已批准

## 背景

XDigest 已有每日 8:30 的推文摘要邮件。用户希望在同一封邮件顶部新增一个「大盘快报」板块，提供股票市场当日情绪与板块表现的 AI 中文小结，数据来源为 feargreedmeter.com 和 Alpha Vantage 免费 API。

## 目标

- 在现有 XDigest 邮件顶部插入「大盘快报」块
- AI 用一段话描述：Fear & Greed 分数趋势、板块涨跌数量、亮眼和意外的科技股
- 不新增定时任务，不影响现有推文摘要功能
- Alpha Vantage 每日调用 ≤ 25 次（实际约 11 次）

## 架构

### 文件变动

| 文件 | 变动类型 | 说明 |
|------|---------|------|
| `backend/market_data.py` | 新建 | 抓取 Fear & Greed + Alpha Vantage 数据 |
| `backend/ai.py` | 修改 | 新增 `summarize_market(data)` 函数 |
| `backend/emailer.py` | 修改 | `build_html()` 支持可选 `market_summary` 参数 |
| `backend/digest_job.py` | 修改 | 在发邮件前调用市场数据抓取和 AI 摘要 |

### 数据流

```
digest_job.py
  │
  ├─ market_data.fetch_market_data()
  │     ├─ GET feargreedmeter.com  → fear_greed dict
  │     ├─ GET alphavantage SECTOR → sectors dict (1 次调用)
  │     └─ GET alphavantage GLOBAL_QUOTE × 10 → tech_stocks dict (10 次调用)
  │
  ├─ ai.summarize_market(data) → 中文摘要字符串
  │
  └─ emailer.send_digest(sections, market_summary=summary)
```

## 模块详情

### market_data.py

```python
async def fetch_market_data() -> dict | None
```

返回结构：
```python
{
  "fear_greed": {
    "score": 42,
    "rating": "Fear",
    "yesterday": 54,
    "last_week": 59,
    "last_month": 67
  },
  "sectors": {
    "Information Technology": "+2.3%",
    "Energy": "-0.8%",
    ...  # 全部 11 个 GICS 板块
  },
  "tech_stocks": {
    "NVDA": "+8.2%",
    "AAPL": "+1.1%",
    ...  # AAPL MSFT NVDA GOOGL META AMZN TSLA AMD AVGO ORCL
  }
}
```

失败时返回 `None`，不抛异常（调用方跳过市场块继续发邮件）。

依赖库：`httpx`（已在 venv 中）、`re`/`json`（stdlib）。feargreedmeter.com 数据通过 `__NEXT_DATA__` JSON 提取，无需 beautifulsoup4。

Alpha Vantage API key 从 `.env` 读取：`AlphaVantage_API_Key`。

### ai.py — 新增函数

```python
async def summarize_market(data: dict) -> str
```

Prompt 核心内容（中文输出）：
- Fear & Greed 当前分数、评级、与昨天/上周对比趋势
- 今日上涨板块数 vs 下跌板块数，最强和最弱板块
- 10 支科技股涨跌幅，点出表现亮眼和走势出人意料的个股
- 要求 AI 用 2-3 句话总结，语气简洁专业

### emailer.py — 修改

`build_html(sections, market_summary=None)`：
- 若 `market_summary` 不为 None，在 `<h1>` 标题后、第一个 `@用户` 块前插入：
  ```html
  <h2>📊 大盘快报</h2>
  <p>{market_summary}</p>
  <hr>
  ```

### digest_job.py — 修改

`main()` 函数开头新增：
```python
market_data = await market_data_module.fetch_market_data()
market_summary = await ai.summarize_market(market_data) if market_data else None
```
发邮件时：
```python
emailer.send_digest(sections, market_summary=market_summary)
```

## 错误处理

- `fetch_market_data()` 内部捕获所有异常，失败返回 `None`，记录 warning 日志
- `summarize_market()` 失败时返回 `None`，digest_job 跳过市场块
- 任何市场数据错误不影响推文摘要的正常发送

## Alpha Vantage 调用预算

| 端点 | 调用次数 |
|------|---------|
| GLOBAL_QUOTE（11 支板块 ETF） | 11 |
| GLOBAL_QUOTE（10 支科技股） | 10 |
| **合计** | **21 / 25** |

## 依赖确认

- `httpx` — 已有 ✅
- `re` / `json` / `asyncio` — Python 标准库 ✅
- 无需新增任何第三方依赖
