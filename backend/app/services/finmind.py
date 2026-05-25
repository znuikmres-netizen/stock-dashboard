from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from typing import Optional

import httpx

FINMIND_BASE = "https://api.finmindtrade.com/api/v4/data"


class FinMindError(Exception):
    pass


def _to_unix(d: date) -> int:
    return int(datetime(d.year, d.month, d.day, tzinfo=timezone.utc).timestamp())


def fetch_daily(ticker: str, token: Optional[str] = None, lookback_days: int = 550) -> list[dict]:
    """Fetch raw daily K-line from FinMind (free tier dataset: TaiwanStockPrice).

    Returns list of {t, o, h, l, c, v} sorted ascending by date.
    Token is optional — anonymous access works but with stricter rate limits.
    """
    end = date.today()
    start = end - timedelta(days=lookback_days)
    params: dict = {
        "dataset": "TaiwanStockPrice",
        "data_id": ticker,
        "start_date": start.isoformat(),
        "end_date": end.isoformat(),
    }
    if token:
        params["token"] = token
    with httpx.Client(timeout=15.0) as client:
        r = client.get(FINMIND_BASE, params=params)
    if r.status_code != 200:
        raise FinMindError(f"FinMind HTTP {r.status_code}: {r.text[:200]}")
    body = r.json()
    if body.get("status") != 200 or "data" not in body:
        raise FinMindError(f"FinMind payload error: {body.get('msg')}")

    out: list[dict] = []
    for row in body["data"]:
        try:
            d = date.fromisoformat(row["date"])
        except Exception:
            continue
        out.append({
            "t": _to_unix(d),
            "o": float(row.get("open") or 0),
            "h": float(row.get("max") or 0),
            "l": float(row.get("min") or 0),
            "c": float(row.get("close") or 0),
            "v": float(row.get("Trading_Volume") or 0),
        })
    out.sort(key=lambda x: x["t"])
    return out


def resample(daily: list[dict], period: str) -> list[dict]:
    """Resample daily K-line to weekly or monthly.

    period: "daily" | "weekly" | "monthly"
    """
    if period == "daily":
        return daily
    if not daily:
        return []

    def key_for(ts: int) -> tuple:
        dt = datetime.fromtimestamp(ts, tz=timezone.utc)
        if period == "weekly":
            iso = dt.isocalendar()
            return (iso.year, iso.week)
        if period == "monthly":
            return (dt.year, dt.month)
        raise ValueError(f"unknown period: {period}")

    buckets: dict[tuple, list[dict]] = {}
    order: list[tuple] = []
    for bar in daily:
        k = key_for(bar["t"])
        if k not in buckets:
            buckets[k] = []
            order.append(k)
        buckets[k].append(bar)

    out: list[dict] = []
    for k in order:
        bars = buckets[k]
        out.append({
            "t": bars[-1]["t"],
            "o": bars[0]["o"],
            "h": max(b["h"] for b in bars),
            "l": min(b["l"] for b in bars if b["l"] > 0) if any(b["l"] > 0 for b in bars) else 0,
            "c": bars[-1]["c"],
            "v": sum(b["v"] for b in bars),
        })
    return out
