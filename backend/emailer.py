import email.policy
import html
import logging
import re
import smtplib
import os
from email.message import EmailMessage
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from datetime import date

import markdown as md_lib

logger = logging.getLogger(__name__)


def build_html(sections: list[dict], market_summary: str | None = None) -> str:
    today = date.today().strftime("%Y-%m-%d")
    parts = [
        "<html><body>",
        f"<h1>XDigest 早报 &middot; {today}</h1>",
        "<hr>",
    ]
    if market_summary:
        parts.append("<h2>📊 大盘快报</h2>")
        parts.append(f"<p>{html.escape(market_summary)}</p>")
        parts.append("<hr>")
    for s in sections:
        parts.append(f"<h2>@{html.escape(s['username'])}</h2>")
        if s["summary"]:
            # ensure a blank line before every table block so the tables extension can parse it
            summary = re.sub(r'(?<!\n)\n(\|)', r'\n\n\1', s["summary"])
            parts.append(md_lib.markdown(summary, extensions=["tables"]))
            parts.append(f"<p><small>共 {s['tweet_count']} 条推文</small></p>")
        else:
            parts.append("<p><em>暂无发言</em></p>")
        parts.append("<hr>")
    parts.append("</body></html>")
    return "\n".join(parts)


def send_digest(
    sections: list[dict],
    *,
    smtp_class=None,
    market_summary: str | None = None,
) -> None:
    if smtp_class is None:
        smtp_class = smtplib.SMTP_SSL

    gmail_user = os.getenv("GMAIL_USER")
    app_password = os.getenv("GMAIL_APP_PASSWORD")
    to_addr = os.getenv("DIGEST_TO")

    if not all([gmail_user, app_password, to_addr]):
        logger.warning(
            "Daily digest skipped: GMAIL_USER / GMAIL_APP_PASSWORD / DIGEST_TO not set"
        )
        return

    today = date.today().strftime("%Y-%m-%d")
    html_body = build_html(sections, market_summary=market_summary)

    msg = EmailMessage(policy=email.policy.EmailPolicy(utf8=True))
    msg["Subject"] = f"XDigest 早报 · {today}"
    msg["From"] = gmail_user
    msg["To"] = to_addr
    msg.set_content(html_body, subtype="html", cte="8bit")

    try:
        with smtp_class("smtp.gmail.com", 465) as server:
            server.login(gmail_user, app_password)
            server.sendmail(gmail_user, to_addr, msg.as_bytes().decode("utf-8"))
        logger.info("Daily digest sent to %s", to_addr)
    except Exception as e:
        logger.error("Failed to send daily digest: %s", e)
