# Market Digest 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在每日 XDigest 邮件顶部插入「大盘快报」，用 AI 生成一段中文摘要，涵盖 Fear & Greed 指数趋势、板块涨跌数量、亮眼和意外的科技股表现。

**Architecture:** 新建 `market_data.py` 负责抓取数据（feargreedmeter.com + Alpha Vantage GLOBAL_QUOTE），在 `ai.py` 新增 `summarize_market()` 调 OpenRouter 生成摘要，修改 `emailer.py` 在邮件顶部插入市场块，修改 `main.py` 和 `digest_job.py` 串联调用流程。

**Tech Stack:** Python asyncio, httpx, Alpha Vantage GLOBAL_QUOTE API, OpenRouter, Gmail SMTP

---

## 文件清单

| 操作 | 路径 |
|------|------|
| 新建 | `backend/market_data.py` |
| 新建 | `backend/tests/test_market_data.py` |
| 修改 | `backend/ai.py` — 新增 `summarize_market()` |
| 修改 | `backend/tests/test_ai.py` — 新增对应测试 |
| 修改 | `backend/emailer.py` — `build_html()` 和 `send_digest()` 支持 `market_summary` |
| 修改 | `backend/tests/test_emailer.py` — 新增对应测试 |
| 修改 | `backend/main.py` — `run_daily_digest()` 调用市场数据 |
| 修改 | `backend/digest_job.py` — `main()` 调用市场数据 |
| 修改 | `backend/tests/test_digest.py` — 更新测试覆盖市场数据 |

---

## Task 1: 创建 market_data.py

**Files:**
- Create: `backend/market_data.py`
- Create: `backend/tests/test_market_data.py`

- [ ] **Step 1: 写失败测试**

新建 `backend/tests/test_market_data.py`：

```python
import json
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import pytest
import httpx
from unittest.mock import AsyncMock, MagicMock, patch

import market_data

# ---------- helpers ----------

FAKE_FGI_JSON = json.dumps({
    "props": {
        "pageProps": {
            "data": {
                "fgi": {
                    "latest": {
                        "now": 42,
                        "previous_close": 54,
                        "one_week_ago": 59,
                        "one_month_ago": 67,
                        "date": "2026-06-06",
                    }
                }
            }
        }
    }
})
FAKE_HTML = f'<script id="__NEXT_DATA__" type="application/json">{FAKE_FGI_JSON}</script>'

FAKE_QUOTE = {"Global Quote": {"10. change percent": "+2.3456%"}}


def _make_response(*, text=None, json_data=None):
    mock = MagicMock()
    mock.raise_for_status = MagicMock()
    if text is not None:
        mock.text = text
    if json_data is not None:
        mock.json = MagicMock(return_value=json_data)
    return mock


def _make_client(fear_html, quote_json):
    async def mock_get(url, **kwargs):
        if "feargreedmeter" in url:
            return _make_response(text=fear_html)
        return _make_response(json_data=quote_json)

    client = MagicMock()
    client.get = mock_get
    client.__aenter__ = AsyncMock(return_value=client)
    client.__aexit__ = AsyncMock(return_value=False)
    return client


# ---------- tests ----------

def test_score_to_rating_boundaries():
    assert market_data._score_to_rating(0) == "Extreme Fear"
    assert market_data._score_to_rating(24) == "Extreme Fear"
    assert market_data._score_to_rating(25) == "Fear"
    assert market_data._score_to_rating(44) == "Fear"
    assert market_data._score_to_rating(45) == "Neutral"
    assert market_data._score_to_rating(54) == "Neutral"
    assert market_data._score_to_rating(55) == "Greed"
    assert market_data._score_to_rating(74) == "Greed"
    assert market_data._score_to_rating(75) == "Extreme Greed"
    assert market_data._score_to_rating(100) == "Extreme Greed"


@pytest.mark.asyncio
async def test_fetch_market_data_structure(monkeypatch):
    monkeypatch.setenv("AlphaVantage_API_Key", "test-key")
    client = _make_client(FAKE_HTML, FAKE_QUOTE)
    with patch("market_data.httpx.AsyncClient", return_value=client):
        with patch("market_data.asyncio.sleep", new=AsyncMock()):
            result = await market_data.fetch_market_data()

    assert result is not None
    assert result["fear_greed"]["score"] == 42
    assert result["fear_greed"]["rating"] == "Fear"
    assert result["fear_greed"]["previous_close"] == 54
    assert result["fear_greed"]["one_week_ago"] == 59
    assert result["fear_greed"]["one_month_ago"] == 67
    assert "科技" in result["sectors"]
    assert "金融" in result["sectors"]
    assert "NVDA" in result["tech_stocks"]
    assert "AAPL" in result["tech_stocks"]
    assert len(result["sectors"]) == 11
    assert len(result["tech_stocks"]) == 10


@pytest.mark.asyncio
async def test_fetch_market_data_returns_none_without_api_key(monkeypatch):
    monkeypatch.delenv("AlphaVantage_API_Key", raising=False)
    result = await market_data.fetch_market_data()
    assert result is None


@pytest.mark.asyncio
async def test_fetch_market_data_returns_none_on_network_error(monkeypatch):
    monkeypatch.setenv("AlphaVantage_API_Key", "test-key")

    async def boom(url, **kwargs):
        raise httpx.RequestError("timeout")

    client = MagicMock()
    client.get = boom
    client.__aenter__ = AsyncMock(return_value=client)
    client.__aexit__ = AsyncMock(return_value=False)

    with patch("market_data.httpx.AsyncClient", return_value=client):
        result = await market_data.fetch_market_data()

    assert result is None
```

