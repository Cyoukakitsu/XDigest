import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import emailer


def test_build_html_contains_username():
    sections = [{"username": "alice", "summary": "## 主要话题\n内容A", "tweet_count": 5}]
    html = emailer.build_html(sections)
    assert "@alice" in html


def test_build_html_renders_tweet_count():
    sections = [{"username": "alice", "summary": "内容", "tweet_count": 5}]
    html = emailer.build_html(sections)
    assert "5" in html


def test_build_html_no_tweets_shows_placeholder():
    sections = [{"username": "quiet", "summary": None, "tweet_count": 0}]
    html = emailer.build_html(sections)
    assert "暂无发言" in html
    assert "@quiet" in html


def test_build_html_multiple_sections():
    sections = [
        {"username": "alice", "summary": "内容A", "tweet_count": 3},
        {"username": "bob", "summary": None, "tweet_count": 0},
    ]
    html = emailer.build_html(sections)
    assert "@alice" in html
    assert "@bob" in html
    assert "暂无发言" in html


def test_build_html_includes_date():
    from datetime import date
    today = date.today().strftime("%Y-%m-%d")
    sections = [{"username": "alice", "summary": "内容", "tweet_count": 1}]
    html = emailer.build_html(sections)
    assert today in html


from unittest.mock import MagicMock


def test_send_digest_calls_smtp(monkeypatch):
    monkeypatch.setenv("GMAIL_USER", "sender@gmail.com")
    monkeypatch.setenv("GMAIL_APP_PASSWORD", "app-pass")
    monkeypatch.setenv("DIGEST_TO", "receiver@gmail.com")

    mock_server = MagicMock()
    mock_smtp_cls = MagicMock()
    mock_smtp_cls.return_value.__enter__ = MagicMock(return_value=mock_server)
    mock_smtp_cls.return_value.__exit__ = MagicMock(return_value=False)

    sections = [{"username": "alice", "summary": "内容", "tweet_count": 2}]
    emailer.send_digest(sections, smtp_class=mock_smtp_cls)

    mock_smtp_cls.assert_called_once_with("smtp.gmail.com", 465)
    mock_server.login.assert_called_once_with("sender@gmail.com", "app-pass")
    mock_server.sendmail.assert_called_once()
    args = mock_server.sendmail.call_args[0]
    assert args[0] == "sender@gmail.com"
    assert args[1] == "receiver@gmail.com"


def test_send_digest_skips_when_config_missing(monkeypatch):
    monkeypatch.delenv("GMAIL_USER", raising=False)
    monkeypatch.delenv("GMAIL_APP_PASSWORD", raising=False)
    monkeypatch.delenv("DIGEST_TO", raising=False)

    mock_smtp_cls = MagicMock()
    sections = [{"username": "alice", "summary": "内容", "tweet_count": 1}]
    emailer.send_digest(sections, smtp_class=mock_smtp_cls)

    mock_smtp_cls.assert_not_called()


def test_send_digest_logs_on_smtp_error(monkeypatch, caplog):
    import logging
    monkeypatch.setenv("GMAIL_USER", "sender@gmail.com")
    monkeypatch.setenv("GMAIL_APP_PASSWORD", "app-pass")
    monkeypatch.setenv("DIGEST_TO", "receiver@gmail.com")

    mock_smtp_cls = MagicMock()
    mock_smtp_cls.return_value.__enter__ = MagicMock(side_effect=Exception("connection refused"))
    mock_smtp_cls.return_value.__exit__ = MagicMock(return_value=False)

    sections = [{"username": "alice", "summary": "内容", "tweet_count": 1}]
    with caplog.at_level(logging.ERROR, logger="emailer"):
        emailer.send_digest(sections, smtp_class=mock_smtp_cls)

    assert any("connection refused" in r.message for r in caplog.records)


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
    assert "大盘快报".encode("utf-8") in raw_email
    assert "大盘摘要内容".encode("utf-8") in raw_email
