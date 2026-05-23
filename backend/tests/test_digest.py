import json
import sys
import pytest
from unittest.mock import AsyncMock, MagicMock


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

    mock_emailer = MagicMock()
    mock_emailer.send_digest = MagicMock()

    saved = {k: sys.modules.get(k) for k in ("scraper", "ai", "emailer", "main")}
    sys.modules["scraper"] = mock_scraper
    sys.modules["ai"] = mock_ai
    sys.modules["emailer"] = mock_emailer
    sys.modules.pop("main", None)

    import main
    monkeypatch.setattr(main, "USERS_PATH", users_path)

    yield main, users_path, mock_scraper, mock_ai, mock_emailer

    for key, val in saved.items():
        if val is None:
            sys.modules.pop(key, None)
        else:
            sys.modules[key] = val


@pytest.mark.asyncio
async def test_run_daily_digest_fetches_and_sends(digest_env):
    main, users_path, mock_scraper, mock_ai, mock_emailer = digest_env
    users_path.write_text(json.dumps([
        {"username": "alice", "note": "", "digest": True}
    ]))

    await main.run_daily_digest()

    mock_scraper.fetch_tweets.assert_awaited_once_with("alice", days=1)
    mock_ai.summarize.assert_awaited_once()
    mock_emailer.send_digest.assert_called_once()
    sections = mock_emailer.send_digest.call_args[0][0]
    assert sections[0]["username"] == "alice"
    assert sections[0]["summary"] == "AI总结内容"
    assert sections[0]["tweet_count"] == 1


@pytest.mark.asyncio
async def test_run_daily_digest_skips_digest_false_users(digest_env):
    main, users_path, mock_scraper, mock_ai, mock_emailer = digest_env
    users_path.write_text(json.dumps([
        {"username": "bob", "note": "", "digest": False}
    ]))

    await main.run_daily_digest()

    mock_scraper.fetch_tweets.assert_not_awaited()
    mock_emailer.send_digest.assert_not_called()


@pytest.mark.asyncio
async def test_run_daily_digest_no_tweets_skips_ai(digest_env):
    main, users_path, mock_scraper, mock_ai, mock_emailer = digest_env
    mock_scraper.fetch_tweets = AsyncMock(return_value=[])
    users_path.write_text(json.dumps([
        {"username": "quiet", "note": "", "digest": True}
    ]))

    await main.run_daily_digest()

    mock_ai.summarize.assert_not_awaited()
    mock_emailer.send_digest.assert_called_once()
    sections = mock_emailer.send_digest.call_args[0][0]
    assert sections[0]["summary"] is None
    assert sections[0]["tweet_count"] == 0


@pytest.mark.asyncio
async def test_run_daily_digest_skips_if_not_logged_in(digest_env, tmp_path):
    main, users_path, mock_scraper, mock_ai, mock_emailer = digest_env
    mock_scraper.COOKIES_PATH = tmp_path / "no_cookies.json"
    users_path.write_text(json.dumps([
        {"username": "alice", "note": "", "digest": True}
    ]))

    await main.run_daily_digest()

    mock_scraper.fetch_tweets.assert_not_awaited()
    mock_emailer.send_digest.assert_not_called()


@pytest.mark.asyncio
async def test_run_daily_digest_continues_after_fetch_error(digest_env):
    main, users_path, mock_scraper, mock_ai, mock_emailer = digest_env
    mock_scraper.fetch_tweets = AsyncMock(side_effect=[
        Exception("rate limited"),
        [{"id": "2", "text": "ok", "created_at": "Mon Jan 01 00:00:00 +0000 2024", "is_retweet": False}],
    ])
    mock_ai.summarize = AsyncMock(return_value="Bob 总结")
    users_path.write_text(json.dumps([
        {"username": "alice", "note": "", "digest": True},
        {"username": "bob", "note": "", "digest": True},
    ]))

    await main.run_daily_digest()

    mock_emailer.send_digest.assert_called_once()
    sections = mock_emailer.send_digest.call_args[0][0]
    usernames = [s["username"] for s in sections]
    assert "bob" in usernames
    assert "alice" not in usernames