- [ ] **Step 2: 运行测试，确认失败**

```bash
cd backend && source venv/bin/activate
pytest tests/test_market_data.py -v
```

预期：`ModuleNotFoundError: No module named 'market_data'`

- [ ] **Step 3: 创建 market_data.py**

新建 `backend/market_data.py`：

```python
"""Fetches daily market sentiment and sector/stock performance."""
import asyncio
import json
import logging
import os
import re

import httpx

logger = logging.getLogger(__name__)

SECTOR_ETFS: dict[str, str] = {
    "XLK": "科技",
    "XLF": "金融",
    "XLE": "能源",
    "XLY": "非必需消费",
    "XLU": "公用事业",
    "XLI": "工业",
    "XLB": "材料",
    "XLC": "通信服务",
    "XLRE": "房地产",
    "XLP": "必需消费",
    "XLV": "医疗",
}

TECH_STOCKS: list[str] = [
    "AAPL", "MSFT", "NVDA", "GOOGL", "META",
    "AMZN", "TSLA", "AMD", "AVGO", "ORCL",
]

_RATING_THRESHOLDS: list[tuple[int, str]] = [
    (75, "Extreme Greed"),
    (55, "Greed"),
    (45, "Neutral"),
    (25, "Fear"),
    (0,  "Extreme Fear"),
]


def _score_to_rating(score: int) -> str:
    for threshold, label in _RATING_THRESHOLDS:
        if score >= threshold:
            return label
    return "Extreme Fear"


async def _fetch_fear_greed(client: httpx.AsyncClient) -> dict:
    resp = await client.get(
        "https://feargreedmeter.com/",
        headers={"User-Agent": "Mozilla/5.0 (compatible; XDigest/1.0)"},
        follow_redirects=True,
    )
    resp.raise_for_status()
    match = re.search(
        r'<script id="__NEXT_DATA__"[^>]*>(.*?)</script>',
        resp.text,
        re.DOTALL,
    )
    if not match:
        raise ValueError("__NEXT_DATA__ not found in feargreedmeter.com response")
    raw = json.loads(match.group(1))
    latest = raw["props"]["pageProps"]["data"]["fgi"]["latest"]
    score = latest["now"]
    return {
        "score": score,
        "rating": _score_to_rating(score),
        "previous_close": latest["previous_close"],
        "one_week_ago": latest["one_week_ago"],
        "one_month_ago": latest["one_month_ago"],
    }


async def _fetch_quotes(
    client: httpx.AsyncClient,
    symbols: list[str],
    api_key: str,
) -> dict[str, str]:
    results: dict[str, str] = {}
    for i, symbol in enumerate(symbols):
        if i > 0:
            await asyncio.sleep(1.2)  # Alpha Vantage free tier: 1 req/sec
        resp = await client.get(
            "https://www.alphavantage.co/query",
            params={"function": "GLOBAL_QUOTE", "symbol": symbol, "apikey": api_key},
        )
        resp.raise_for_status()
        pct = resp.json().get("Global Quote", {}).get("10. change percent", "N/A")
        results[symbol] = pct
    return results


async def fetch_market_data() -> dict | None:
    api_key = os.getenv("AlphaVantage_API_Key")
    if not api_key:
        logger.warning("AlphaVantage_API_Key not set, skipping market data")
        return None
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            fear_greed = await _fetch_fear_greed(client)
            all_symbols = list(SECTOR_ETFS.keys()) + TECH_STOCKS
            quotes = await _fetch_quotes(client, all_symbols, api_key)
        sectors = {SECTOR_ETFS[sym]: quotes[sym] for sym in SECTOR_ETFS}
        tech_stocks = {sym: quotes[sym] for sym in TECH_STOCKS}
        return {"fear_greed": fear_greed, "sectors": sectors, "tech_stocks": tech_stocks}
    except Exception as e:
        logger.warning("Failed to fetch market data: %s", e)
        return None
```

