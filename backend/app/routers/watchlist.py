from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Message, MessageStock
from ..schemas import WatchlistItem

router = APIRouter(prefix="/api", tags=["watchlist"])


@router.get("/watchlist", response_model=list[WatchlistItem])
def watchlist(
    days: int = Query(7, ge=1, le=90),
    min_mentions: int = Query(1, ge=1, le=20),
    db: Session = Depends(get_db),
) -> list[WatchlistItem]:
    since = datetime.now(timezone.utc) - timedelta(days=days)

    rows = (
        db.query(
            MessageStock.ticker,
            func.max(MessageStock.name).label("name"),
            func.count(MessageStock.id).label("mention_count"),
            func.max(Message.published_at).label("last_mention_at"),
        )
        .join(Message, Message.id == MessageStock.message_id)
        .filter(Message.published_at >= since)
        .group_by(MessageStock.ticker)
        .having(func.count(MessageStock.id) >= min_mentions)
        .order_by(func.count(MessageStock.id).desc(), func.max(Message.published_at).desc())
        .all()
    )

    out: list[WatchlistItem] = []
    for ticker, name, count, last_at in rows:
        last_view = (
            db.query(MessageStock.view)
            .join(Message, Message.id == MessageStock.message_id)
            .filter(MessageStock.ticker == ticker, Message.published_at >= since)
            .order_by(Message.published_at.desc())
            .first()
        )
        out.append(WatchlistItem(
            ticker=ticker,
            name=name,
            mention_count=int(count),
            last_mention_at=last_at,
            last_view=last_view[0] if last_view else None,
        ))
    return out
