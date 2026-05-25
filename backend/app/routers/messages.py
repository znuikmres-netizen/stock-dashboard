from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Message
from ..schemas import MessageOut

router = APIRouter(prefix="/api", tags=["messages"])


@router.get("/messages", response_model=list[MessageOut])
def list_messages(
    limit: int = Query(50, ge=1, le=200),
    source: Optional[str] = None,
    since: Optional[datetime] = None,
    db: Session = Depends(get_db),
) -> list[Message]:
    q = db.query(Message)
    if source:
        q = q.filter(Message.source == source)
    if since:
        q = q.filter(Message.published_at >= since)
    q = q.order_by(Message.published_at.desc()).limit(limit)
    return q.all()