- [ ] **Step 4: 运行测试，确认通过**

```bash
pytest tests/test_market_data.py -v
```

预期：全部 PASS

- [ ] **Step 5: Commit**

```bash
git add backend/market_data.py backend/tests/test_market_data.py
git commit -m "feat: add market_data module to fetch Fear&Greed and sector/tech-stock quotes"
```

---

## Task 2: 在 ai.py 中新增 summarize_market()

**Files:**
- Modify: `backend/ai.py`
- Modify: `backend/tests/test_ai.py`

- [ ] **Step 1: 写失败测试**

在 `backend/tests/test_ai.py` 末尾追加：

```python
SAMPLE_MARKET_DATA = {
    "fear_greed": {
        "score": 42,
        "rating": "Fear",
        "previous_close": 54,
        "one_week_ago": 59,
        "one_month_ago": 67,
    },
    "sectors": {
        "科技": "-6.66%", "金融": "+0.21%", "能源": "-1.84%",
        "非必需消费": "+0.50%", "公用事业": "-0.30%", "工业": "+0.10%",
        "材料": "-0.80%", "通信服务": "+1.20%", "房地产": "-0.50%",
        "必需消费": "+0.05%", "医疗": "-0.20%",
    },
    "tech_stocks": {
        "AAPL": "+1.10%", "MSFT": "+0.80%", "NVDA": "-6.20%",
        "GOOGL": "+2.30%", "META": "+3.10%", "AMZN": "+1.50%",
        "TSLA": "-2.40%", "AMD": "-4.10%", "AVGO": "+0.90%", "ORCL": "-3.10%",
    },
}


@pytest.mark.asyncio
async def test_summarize_market_returns_string():
    mock_response = MagicMock()
    mock_response.raise_for_status = MagicMock()
    mock_response.json.return_value = {
        "choices": [{"message": {"content": "今日市场情绪偏恐惧，科技板块承压。"}}]
    }

    mock_client = AsyncMock()
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=None)
    mock_client.post = AsyncMock(return_value=mock_response)

    with patch("ai.httpx.AsyncClient", return_value=mock_client):
        with patch.dict("os.environ", {"OPENROUTER_API_KEY": "test-key"}):
            import importlib
            import ai as ai_module
            importlib.reload(ai_module)
            result = await ai_module.summarize_market(SAMPLE_MARKET_DATA)
            assert isinstance(result, str)
            assert len(result) > 0

    # Verify the prompt sent to OpenRouter contains key market info
    call_args = mock_client.post.call_args
    sent_body = call_args[1]["json"] if "json" in call_args[1] else call_args[0][1]
    prompt_text = sent_body["messages"][0]["content"]
    assert "42" in prompt_text       # fear & greed score
    assert "科技" in prompt_text      # sector name
    assert "NVDA" in prompt_text     # tech stock
```

- [ ] **Step 2: 运行测试，确认失败**

```bash
pytest tests/test_ai.py::test_summarize_market_returns_string -v
```

预期：`AttributeError: module 'ai' has no attribute 'summarize_market'`

- [ ] **Step 3: 在 ai.py 末尾追加 summarize_market()**

在 `backend/ai.py` 末尾追加：

