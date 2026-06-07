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
