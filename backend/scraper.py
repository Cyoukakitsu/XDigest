import json
import os
from datetime import datetime, timedelta, timezone
from pathlib import Path

from twikit import Client

DATA_DIR = Path(os.getenv("DATA_DIR", str(Path(__file__).parent)))
COOKIES_PATH = DATA_DIR / "cookies.json"


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


async def fetch_tweets(username: str, days: int = 1) -> list[dict]:
    client = _load_client()
    user = await client.get_user_by_screen_name(username)
    if user is None:
        raise ValueError(f"User '{username}' not found")

    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    tweets = []

    result = await client.get_user_tweets(user.id, "Tweets", count=100)
    for _ in range(5):  # max 5 pages (~500 tweets)
        done = False
        for tweet in result:
            tweet_time = datetime.strptime(tweet.created_at, "%a %b %d %H:%M:%S %z %Y")
            if tweet_time < cutoff:
                done = True
                break
            tweets.append(
                {
                    "id": tweet.id,
                    "text": tweet.text,
                    "created_at": tweet.created_at,
                    "is_retweet": tweet.retweeted_tweet is not None,
                }
            )
        if done:
            break
        try:
            result = await result.next()
            if not result:
                break
        except Exception:
            break

    return tweets
