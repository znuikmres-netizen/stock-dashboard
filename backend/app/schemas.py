from datetime import datetime
from typing import Any, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field


# ---------- Ingest ----------

class StockItem(BaseModel):
    ticker: str
    name: Optional[str] = None
    view: Optional[str] = None
    sentiment: Optional[Literal["bullish", "bearish", "neutral"]] = None


class IngestPayload(BaseModel):
    source: str = Field(..., description="老簡 / 股癌 / podcast-jhaohua ...")
    source_type: str = Field(..., description="youtube / podcast / digest")
    title: Optional[str] = None
    url: Optional[str] = None
    published_at: datetime
    market_view: Optional[str] = None
    bullets: list[str] = Field(default_factory=list)
    stocks: list[StockItem] = Field(default_factory=list)
    raw: Optional[dict[str, Any]] = None


class IngestResult(BaseModel):
    id: int
    created: bool


# ---------- Messages ----------

class StockOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    ticker: str
    name: Optional[str] = None
    view: Optional[str] = None
    sentiment: Optional[str] = None


class MessageOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    source: str
    source_type: str
    title: Optional[str] = None
    url: Optional[str] = None
    published_at: datetime
    market_view: Optional[str] = None
    bullets: list[str] = Field(default_factory=list)
    stocks: list[StockOut] = Field(default_factory=list)


# ---------- Watchlist ----------

class WatchlistItem(BaseModel):
    ticker: str
    name: Optional[str] = None
    mention_count: int
    last_mention_at: datetime
    last_view: Optional[str] = None


# ---------- Kline ----------

class KlinePoint(BaseModel):
    t: int  # unix seconds (UTC)
    o: float
    h: float
    l: float
    c: float
    v: float


class KDPoint(BaseModel):
    t: int
    k: Optional[float] = None
    d: Optional[float] = None


class MACDPoint(BaseModel):
    t: int
    dif: Optional[float] = None
    dea: Optional[float] = None
    macd: Optional[float] = None  # histogram (DIF - DEA) * 2


class MAPoint(BaseModel):
    t: int
    ma: Optional[float] = None


class BollingerPoint(BaseModel):
    t: int
    upper: Optional[float] = None
    mid: Optional[float] = None
    lower: Optional[float] = None


class IndicatorBundle(BaseModel):
    kd: list[KDPoint]
    macd: list[MACDPoint]
    ma5: list[MAPoint]
    ma10: list[MAPoint]
    ma20: list[MAPoint]
    ma60: list[MAPoint]
    boll: list[BollingerPoint]


class KlineResponse(BaseModel):
    ticker: str
    period: Literal["daily", "weekly", "monthly"]
    source: Literal["finmind", "yfinance", "cache"]
    fetched_at: datetime
    data: list[KlinePoint]
    indicators: IndicatorBundle
