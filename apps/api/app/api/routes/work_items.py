import uuid
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from typing import Optional
from app.db.session import get_db
from app.db.models import WorkItem
from app.db.models import Decision
from sqlalchemy import select
from app.core.orchestrator import orchestrate
from app.core.scenarios import SCENARIOS
from sqlalchemy import func

router = APIRouter(prefix="/work-items", tags=["work-items"])


class ShipmentDelayEvent(BaseModel):
    shipment_id: str = Field(..., max_length=50)
    supplier_id: str = Field(..., max_length=50)
    original_eta: str
    updated_eta: str
    delay_days: int = Field(..., ge=0, le=365)
    inventory_days_of_supply: int = Field(..., ge=0, le=365)
    order_value: float = Field(..., ge=0)
    region: str = Field(..., max_length=50)
    priority_flag: bool


class WorkItemCreateRequest(BaseModel):
    event: ShipmentDelayEvent


class WorkItemResponse(BaseModel):
    id: str
    type: str
    status: str
    payload: dict
    context: dict | None


@router.post("", response_model=WorkItemResponse)
def create_work_item(req: WorkItemCreateRequest, db: Session = Depends(get_db)):
    wi = WorkItem(
        type="SHIPMENT_DELAY",
        status="NEW",
        payload=req.event.model_dump(),
        context=None,
    )
    db.add(wi)
    db.commit()
    db.refresh(wi)

    return WorkItemResponse(
        id=str(wi.id),
        type=wi.type,
        status=wi.status,
        payload=wi.payload,
        context=wi.context,
    )


