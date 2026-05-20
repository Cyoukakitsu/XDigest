import json
from datetime import datetime, timedelta, timezone
from pathlib import Path

from twikit import Client

COOKIES_PATH = Path(__file__).parent / "cookies.json"


async def login(auth_info_1: str, password: str, auth_info_2: str | None = None) -> None:
    client = Client("en-US")
    kwargs: dict = {"auth_info_1": auth_info_1, "password": password}
    if auth_info_2:
        kwargs["auth_info_2"] = auth_info_2
    await client.login(**kwargs)
    client.save_cookies(str(COOKIES_PATH))


def _load_client() -> Client:
    client = Client("en-US")
    client.load_cookies(str(COOKIES_PATH))
    return client


async def fetch_today_tweets(username: str) -> list[dict]:
    client = _load_client()
    user = await client.get_user_by_screen_name(username)
    if user is None:
        raise ValueError(f"User '{username}' not found")

    cutoff = datetime.now(timezone.utc) - timedelta(hours=24)
    tweets = []

    result = await client.get_user_tweets(user.id, "Tweets", count=50)
    for tweet in result:
        created_at_str = tweet.created_at
        tweet_time = datetime.strptime(created_at_str, "%a %b %d %H:%M:%S %z %Y")
        if tweet_time < cutoff:
            break
        tweets.append(
            {
                "id": tweet.id,
                "text": tweet.text,
                "created_at": created_at_str,
                "is_retweet": tweet.retweeted_tweet is not None,
            }
        )

    return tweets
