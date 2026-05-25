"""Stock Watch Dashboard — pipeline ingest client.

Drop this file into your pipeline project and import:

    from dashboard_client import push_summary

    push_summary(
        source="老簡",
        source_type="youtube",
        title=video.title,
        url=video.url,
        published_at=video.published_at,       # datetime or ISO 8601 字串
        market_view=summary["market_view"],
        bullets=summary["bullets"],
        stocks=summary["stocks"],
        raw=summary,
    )

Behaviour:
- 預設讀 env：DASHBOARD_URL（如 https://dashboard-api.up.railway.app）、DASHBOARD_KEY
- 失敗不會 raise（推 Telegram 不會被擋），只 log warning
- timeout 10 秒，背景排程任務不會卡死

Requires: requests (絕大多數 pipeline 都已經有)
"""
from __future__ import annotations

import logging
import os
from datetime import datetime
from typing import Any, Iterable, Optional, Union

import requests

log = logging.getLogger(__name__)


def _iso(dt: Union[datetime, str]) -> str:
    if isinstance(dt, datetime):
        return dt.isoformat()
    return str(dt)


def push_summary(
    *,
    source: str,
    source_type: str,
    published_at: Union[datetime, str],
    title: Optional[str] = None,
    url: Optional[str] = None,
    market_view: Optional[str] = None,
    bullets: Optional[Iterable[str]] = None,
    stocks: Optional[Iterable[dict]] = None,
    raw: Optional[dict[str, Any]] = None,
    base_url: Optional[str] = None,
    api_key: Optional[str] = None,
    timeout: float = 10.0,
) -> Optional[dict]:
    """POST 一筆摘要到 Dashboard 的 /api/ingest。

    `stocks` 每筆格式：{"ticker": "2330", "name": "台積電", "view": "...", "sentiment": "bullish|bearish|neutral"}
    回傳 ingest API 的 JSON，失敗回 None（不 raise）。
    """
    base_url = (base_url or os.getenv("DASHBOARD_URL") or "").rstrip("/")
    api_key = api_key or os.getenv("DASHBOARD_KEY") or ""
    if not base_url or not api_key:
        log.warning("dashboard_client: 缺 DASHBOARD_URL / DASHBOARD_KEY，跳過 ingest")
        return None

    payload: dict[str, Any] = {
        "source": source,
        "source_type": source_type,
        "published_at": _iso(published_at),
        "title": title,
        "url": url,
        "market_view": market_view,
        "bullets": list(bullets) if bullets else [],
        "stocks": list(stocks) if stocks else [],
        "raw": raw,
    }

    try:
        r = requests.post(
            f"{base_url}/api/ingest",
            json=payload,
            headers={"X-API-Key": api_key, "Content-Type": "application/json"},
            timeout=timeout,
        )
        if r.status_code >= 400:
            log.warning("dashboard_client: ingest HTTP %s — %s", r.status_code, r.text[:200])
            return None
        return r.json()
    except Exception as e:
        log.warning("dashboard_client: ingest failed — %s", e)
        return None
