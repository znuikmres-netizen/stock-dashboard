from __future__ import annotations

from datetime import datetime, timezone

_INTERVAL_MAP = {"daily": "1d", "weekly": "1wk", "monthly": "1mo"}


class YFinanceError(Exception):
    pass


def fetch(ticker: str, period: str = "daily") -> list[dict]:
    """Fallback: pull K-line from Yahoo Finance.

    Tries `<ticker>.TW` (上市) first, then `<ticker>.TWO` (上櫃) if empty.
    """
    try:
        import yfinance as yf
    except ImportError as e:
        raise YFinanceError(f"yfinance not installed: {e}")

    interval = _INTERVAL_MAP.get(period)
    if not interval:
        raise YFinanceError(f"unknown period: {period}")

    for suffix in (".TW", ".TWO"):
        sym = ticker + suffix
        try:
            df = yf.Ticker(sym).history(period="2y", interval=interval, auto_adjust=False)
        except Exception:
            continue
        if df is None or df.empty:
            continue
        out: list[dict] = []
        for ts, row in df.iterrows():
            try:
                t = int(ts.to_pydatetime().replace(tzinfo=timezone.utc).timestamp())
                out.append({
                    "t": t,
                    "o": float(row["Open"]),
                    "h": float(row["High"]),
                    "l": float(row["Low"]),
                    "c": float(row["Close"]),
                    "v": float(row["Volume"]),
                })
            except Exception:
                continue
        if out:
            return out
    raise YFinanceError(f"no data on yfinance for {ticker}")
