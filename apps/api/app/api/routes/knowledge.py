from __future__ import annotations

from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from sqlalchemy import text

from app.db.session import get_db
from app.db.models import KnowledgeChunk
from app.ai.embeddings import get_embedding

router = APIRouter(prefix="/knowledge", tags=["knowledge"])


class KnowledgeIngestRequest(BaseModel):
    source: str = Field(..., max_length=200)
    chunk_text: str = Field(..., min_length=1)
    doc_type: Optional[str] = Field(default=None, max_length=50)
    supplier_id: Optional[str] = Field(default=None, max_length=50)
    region: Optional[str] = Field(default=None, max_length=50)


class KnowledgeIngestResponse(BaseModel):
    status: str
    source: str
    id: str
    deduped: bool


class KnowledgeQueryItem(BaseModel):
    id: str
    source: str
    similarity: float
    text: str


def _find_duplicate(
    db: Session,
    *,
    source: str,
    chunk_text: str,
    supplier_id: Optional[str],
    region: Optional[str],
    doc_type: Optional[str],
) -> Optional[str]:
    """
    Returns existing knowledge_chunks.id if an identical record already exists.
    Important: Cast nullable params so Postgres can infer types safely.
    """
    row = db.execute(
        text(
            """
            SELECT id
            FROM knowledge_chunks
            WHERE source = :source
              AND chunk_text = :chunk_text
              AND (CAST(:supplier_id AS text) IS NULL OR supplier_id = CAST(:supplier_id AS text))
              AND (CAST(:region AS text) IS NULL OR region = CAST(:region AS text))
              AND (CAST(:doc_type AS text) IS NULL OR doc_type = CAST(:doc_type AS text))
            LIMIT 1
            """
        ),
        {
            "source": source,
            "chunk_text": chunk_text,
            "supplier_id": supplier_id,
            "region": region,
            "doc_type": doc_type,
        },
    ).first()

    if not row:
        return None
    return str(row.id)


@router.post("/ingest", response_model=KnowledgeIngestResponse)
def ingest_chunk(req: KnowledgeIngestRequest, db: Session = Depends(get_db)):
    try:
        # 1) Dedup check
        dup_id = _find_duplicate(
            db,
            source=req.source,
            chunk_text=req.chunk_text,
            supplier_id=req.supplier_id,
            region=req.region,
            doc_type=req.doc_type,
        )
        if dup_id:
            return {
                "status": "stored",
                "source": req.source,
                "id": dup_id,
                "deduped": True,
            }

        # 2) Embed + insert
        embedding = get_embedding(req.chunk_text)

        chunk = KnowledgeChunk(
            source=req.source,
            doc_type=req.doc_type,
            supplier_id=req.supplier_id,
            region=req.region,
            chunk_text=req.chunk_text,
            embedding=embedding,
        )

        db.add(chunk)
        db.commit()
        db.refresh(chunk)

        return {
            "status": "stored",
            "source": req.source,
            "id": str(chunk.id),
            "deduped": False,
        }

    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to ingest knowledge chunk: {e}")


@router.get("/query", response_model=List[KnowledgeQueryItem])
def query_knowledge(query: str, top_k: int = 3, db: Session = Depends(get_db)):
    try:
        embedding = get_embedding(query)

        # NOTE: cast to ::vector so pgvector operator resolves types
        result = db.execute(
            text(
                """
                SELECT id, source, chunk_text,
                       1 - (embedding <=> (:embedding)::vector) AS similarity
                FROM knowledge_chunks
                ORDER BY embedding <=> (:embedding)::vector
                LIMIT :top_k
                """
            ),
            {"embedding": embedding, "top_k": top_k},
        )

        rows = result.fetchall()
        return [
            {
                "id": str(r.id),
                "source": r.source,
                "similarity": float(r.similarity),
                "text": r.chunk_text,
            }
            for r in rows
        ]

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Knowledge query failed: {e}")