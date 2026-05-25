import logging
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from ..config import settings
from ..database import get_db
from ..models import KlineCache
from ..schemas import (
    BollingerPoint,
    IndicatorBundle,
    KDPoint,
    KlinePoint,
    KlineResponse,
    MACDPoint,
    MAPoint,
)
from ..services import finmind, indicators, yfinance_fb

router = APIRouter(prefix="/api", tags=["kline"])
log = logging.getLogger(__name__)

CACHE_TTL = timedelta(hours=24)


def _build_payload(bars: list[dict]) -> dict:
    return {
        "bars": bars,
        "kd": indicators.compute_kd(bars),
        "macd": indicators.compute_macd(bars),
        "ma5": indicators.compute_ma(bars, 5),
        "ma10": indicators.compute_ma(bars, 10),
        "ma20": indicators.compute_ma(bars, 20),
        "ma60": indicators.compute_ma(bars, 60),
        "boll": indicators.compute_bollinger(bars, period=20, num_std=2.0),
    }


def _build_indicator_bundle(payload: dict) -> IndicatorBundle:
    return IndicatorBundle(
        kd=[KDPoint(**p) for p in payload["kd"]],
        macd=[MACDPoint(**p) for p in payload["macd"]],
        ma5=[MAPoint(**p) for p in payload.get("ma5", [])],
        ma10=[MAPoint(**p) for p in payload.get("ma10", [])],
        ma20=[MAPoint(**p) for p in payload.get("ma20", [])],
        ma60=[MAPoint(**p) for p in payload.get("ma60", [])],
        boll=[BollingerPoint(**p) for p in payload.get("boll", [])],
    )


@router.get("/kline/{ticker}", response_model=KlineResponse)
def get_kline(
    ticker: str,
    period: str = Query("daily", pattern="^(daily|weekly|monthly)$"),
    force: bool = Query(False, description="繞過 24 小時快取"),
    db: Session = Depends(get_db),
) -> KlineResponse:
    ticker = ticker.strip()

    cached = db.get(KlineCache, (ticker, period))
    # 舊版 cache 缺新指標，視為過期重抓
    cache_valid = (
        cached
        and not force
        and isinstance(cached.data, dict)
        and "bars" in cached.data
        and "ma5" in cached.data
        and "boll" in cached.data
    )
    if cache_valid:
        fetched_at = cached.fetched_at
        if fetched_at.tzinfo is None:
            fetched_at = fetched_at.replace(tzinfo=timezone.utc)
        if datetime.now(timezone.utc) - fetched_at < CACHE_TTL:
            payload = cached.data
            return KlineResponse(
                ticker=ticker,
                period=period,
                source="cache",
                fetched_at=fetched_at,
                data=[KlinePoint(**p) for p in payload["bars"]],
                indicators=_build_indicator_bundle(payload),
            )

    bars: list[dict] = []
    source = ""
    err_msgs: list[str] = []

    try:
        daily = finmind.fetch_daily(ticker, token=settings.finmind_token)
        bars = finmind.resample(daily, period)
        source = "finmind"
    except Exception as e:
        err_msgs.append(f"finmind: {e}")
        log.warning("FinMind failed for %s/%s: %s", ticker, period, e)

    if not bars:
        try:
            bars = yfinance_fb.fetch(ticker, period)
            source = "yfinance"
        except Exception as e:
            err_msgs.append(f"yfinance: {e}")
            log.warning("yfinance failed for %s/%s: %s", ticker, period, e)

    if not bars:
        raise HTTPException(status_code=502, detail="; ".join(err_msgs) or "no data")

    payload = _build_payload(bars)
    now = datetime.now(timezone.utc)

    if cached:
        cached.data = payload
        cached.fetched_at = now
    else:
        db.add(KlineCache(ticker=ticker, period=period, data=payload, fetched_at=now))
    db.commit()

    return KlineResponse(
        ticker=ticker,
        period=period,
        source=source,  # type: ignore[arg-type]
        fetched_at=now,
        data=[KlinePoint(**p) for p in payload["bars"]],
        indicators=_build_indicator_bundle(payload),
    )