@router.get("/{work_item_id}", response_model=WorkItemResponse)
def get_work_item(work_item_id: str, db: Session = Depends(get_db)):
    try:
        wi_uuid = uuid.UUID(work_item_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid work_item_id")

    wi = db.get(WorkItem, wi_uuid)
    if not wi:
        raise HTTPException(status_code=404, detail="WorkItem not found")

    return WorkItemResponse(
        id=str(wi.id),
        type=wi.type,
        status=wi.status,
        payload=wi.payload,
        context=wi.context,
    )

@router.post("/{work_item_id}/run")
def run_work_item(work_item_id: str, db: Session = Depends(get_db)):
    try:
        wi_uuid = uuid.UUID(work_item_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid work_item_id")

    wi = db.get(WorkItem, wi_uuid)
    if not wi:
        raise HTTPException(status_code=404, detail="WorkItem not found")

    # ---- MULTI-AGENT ORCHESTRATION ----
    out = orchestrate(wi.payload)

    decision = out["decision"]
    reason = out["reason"]
    confidence = float(out["confidence"])

    # Store explainability trace in context
    wi.context = out["context"]

    # Update status
    wi.status = "AUTO_RESOLVED" if decision == "AUTO_RESOLVE" else "ESCALATED"

    # Persist decision record
    d = Decision(
        work_item_id=wi.id,
        decision=decision,
        reason=reason,
        confidence=confidence,
    )

    db.add(d)
    db.add(wi)
    db.commit()

    return {
        "work_item_id": str(wi.id),
        "new_status": wi.status,
        "decision": decision,
        "reason": reason,
        "confidence": confidence,
        "agent_summary": wi.context["final"],
    }

class HumanReviewRequest(BaseModel):
    action: str = Field(..., pattern="^(APPROVE|REJECT)$")
    reviewer: str = Field(..., max_length=120)
    comment: str = Field(..., max_length=500)

@router.post("/{work_item_id}/review")
def review_work_item(work_item_id: str, req: HumanReviewRequest, db: Session = Depends(get_db)):
    try:
        wi_uuid = uuid.UUID(work_item_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid work_item_id")

    wi = db.get(WorkItem, wi_uuid)
    if not wi:
        raise HTTPException(status_code=404, detail="WorkItem not found")

    if wi.status != "ESCALATED":
        raise HTTPException(status_code=400, detail=f"WorkItem status must be ESCALATED, got {wi.status}")

    final_status = "HUMAN_APPROVED" if req.action == "APPROVE" else "HUMAN_REJECTED"
    wi.status = final_status

    d = Decision(
        work_item_id=wi.id,
        decision=req.action,
        reason=req.comment,
        confidence=1.0,
        created_by=req.reviewer,
    )

    db.add(d)
    db.add(wi)
    db.commit()

    return {
        "work_item_id": str(wi.id),
        "final_status": wi.status,
        "reviewer": req.reviewer
    }

class DecisionResponse(BaseModel):
    id: str
    decision: str
    reason: str
    confidence: float
    created_by: str | None
    created_at: str


class WorkItemTraceResponse(BaseModel):
    work_item: WorkItemResponse
    decisions: list[DecisionResponse]


@router.get("/{work_item_id}/trace", response_model=WorkItemTraceResponse)
def get_work_item_trace(work_item_id: str, db: Session = Depends(get_db)):
    try:
        wi_uuid = uuid.UUID(work_item_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid work_item_id")

    wi = db.get(WorkItem, wi_uuid)
    if not wi:
        raise HTTPException(status_code=404, detail="WorkItem not found")

    # pull decisions ordered oldest->newest
    decisions = (
        db.execute(
            select(Decision).where(Decision.work_item_id == wi.id).order_by(Decision.created_at.asc())
        )
        .scalars()
        .all()
    )

    return WorkItemTraceResponse(
        work_item=WorkItemResponse(
            id=str(wi.id),
            type=wi.type,
            status=wi.status,
            payload=wi.payload,
            context=wi.context,
        ),
        decisions=[
            DecisionResponse(
                id=str(d.id),
                decision=d.decision,
                reason=d.reason,
                confidence=d.confidence,
                created_by=getattr(d, "created_by", None),
                created_at=d.created_at.isoformat(),
            )
            for d in decisions
        ],
    )

@router.post("/simulate")
def simulate(db: Session = Depends(get_db)):
    """
    Runs a fixed scenario set through the orchestrator and stores results.
    Returns business metrics to tell a strong story in interviews.
    """
    results = []
    auto_resolved = 0
    escalated = 0

    for ev in SCENARIOS:
        out = orchestrate(ev)

        decision = out["decision"]
        status = "AUTO_RESOLVED" if decision == "AUTO_RESOLVE" else "ESCALATED"
        if status == "AUTO_RESOLVED":
            auto_resolved += 1
        else:
            escalated += 1

        wi = WorkItem(
            type="SHIPMENT_DELAY",
            status=status,
            payload=ev,
            context=out["context"],
        )
        db.add(wi)
        db.flush()  # get wi.id without committing yet

        d = Decision(
            work_item_id=wi.id,
            decision=decision,
            reason=out["reason"],
            confidence=float(out["confidence"]),
        )
        db.add(d)

        results.append(
            {
                "work_item_id": str(wi.id),
                "shipment_id": ev["shipment_id"],
                "status": status,
                "decision": decision,
                "confidence": out["confidence"],
                "votes_escalate": out["context"]["final"]["votes_escalate"],
            }
        )

    db.commit()

    total = len(SCENARIOS)
    auto_rate = round(auto_resolved / total, 3)
    esc_rate = round(escalated / total, 3)

    # Simple business impact story (conservative assumptions)
    # Assumption: each escalated case takes 15 min of analyst time.
    # Auto-resolve saves that time. Convert to hours.
    minutes_saved = auto_resolved * 15
    hours_saved = round(minutes_saved / 60.0, 2)

    return {
        "total": total,
        "auto_resolved": auto_resolved,
        "escalated": escalated,
        "auto_resolve_rate": auto_rate,
        "escalation_rate": esc_rate,
        "estimated_hours_saved_per_run": hours_saved,
        "items": results,
    }

@router.get("/simulations/report")
def simulations_report(db: Session = Depends(get_db)):
    # Only simulation items: shipment_id starts with "SIM-"
    # We stored overrides in context.final.override when applicable.
    items = db.query(WorkItem).filter(WorkItem.payload["shipment_id"].astext.like("SIM-%")).all()

    total = len(items)
    if total == 0:
        return {"total": 0, "message": "No simulation items found. Run POST /work-items/simulate first."}

    auto_resolved = sum(1 for w in items if w.status == "AUTO_RESOLVED")
    escalated = sum(1 for w in items if w.status == "ESCALATED")

    def override_bucket(w: WorkItem) -> str:
        try:
            return w.context.get("final", {}).get("override", "NONE") if w.context else "NONE"
        except Exception:
            return "NONE"

    buckets = {}
    for w in items:
        b = override_bucket(w)
        buckets[b] = buckets.get(b, 0) + 1

    return {
        "total": total,
        "auto_resolved": auto_resolved,
        "escalated": escalated,
        "auto_resolve_rate": round(auto_resolved / total, 3),
        "escalation_rate": round(escalated / total, 3),
        "override_breakdown": buckets,
    }

@router.delete("/simulations/reset")
def simulations_reset(db: Session = Depends(get_db)):
    sim_items = db.query(WorkItem).filter(WorkItem.payload["shipment_id"].astext.like("SIM-%")).all()

    deleted_work_items = 0
    deleted_decisions = 0

    for wi in sim_items:
        deleted_decisions += (
            db.query(Decision).filter(Decision.work_item_id == wi.id).delete()
        )
        db.delete(wi)
        deleted_work_items += 1

    db.commit()
    return {
        "deleted_work_items": deleted_work_items,
        "deleted_decisions": deleted_decisions,
    }