```python
def _format_market_data(data: dict) -> str:
    fg = data["fear_greed"]
    sectors = data["sectors"]
    tech = data["tech_stocks"]

    def to_float(pct: str) -> float:
        try:
            return float(pct.strip("%+").replace(",", ""))
        except ValueError:
            return 0.0

    sorted_sectors = sorted(sectors.items(), key=lambda x: to_float(x[1]), reverse=True)
    sorted_tech = sorted(tech.items(), key=lambda x: to_float(x[1]), reverse=True)
    up_count = sum(1 for _, v in sectors.items() if to_float(v) >= 0)
    down_count = len(sectors) - up_count

    lines = [
        f"Fear & Greed 指数：{fg['score']}（{fg['rating']}）",
        f"昨日：{fg['previous_close']}  上周：{fg['one_week_ago']}  上月：{fg['one_month_ago']}",
        "",
        f"今日板块：{up_count} 个上涨，{down_count} 个下跌",
        "板块涨跌排行（从高到低）：",
    ]
    for name, pct in sorted_sectors:
        lines.append(f"  {name}: {pct}")
    lines.append("")
    lines.append("科技股表现：")
    for sym, pct in sorted_tech:
        lines.append(f"  {sym}: {pct}")
    return "\n".join(lines)


async def summarize_market(data: dict) -> str:
    market_text = _format_market_data(data)
    messages = [
        {
            "role": "user",
            "content": (
                "你是专业的美股市场分析师，请根据以下今日市场数据，用2-3句简洁的中文描述当日市场状态。\n\n"
                "重点描述：\n"
                "1. 市场整体情绪及其较近期的变化趋势\n"
                "2. 今日几个板块上涨、几个板块下跌，点出表现最强和最弱的板块\n"
                "3. 科技股中表现亮眼的（涨幅突出）和出人意料的（涨跌幅与市场预期明显背离）个股\n\n"
                "语气专业简洁，不超过3句话。\n\n"
                f"今日数据：\n{market_text}"
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
```

- [ ] **Step 4: 运行测试，确认通过**

```bash
pytest tests/test_ai.py -v
```

预期：全部 PASS

- [ ] **Step 5: Commit**

```bash
git add backend/ai.py backend/tests/test_ai.py
git commit -m "feat: add summarize_market() to ai module for daily market digest"
```

---

## Task 3: 修改 emailer.py 支持 market_summary

**Files:**
- Modify: `backend/emailer.py`
- Modify: `backend/tests/test_emailer.py`

- [ ] **Step 1: 写失败测试**

在 `backend/tests/test_emailer.py` 末尾追加：

```python
def test_build_html_with_market_summary_shows_block():
    sections = [{"username": "alice", "summary": "内容", "tweet_count": 3}]
    html = emailer.build_html(sections, market_summary="今日市场情绪偏恐惧，科技板块承压。")
    assert "大盘快报" in html
    assert "今日市场情绪偏恐惧" in html


def test_build_html_without_market_summary_has_no_block():
    sections = [{"username": "alice", "summary": "内容", "tweet_count": 3}]
    html = emailer.build_html(sections)
    assert "大盘快报" not in html


def test_send_digest_passes_market_summary_to_build_html(monkeypatch):
    monkeypatch.setenv("GMAIL_USER", "sender@gmail.com")
    monkeypatch.setenv("GMAIL_APP_PASSWORD", "app-pass")
    monkeypatch.setenv("DIGEST_TO", "receiver@gmail.com")

    mock_server = MagicMock()
    mock_smtp_cls = MagicMock()
    mock_smtp_cls.return_value.__enter__ = MagicMock(return_value=mock_server)
    mock_smtp_cls.return_value.__exit__ = MagicMock(return_value=False)

    sections = [{"username": "alice", "summary": "内容", "tweet_count": 2}]
    emailer.send_digest(sections, smtp_class=mock_smtp_cls, market_summary="大盘摘要内容")

    args = mock_server.sendmail.call_args[0]
    raw_email = args[2]
    assert "大盘快报" in raw_email
    assert "大盘摘要内容" in raw_email
```

- [ ] **Step 2: 运行测试，确认失败**

```bash
pytest tests/test_emailer.py::test_build_html_with_market_summary_shows_block -v
```

预期：`FAILED` — `build_html()` 不接受 `market_summary` 参数

- [ ] **Step 3: 修改 emailer.py**

将 `build_html` 和 `send_digest` 替换为：

