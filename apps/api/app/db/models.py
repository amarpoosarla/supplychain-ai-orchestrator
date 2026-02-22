import uuid
from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, String, Text, Column
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from pgvector.sqlalchemy import Vector

from app.db.session import Base


class WorkItem(Base):
    __tablename__ = "work_items"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    type: Mapped[str] = mapped_column(String(50), nullable=False)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="NEW")

    payload: Mapped[dict] = mapped_column(JSONB, nullable=False)
    context: Mapped[dict | None] = mapped_column(JSONB, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    decisions: Mapped[list["Decision"]] = relationship(
        "Decision",
        back_populates="work_item",
        lazy="selectin",
        cascade="all, delete-orphan",
    )


class Decision(Base):
    __tablename__ = "decisions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    work_item_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("work_items.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    decision: Mapped[str] = mapped_column(String(30), nullable=False)
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    confidence: Mapped[float] = mapped_column(Float, nullable=False, default=1.0)
    created_by: Mapped[str | None] = mapped_column(String(120), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    work_item: Mapped["WorkItem"] = relationship(
        "WorkItem",
        back_populates="decisions",
    )


class KnowledgeChunk(Base):
    __tablename__ = "knowledge_chunks"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    source = Column(String(200), nullable=False)       # ex: "SLA_SUP-001"
    doc_type = Column(String(50), nullable=True)       # ex: "SLA", "SOP"
    supplier_id = Column(String(50), nullable=True)    # ex: "SUP-001"
    region = Column(String(50), nullable=True)         # ex: "US-CENTRAL"

    chunk_text = Column(Text, nullable=False)

    # Start with 1536 dims (fits common embedding models). We can change later.
    embedding = Column(Vector(1536), nullable=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)