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
