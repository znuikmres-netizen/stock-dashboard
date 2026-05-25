from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..auth import require_api_key
from ..database import get_db
from ..models import Message, MessageStock
from ..schemas import IngestPayload, IngestResult

router = APIRouter(prefix="/api", tags=["ingest"])


@router.post("/ingest", response_model=IngestResult, dependencies=[Depends(require_api_key)])
def ingest(payload: IngestPayload, db: Session = Depends(get_db)) -> IngestResult:
    if payload.url:
        existing = (
            db.query(Message)
            .filter(Message.source == payload.source, Message.url == payload.url)
            .first()
        )
        if existing:
            return IngestResult(id=existing.id, created=False)

    msg = Message(
        source=payload.source,
        source_type=payload.source_type,
        title=payload.title,
        url=payload.url,
        published_at=payload.published_at,
        market_view=payload.market_view,
        bullets=payload.bullets,
        raw=payload.raw,
    )
    for s in payload.stocks:
        msg.stocks.append(MessageStock(
            ticker=s.ticker,
            name=s.name,
            view=s.view,
            sentiment=s.sentiment,
        ))
    db.add(msg)
    db.commit()
    db.refresh(msg)
    return IngestResult(id=msg.id, created=True)
