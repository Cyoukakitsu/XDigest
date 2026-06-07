"""
Standalone daily digest script.
Run directly: python digest_job.py
Scheduled via: ~/Library/LaunchAgents/com.xdigest.digest.plist
"""
import asyncio
import json
import logging
import os
import sys
from pathlib import Path

# Load .env from same directory as this script
from dotenv import load_dotenv
load_dotenv(Path(__file__).parent / ".env")

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger(__name__)

# Must import twikit_patches before twikit is used
import twikit_patches  # noqa: F401
import scraper
import ai
import emailer
import market_data as market_data_mod

USERS_PATH = Path(__file__).parent / "users.json"


def _load_users() -> list[dict]:
    if not USERS_PATH.exists():
        return []
    users = json.loads(USERS_PATH.read_text(encoding="utf-8"))
    for u in users:
        u.setdefault("digest", True)
    return users


async def main() -> None:
    users = [u for u in _load_users() if u.get("digest", True)]
    if not users:
        logger.info("No users with digest=True, exiting.")
        return

    if not scraper.COOKIES_PATH.exists():
        logger.error("cookies.json not found at %s — not logged in to X. Exiting.", scraper.COOKIES_PATH)
        sys.exit(1)

    logger.info("Fetching market data ...")
    market_info = await market_data_mod.fetch_market_data()
    market_summary = None
    if market_info:
        market_summary = await ai.summarize_market(market_info)
        logger.info("Market summary generated.")
    else:
        logger.warning("Market data unavailable, digest will have no market block.")

    logger.info("Starting digest for %d user(s): %s", len(users), [u["username"] for u in users])

    sections = []
    for user in users:
        username = user["username"]
        try:
            logger.info("Fetching tweets for @%s ...", username)
            tweets = await scraper.fetch_tweets(username, days=1)
            summary = await ai.summarize(tweets, days=1) if tweets else None
            sections.append({
                "username": username,
                "summary": summary,
                "tweet_count": len(tweets),
            })
            logger.info("  @%s: %d tweets", username, len(tweets))
        except Exception as e:
            logger.error("  @%s failed: %s", username, e)

    if not sections:
        logger.warning("All users failed, no email sent.")
        return

    logger.info("Sending digest email ...")
    emailer.send_digest(sections, market_summary=market_summary)
    logger.info("Done.")


if __name__ == "__main__":
    asyncio.run(main())
