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