```python
def build_html(sections: list[dict], market_summary: str | None = None) -> str:
    today = date.today().strftime("%Y-%m-%d")
    parts = [
        "<html><body>",
        f"<h1>XDigest 早报 &middot; {today}</h1>",
        "<hr>",
    ]
    if market_summary:
        parts.append("<h2>📊 大盘快报</h2>")
        parts.append(f"<p>{html.escape(market_summary)}</p>")
        parts.append("<hr>")
    for s in sections:
        parts.append(f"<h2>@{html.escape(s['username'])}</h2>")
        if s["summary"]:
            summary = re.sub(r'(?<!\n)\n(\|)', r'\n\n\1', s["summary"])
            parts.append(md_lib.markdown(summary, extensions=["tables"]))
            parts.append(f"<p><small>共 {s['tweet_count']} 条推文</small></p>")
        else:
            parts.append("<p><em>暂无发言</em></p>")
        parts.append("<hr>")
    parts.append("</body></html>")
    return "\n".join(parts)


def send_digest(
    sections: list[dict],
    *,
    smtp_class=None,
    market_summary: str | None = None,
) -> None:
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
    html_body = build_html(sections, market_summary=market_summary)

    msg = MIMEMultipart("alternative")
    msg["Subject"] = f"XDigest 早报 · {today}"
    msg["From"] = gmail_user
    msg["To"] = to_addr
    msg.attach(MIMEText(html_body, "html", "utf-8"))

    try:
        with smtp_class("smtp.gmail.com", 465) as server:
            server.login(gmail_user, app_password)
            server.sendmail(gmail_user, to_addr, msg.as_string())
        logger.info("Daily digest sent to %s", to_addr)
    except Exception as e:
        logger.error("Failed to send daily digest: %s", e)
```

- [ ] **Step 4: 运行测试，确认全部通过**

```bash
pytest tests/test_emailer.py -v
```

预期：全部 PASS（包括原有测试）

- [ ] **Step 5: Commit**

```bash
git add backend/emailer.py backend/tests/test_emailer.py
git commit -m "feat: emailer supports optional market_summary block at top of digest email"
```

---

## Task 4: 修改 main.py 和 digest_job.py 串联市场数据

**Files:**
- Modify: `backend/main.py:172-195`
- Modify: `backend/digest_job.py:42-76`
- Modify: `backend/tests/test_digest.py`

- [ ] **Step 1: 写失败测试**

在 `backend/tests/test_digest.py` 的 `digest_env` fixture 中，为 `sys.modules` 添加 `market_data` mock。在文件顶部 import 区域之后，修改 `digest_env` fixture：

```python
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
    mock_ai.summarize_market = AsyncMock(return_value="今日市场情绪偏恐惧。")

    mock_emailer = MagicMock()
    mock_emailer.send_digest = MagicMock()

    mock_market_data = MagicMock()
    mock_market_data.fetch_market_data = AsyncMock(return_value={
        "fear_greed": {"score": 42, "rating": "Fear",
                       "previous_close": 54, "one_week_ago": 59, "one_month_ago": 67},
        "sectors": {"科技": "-6.66%"},
        "tech_stocks": {"NVDA": "-6.20%"},
    })

    saved = {k: sys.modules.get(k) for k in ("scraper", "ai", "emailer", "main", "market_data")}
    sys.modules["scraper"] = mock_scraper
    sys.modules["ai"] = mock_ai
    sys.modules["emailer"] = mock_emailer
    sys.modules["market_data"] = mock_market_data
    sys.modules.pop("main", None)

    import main
    monkeypatch.setattr(main, "USERS_PATH", users_path)

    yield main, users_path, mock_scraper, mock_ai, mock_emailer, mock_market_data

    for key, val in saved.items():
        if val is None:
            sys.modules.pop(key, None)
        else:
            sys.modules[key] = val
```

然后在文件末尾追加两个新测试（注意旧测试的 fixture 解包也需要更新为 6 个值，更新现有 4 个测试的解包行）：

将所有现有测试中的：
```python
main, users_path, mock_scraper, mock_ai, mock_emailer = digest_env
```
改为：
```python
main, users_path, mock_scraper, mock_ai, mock_emailer, mock_market_data = digest_env
```

再追加：
```python
@pytest.mark.asyncio
async def test_run_daily_digest_includes_market_summary(digest_env):
    main, users_path, mock_scraper, mock_ai, mock_emailer, mock_market_data = digest_env
    users_path.write_text(json.dumps([
        {"username": "alice", "note": "", "digest": True}
    ]))

    await main.run_daily_digest()

    mock_market_data.fetch_market_data.assert_awaited_once()
    mock_ai.summarize_market.assert_awaited_once()
    call_kwargs = mock_emailer.send_digest.call_args[1]
    assert call_kwargs.get("market_summary") == "今日市场情绪偏恐惧。"


@pytest.mark.asyncio
async def test_run_daily_digest_sends_without_market_on_failure(digest_env):
    main, users_path, mock_scraper, mock_ai, mock_emailer, mock_market_data = digest_env
    mock_market_data.fetch_market_data = AsyncMock(return_value=None)
    users_path.write_text(json.dumps([
        {"username": "alice", "note": "", "digest": True}
    ]))

    await main.run_daily_digest()

    mock_emailer.send_digest.assert_called_once()
    call_kwargs = mock_emailer.send_digest.call_args[1]
    assert call_kwargs.get("market_summary") is None
```

