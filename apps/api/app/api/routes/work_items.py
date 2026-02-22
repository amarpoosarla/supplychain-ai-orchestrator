import uuid
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from typing import Optional
from app.db.session import get_db
from app.db.models import WorkItem
from app.core.decision_engine import decide_shipment_delay
from app.db.models import Decision
from sqlalchemy import select

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

    decision, reason, confidence = decide_shipment_delay(wi.payload)

    wi.status = "AUTO_RESOLVED" if decision == "AUTO_RESOLVE" else "ESCALATED"

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