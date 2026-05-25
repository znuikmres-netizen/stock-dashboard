from datetime import datetime, timezone
from typing import Any, List, Optional

from sqlalchemy import (
    BigInteger,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    JSON,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


_PK = BigInteger().with_variant(Integer, "sqlite")


class Message(Base):
    __tablename__ = "messages"

    id: Mapped[int] = mapped_column(_PK, primary_key=True, autoincrement=True)
    source: Mapped[str] = mapped_column(Text, nullable=False)
    source_type: Mapped[str] = mapped_column(Text, nullable=False)
    title: Mapped[Optional[str]] = mapped_column(Text)
    url: Mapped[Optional[str]] = mapped_column(Text)
    published_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    market_view: Mapped[Optional[str]] = mapped_column(Text)
    bullets: Mapped[Optional[list]] = mapped_column(JSON)
    raw: Mapped[Optional[dict]] = mapped_column(JSON)
    ingested_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)

    stocks: Mapped[List["MessageStock"]] = relationship(
        back_populates="message",
        cascade="all, delete-orphan",
        lazy="selectin",
    )

    __table_args__ = (
        UniqueConstraint("source", "url", name="uq_messages_source_url"),
        Index("ix_messages_published_at", "published_at"),
    )


class MessageStock(Base):
    __tablename__ = "message_stocks"

    id: Mapped[int] = mapped_column(_PK, primary_key=True, autoincrement=True)
    message_id: Mapped[int] = mapped_column(ForeignKey("messages.id", ondelete="CASCADE"), nullable=False)
    ticker: Mapped[str] = mapped_column(Text, nullable=False)
    name: Mapped[Optional[str]] = mapped_column(Text)
    view: Mapped[Optional[str]] = mapped_column(Text)
    sentiment: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)

    message: Mapped[Message] = relationship(back_populates="stocks")

    __table_args__ = (
        Index("ix_message_stocks_ticker", "ticker"),
        Index("ix_message_stocks_message_id", "message_id"),
    )


class KlineCache(Base):
    __tablename__ = "kline_cache"

    ticker: Mapped[str] = mapped_column(Text, primary_key=True)
    period: Mapped[str] = mapped_column(Text, primary_key=True)
    data: Mapped[list] = mapped_column(JSON, nullable=False)
    fetched_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