- [ ] **Step 2: 运行测试，确认失败**

```bash
pytest tests/test_digest.py -v
```

预期：新测试 FAIL（`run_daily_digest` 还没调用 `market_data`）

- [ ] **Step 3: 修改 main.py 的 run_daily_digest()**

在 `backend/main.py` 顶部 import 区追加：

```python
import market_data as market_data_mod
```

将 `run_daily_digest()` 函数（约 172-195 行）替换为：

```python
async def run_daily_digest() -> None:
    users = [u for u in _load_users() if u.get("digest", True)]
    if not users:
        return

    if not scraper.COOKIES_PATH.exists():
        logging.warning("Daily digest skipped: not logged in to X")
        return

    market_info = await market_data_mod.fetch_market_data()
    market_summary = await ai.summarize_market(market_info) if market_info else None

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
        emailer.send_digest(sections, market_summary=market_summary)
```

- [ ] **Step 4: 运行测试，确认通过**

```bash
pytest tests/test_digest.py -v
```

预期：全部 PASS

- [ ] **Step 5: 修改 digest_job.py 的 main()**

在 `backend/digest_job.py` 顶部 import 区追加：

```python
import market_data as market_data_mod
```

将 `main()` 函数中的发邮件部分（`sections = []` 到结尾）替换为：

```python
    logger.info("Fetching market data ...")
    market_info = await market_data_mod.fetch_market_data()
    market_summary = None
    if market_info:
        market_summary = await ai.summarize_market(market_info)
        logger.info("Market summary generated.")
    else:
        logger.warning("Market data unavailable, digest will have no market block.")

    logger.info("Starting digest for %d user(s): %s", len(users), [u["username"] for u in users])

    sections = []
    for user in users:
        username = user["username"]
        try:
            logger.info("Fetching tweets for @%s ...", username)
            tweets = await scraper.fetch_tweets(username, days=1)
            summary = await ai.summarize(tweets, days=1) if tweets else None
            sections.append({
                "username": username,
                "summary": summary,
                "tweet_count": len(tweets),
            })
            logger.info("  @%s: %d tweets", username, len(tweets))
        except Exception as e:
            logger.error("  @%s failed: %s", username, e)

    if not sections:
        logger.warning("All users failed, no email sent.")
        return

    logger.info("Sending digest email ...")
    emailer.send_digest(sections, market_summary=market_summary)
    logger.info("Done.")
```

- [ ] **Step 6: 运行所有测试**

```bash
pytest -v
```

预期：全部 PASS

- [ ] **Step 7: Commit**

```bash
git add backend/main.py backend/digest_job.py backend/tests/test_digest.py
git commit -m "feat: wire market data into daily digest email in main.py and digest_job.py"
```

---

## Task 5: 手动验证端到端

- [ ] **Step 1: 手动运行 market_data 验证实际 API 可用**

```bash
cd backend && source venv/bin/activate
python3 -c "
import asyncio
from dotenv import load_dotenv
load_dotenv('.env')
import market_data
result = asyncio.run(market_data.fetch_market_data())
if result:
    print('Fear&Greed:', result['fear_greed'])
    print('Sectors (up):', sum(1 for v in result['sectors'].values() if not v.startswith('-')))
    print('Tech top:', sorted(result['tech_stocks'].items(), key=lambda x: float(x[1].strip('%+').replace(',','')), reverse=True)[:3])
else:
    print('FAILED: returned None')
"
```

预期：打印真实的 Fear & Greed 分数和板块/科技股涨跌数据

- [ ] **Step 2: 手动运行 digest_job 发送测试邮件**

```bash
python3 digest_job.py
```

预期：日志显示 Market summary generated，邮件发送成功，收件箱收到含「大盘快报」板块的邮件

- [ ] **Step 3: 最终 commit（如有未提交文件）**

```bash
git status
# 若有遗漏文件则 add 并 commit
```
