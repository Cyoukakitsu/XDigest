import html
import logging
import smtplib
import os
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from datetime import date

import markdown as md_lib

logger = logging.getLogger(__name__)


def build_html(sections: list[dict]) -> str:
    today = date.today().strftime("%Y-%m-%d")
    parts = [
        "<html><body>",
        f"<h1>XDigest 早报 &middot; {today}</h1>",
        "<hr>",
    ]
    for s in sections:
        parts.append(f"<h2>@{html.escape(s['username'])}</h2>")
        if s["summary"]:
            parts.append(md_lib.markdown(s["summary"]))
            parts.append(f"<p><small>共 {s['tweet_count']} 条推文</small></p>")
        else:
            parts.append("<p><em>暂无发言</em></p>")
        parts.append("<hr>")
    parts.append("</body></html>")
    return "\n".join(parts)
