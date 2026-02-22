import os
import json
from time import perf_counter
from typing import Optional

from openai import OpenAI
from sqlalchemy.orm import Session
from sqlalchemy import select, or_, and_

from app.ai.embeddings import get_embedding
from app.db.models import KnowledgeChunk

# Optional: your org-style loggers (fallback to print if not available)
try:
    from app.core.logging import FullLogInfo, FullLogError  # type: ignore
except Exception:  # pragma: no cover
    def FullLogInfo(msg: str) -> None:
        print(msg)

    def FullLogError(msg: str) -> None:
        print(msg)


client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))


class LlmDecisionAgent:
    name = "LlmDecisionAgent"

    def _dedup_keep_order(self, items: list[str]) -> list[str]:
        seen = set()
        out = []
        for t in items:
            key = (t or "").strip()
            if not key:
                continue
            if key in seen:
                continue
            seen.add(key)
            out.append(key)
        return out

    def _retrieve_knowledge(
        self,
        db: Session,
        query_embedding: list[float],
        supplier_id: Optional[str],
        region: Optional[str],
        doc_type: Optional[str] = None,
        top_k: int = 5,
    ) -> str:
        """
        Retrieves top_k knowledge chunks with metadata scoping:
        - Prefer exact supplier_id/region/doc_type
        - Allow NULL (global rules)
        Uses SQLAlchemy expression API so pgvector typing works correctly.
        """
        t0 = perf_counter()

        filters = []

        # supplier scope: supplier_id match OR global (NULL)
        if supplier_id is not None:
            filters.append(or_(KnowledgeChunk.supplier_id == supplier_id, KnowledgeChunk.supplier_id.is_(None)))

        # region scope: region match OR global (NULL)
        if region is not None:
            filters.append(or_(KnowledgeChunk.region == region, KnowledgeChunk.region.is_(None)))

        # doc_type scope (optional): doc_type match OR global (NULL)
        if doc_type is not None:
            filters.append(or_(KnowledgeChunk.doc_type == doc_type, KnowledgeChunk.doc_type.is_(None)))

        stmt = select(KnowledgeChunk.chunk_text)

        if filters:
            stmt = stmt.where(and_(*filters))

        # Distance ordering (pick ONE distance metric; cosine is common for OpenAI embeddings)
        stmt = stmt.order_by(KnowledgeChunk.embedding.cosine_distance(query_embedding)).limit(top_k)

        rows = db.execute(stmt).scalars().all()
        rows = self._dedup_keep_order(rows)

        elapsed_ms = round((perf_counter() - t0) * 1000, 2)
        FullLogInfo(
            f"[{self.name}] Retrieved {len(rows)} chunks (top_k={top_k}) "
            f"for supplier_id={supplier_id}, region={region}, doc_type={doc_type} in {elapsed_ms} ms"
        )

        return "\n".join(rows) if rows else ""

    def _safe_json_loads(self, text: str) -> dict | None:
        if not text:
            return None

        cleaned = text.strip()

        # Strip ```json fences if present
        if cleaned.startswith("```"):
            cleaned = cleaned.strip("`").strip()
            if cleaned.lower().startswith("json"):
                cleaned = cleaned[4:].strip()

        try:
            return json.loads(cleaned)
        except Exception:
            return None

    def evaluate(self, event: dict, db: Session) -> dict:
        """
        Uses RAG (retrieval + LLM reasoning) to recommend:
        - ESCALATE
        - AUTO_RESOLVE
        """
        t0 = perf_counter()

        try:
            # Step 1: Embed the event for retrieval
            query_text = json.dumps(event, sort_keys=True)
            query_embedding = get_embedding(query_text)

            supplier_id = event.get("supplier_id")
            region = event.get("region")
            # If you store doc_type on chunks and want to force it:
            # doc_type = "SLA" or "SOP" depending on your use, or None to allow all
            doc_type = None

            knowledge_context = self._retrieve_knowledge(
                db=db,
                query_embedding=query_embedding,
                supplier_id=supplier_id,
                region=region,
                doc_type=doc_type,
                top_k=5,
            )

            # Step 2: Prompt
            prompt = f"""
You are an AI supply chain risk analyst.

Shipment data:
{json.dumps(event, indent=2)}

Relevant SLA/SOP rules:
{knowledge_context}

Based on the shipment data and rules:
1. Decide: ESCALATE or AUTO_RESOLVE
2. Explain reasoning
3. Provide confidence between 0 and 1

Return JSON only (no markdown, no extra text):
{{
  "decision": "ESCALATE|AUTO_RESOLVE",
  "reason": "string",
  "confidence": 0.0
}}
""".strip()

            # Step 3: LLM call
            resp = client.chat.completions.create(
                model="gpt-4o-mini",
                temperature=0.2,
                messages=[
                    {"role": "system", "content": "You are a structured decision engine. Output JSON only."},
                    {"role": "user", "content": prompt},
                ],
            )

            output_text = resp.choices[0].message.content or ""
            parsed = self._safe_json_loads(output_text) or {
                "decision": "ESCALATE",
                "reason": "LLM parsing failed (non-JSON response).",
                "confidence": 0.5,
            }

            decision = str(parsed.get("decision", "ESCALATE")).strip().upper()
            if decision not in {"ESCALATE", "AUTO_RESOLVE"}:
                decision = "ESCALATE"

            try:
                confidence = float(parsed.get("confidence", 0.5))
            except Exception:
                confidence = 0.5
            confidence = max(0.0, min(1.0, confidence))

            reason = str(parsed.get("reason", "No reason provided")).strip()

            elapsed_ms = round((perf_counter() - t0) * 1000, 2)
            FullLogInfo(f"[{self.name}] Decision={decision}, confidence={confidence} in {elapsed_ms} ms")

            return {
                "name": self.name,
                "recommendation": decision,
                "reason": reason,
                "score": confidence,
            }

        except Exception as e:
            FullLogError(f"[{self.name}] Failed evaluate(): {repr(e)}")
            return {
                "name": self.name,
                "recommendation": "ESCALATE",
                "reason": "LLM agent failed; safe default escalation.",
                "score": 0.5,
            }