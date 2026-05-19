import sys
import pytest
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock


@pytest.fixture
def mock_scraper_mod():
    m = MagicMock()
    m.login = AsyncMock(return_value=None)
    m.fetch_today_tweets = AsyncMock(return_value=[])
    m.COOKIES_PATH = Path("/tmp/xdigest_test_cookies.json")
    return m


@pytest.fixture
def mock_ai_mod():
    m = MagicMock()
    m.summarize = AsyncMock(return_value="测试摘要")

    async def _mock_stream(messages, tweets):
        yield "你好"
        yield "世界"

    m.chat_stream = _mock_stream
    return m


@pytest.fixture
def patched_modules(mock_scraper_mod, mock_ai_mod):
    saved = {k: sys.modules.get(k) for k in ("scraper", "ai", "main")}
    sys.modules["scraper"] = mock_scraper_mod
    sys.modules["ai"] = mock_ai_mod
    sys.modules.pop("main", None)
    yield mock_scraper_mod, mock_ai_mod
    for key, val in saved.items():
        if val is None:
            sys.modules.pop(key, None)
        else:
            sys.modules[key] = val
