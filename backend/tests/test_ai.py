import pytest
import json
from unittest.mock import AsyncMock, MagicMock, patch

SAMPLE_TWEETS = [
    {"id": "1", "text": "Hello world", "created_at": "Mon Jan 01 00:00:00 +0000 2024", "is_retweet": False},
    {"id": "2", "text": "Another post", "created_at": "Mon Jan 01 01:00:00 +0000 2024", "is_retweet": False},
]

@pytest.mark.asyncio
async def test_summarize_returns_string():
    mock_response = MagicMock()
    mock_response.raise_for_status = MagicMock()
    mock_response.json.return_value = {
        "choices": [{"message": {"content": "这是摘要内容"}}]
    }

    mock_client = AsyncMock()
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=None)
    mock_client.post = AsyncMock(return_value=mock_response)

    with patch("ai.httpx.AsyncClient", return_value=mock_client):
        with patch.dict("os.environ", {"OPENROUTER_API_KEY": "test-key"}):
            from ai import summarize
            result = await summarize(SAMPLE_TWEETS)
            assert isinstance(result, str)
            assert "摘要" in result

@pytest.mark.asyncio
async def test_summarize_raises_without_api_key():
    import os
    os.environ.pop("OPENROUTER_API_KEY", None)
    with patch.dict("os.environ", {}, clear=True):
        import importlib
        import ai as ai_module
        importlib.reload(ai_module)
        with pytest.raises(ValueError, match="OPENROUTER_API_KEY"):
            await ai_module.summarize(SAMPLE_TWEETS)

@pytest.mark.asyncio
async def test_chat_stream_yields_content():
    lines = [
        'data: {"choices":[{"delta":{"content":"你好"}}]}',
        'data: {"choices":[{"delta":{"content":"世界"}}]}',
        'data: [DONE]',
    ]

    async def mock_aiter_lines():
        for line in lines:
            yield line

    mock_response = MagicMock()
    mock_response.raise_for_status = MagicMock()
    mock_response.aiter_lines = mock_aiter_lines

    mock_stream_ctx = AsyncMock()
    mock_stream_ctx.__aenter__ = AsyncMock(return_value=mock_response)
    mock_stream_ctx.__aexit__ = AsyncMock(return_value=None)

    mock_client = MagicMock()
    mock_client.stream = MagicMock(return_value=mock_stream_ctx)
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=None)

    with patch("ai.httpx.AsyncClient", return_value=mock_client):
        with patch.dict("os.environ", {"OPENROUTER_API_KEY": "test-key"}):
            import importlib
            import ai as ai_module
            importlib.reload(ai_module)
            chunks = []
            async for chunk in ai_module.chat_stream([{"role": "user", "content": "hi"}], SAMPLE_TWEETS):
                chunks.append(chunk)
            assert chunks == ["你好", "世界"]


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
    assert "42" in prompt_text
    assert "科技" in prompt_text
    assert "NVDA" in prompt_text
