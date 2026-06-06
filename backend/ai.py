import httpx
import json
import os
from typing import AsyncGenerator

OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions"


def _get_headers() -> dict:
    api_key = os.getenv("OPENROUTER_API_KEY")
    if not api_key:
        raise ValueError("OPENROUTER_API_KEY not set")
    return {
        "Authorization": f"Bearer {api_key}",
        "HTTP-Referer": "http://localhost:5173",
        "X-Title": "XDigest",
        "Content-Type": "application/json",
    }


def _model() -> str:
    return os.getenv("OPENROUTER_MODEL", "openrouter/auto")


def _period_label(days: int) -> str:
    return {1: "今日", 7: "本周", 30: "本月"}.get(days, f"近{days}天")


def _format_tweets(tweets: list[dict]) -> str:
    lines = []
    for t in tweets:
        prefix = "(转发) " if t.get("is_retweet") else ""
        lines.append(f"[{t['created_at']}] {prefix}{t['text']}")
    return "\n\n".join(lines)


async def summarize(tweets: list[dict], days: int = 1) -> str:
    label = _period_label(days)
    tweets_text = _format_tweets(tweets)
    messages = [
        {
            "role": "user",
            "content": (
                f"请对以下 X 用户{label}发言进行结构化总结，包含：\n"
                "1. 主要话题（3-5个要点）：用有序列表（1. 2. 3.）逐条列出，不要用表格\n"
                "2. 关键观点：用有序列表逐条列出，不要用表格\n"
                "3. 值得关注的内容：用有序列表逐条列出，不要用表格\n"
                "4. 提及的股票观点：请用 Markdown 表格列出，列为「方向 | 股票名称/代码 | 理由」。"
                "方向只能是「看多」「看空」「中性」之一。"
                "若投资者对某股票未表明明确看多或看空，但有所提及或分析，则标记为「中性」。"
                '若发言中未提及任何股票，直接写"没有"即可，不要强行生成。\n\n'
                f"发言内容：\n{tweets_text}\n\n请用中文回答。"
            ),
        }
    ]
    async with httpx.AsyncClient(timeout=60) as client:
        response = await client.post(
            OPENROUTER_API_URL,
            headers=_get_headers(),
            json={"model": _model(), "messages": messages},
        )
        response.raise_for_status()
        return response.json()["choices"][0]["message"]["content"]


async def chat_stream(
    messages: list[dict], tweets: list[dict], days: int = 1
) -> AsyncGenerator[str, None]:
    label = _period_label(days)
    system_prompt = (
        "你是一个帮助分析 X（推特）用户发言的助手。\n\n"
        f"以下是该用户{label}的所有发言：\n\n{_format_tweets(tweets)}\n\n"
        "请基于以上内容回答用户的问题，用中文回答。"
    )
    full_messages = [{"role": "system", "content": system_prompt}] + messages
    async with httpx.AsyncClient(timeout=60) as client:
        async with client.stream(
            "POST",
            OPENROUTER_API_URL,
            headers=_get_headers(),
            json={"model": _model(), "messages": full_messages, "stream": True},
        ) as response:
            response.raise_for_status()
            async for line in response.aiter_lines():
                if not line.startswith("data: "):
                    continue
                data_str = line[6:]
                if data_str == "[DONE]":
                    break
                try:
                    data = json.loads(data_str)
                    content = data["choices"][0]["delta"].get("content", "")
                    if content:
                        yield content
                except (json.JSONDecodeError, KeyError):
                    continue


def _format_market_data(data: dict) -> str:
    fg = data["fear_greed"]
    sectors = data["sectors"]
    tech = data["tech_stocks"]

    def to_float(pct: str) -> float:
        try:
            return float(pct.strip("%+").replace(",", ""))
        except ValueError:
            return 0.0

    sorted_sectors = sorted(sectors.items(), key=lambda x: to_float(x[1]), reverse=True)
    sorted_tech = sorted(tech.items(), key=lambda x: to_float(x[1]), reverse=True)
    up_count = sum(1 for _, v in sectors.items() if to_float(v) >= 0)
    down_count = len(sectors) - up_count

    lines = [
        f"Fear & Greed 指数：{fg['score']}（{fg['rating']}）",
        f"昨日：{fg['previous_close']}  上周：{fg['one_week_ago']}  上月：{fg['one_month_ago']}",
        "",
        f"今日板块：{up_count} 个上涨，{down_count} 个下跌",
        "板块涨跌排行（从高到低）：",
    ]
    for name, pct in sorted_sectors:
        lines.append(f"  {name}: {pct}")
    lines.append("")
    lines.append("科技股表现：")
    for sym, pct in sorted_tech:
        lines.append(f"  {sym}: {pct}")
    return "\n".join(lines)


async def summarize_market(data: dict) -> str:
    market_text = _format_market_data(data)
    messages = [
        {
            "role": "user",
            "content": (
                "你是专业的美股市场分析师，请根据以下今日市场数据，用2-3句简洁的中文描述当日市场状态。\n\n"
                "重点描述：\n"
                "1. 市场整体情绪及其较近期的变化趋势\n"
                "2. 今日几个板块上涨、几个板块下跌，点出表现最强和最弱的板块\n"
                "3. 科技股中表现亮眼的（涨幅突出）和出人意料的（涨跌幅与市场预期明显背离）个股\n\n"
                "语气专业简洁，不超过3句话。\n\n"
                f"今日数据：\n{market_text}"
            ),
        }
    ]
    async with httpx.AsyncClient(timeout=60) as client:
        response = await client.post(
            OPENROUTER_API_URL,
            headers=_get_headers(),
            json={"model": _model(), "messages": messages},
        )
        response.raise_for_status()
        return response.json()["choices"][0]["message"]["content"]
