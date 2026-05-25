"""Technical indicators for K-line bars.

All functions take `bars: list[dict]` where each dict has keys t, o, h, l, c, v
(matching the FinMind/yfinance normalized output) and return per-bar values
aligned with the input.
"""
from __future__ import annotations


def compute_ma(bars: list[dict], period: int) -> list[dict]:
    """Simple moving average over close price. Returns None for warmup bars."""
    if not bars:
        return []
    closes = [b["c"] for b in bars]
    out: list[dict] = []
    for i, bar in enumerate(bars):
        if i < period - 1:
            out.append({"t": bar["t"], "ma": None})
            continue
        avg = sum(closes[i - period + 1 : i + 1]) / period
        out.append({"t": bar["t"], "ma": round(avg, 2)})
    return out


def compute_bollinger(bars: list[dict], period: int = 20, num_std: float = 2.0) -> list[dict]:
    """Bollinger Bands — 中軌 = SMA(period)，上/下軌 = 中軌 ± num_std × stdev。"""
    if not bars:
        return []
    closes = [b["c"] for b in bars]
    out: list[dict] = []
    for i, bar in enumerate(bars):
        if i < period - 1:
            out.append({"t": bar["t"], "upper": None, "mid": None, "lower": None})
            continue
        window = closes[i - period + 1 : i + 1]
        mean = sum(window) / period
        var = sum((x - mean) ** 2 for x in window) / period
        std = var ** 0.5
        out.append({
            "t": bar["t"],
            "upper": round(mean + num_std * std, 2),
            "mid": round(mean, 2),
            "lower": round(mean - num_std * std, 2),
        })
    return out


def compute_kd(bars: list[dict], n: int = 9) -> list[dict]:
    """KD stochastic — Taiwan standard 9-period, smoothing 1/3.

    Before there are `n` bars of history, K and D are None.
    Initial K, D both seeded at 50.
    """
    if not bars:
        return []
    highs = [b["h"] for b in bars]
    lows = [b["l"] for b in bars]
    closes = [b["c"] for b in bars]

    out: list[dict] = []
    k_prev = 50.0
    d_prev = 50.0
    for i, bar in enumerate(bars):
        if i < n - 1:
            out.append({"t": bar["t"], "k": None, "d": None})
            continue
        window_high = max(highs[i - n + 1 : i + 1])
        window_low = min(lows[i - n + 1 : i + 1])
        if window_high == window_low:
            rsv = 50.0
        else:
            rsv = (closes[i] - window_low) / (window_high - window_low) * 100
        k = (2 / 3) * k_prev + (1 / 3) * rsv
        d = (2 / 3) * d_prev + (1 / 3) * k
        out.append({"t": bar["t"], "k": round(k, 2), "d": round(d, 2)})
        k_prev = k
        d_prev = d
    return out


def _ema(values: list[float], period: int) -> list[float]:
    if not values:
        return []
    alpha = 2 / (period + 1)
    out: list[float] = []
    prev = values[0]
    out.append(prev)
    for v in values[1:]:
        prev = v * alpha + prev * (1 - alpha)
        out.append(prev)
    return out


def compute_macd(
    bars: list[dict],
    fast: int = 12,
    slow: int = 26,
    signal: int = 9,
) -> list[dict]:
    """MACD — Taiwan convention: histogram = (DIF - DEA) * 2.

    DIF = EMA(fast) - EMA(slow)
    DEA (signal line) = EMA(signal) of DIF
    Histogram = (DIF - DEA) * 2
    """
    if not bars:
        return []
    closes = [b["c"] for b in bars]
    ema_fast = _ema(closes, fast)
    ema_slow = _ema(closes, slow)
    dif = [f - s for f, s in zip(ema_fast, ema_slow)]
    dea = _ema(dif, signal)

    # 不擋 warmup — EMA 從第一根就有定義，前期值雖未穩定但仍是有效資訊
    # 這對短歷史（如月線只有 18 根）特別重要
    out: list[dict] = []
    for i, bar in enumerate(bars):
        hist = (dif[i] - dea[i]) * 2
        out.append({
            "t": bar["t"],
            "dif": round(dif[i], 4),
            "dea": round(dea[i], 4),
            "macd": round(hist, 4),
        })
    return out
