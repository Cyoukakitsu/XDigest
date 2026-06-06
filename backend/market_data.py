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
