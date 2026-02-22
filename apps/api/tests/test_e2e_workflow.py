import uuid
import pytest
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def create_work_item(event: dict) -> str:
    r = client.post("/work-items", json={"event": event})
    assert r.status_code == 200, r.text
    work_item_id = r.json()["id"]
    uuid.UUID(work_item_id)
    return work_item_id


def run_work_item(work_item_id: str) -> dict:
    r = client.post(f"/work-items/{work_item_id}/run")
    assert r.status_code == 200, r.text
    return r.json()


def trace(work_item_id: str) -> dict:
    r = client.get(f"/work-items/{work_item_id}/trace")
    assert r.status_code == 200, r.text
    return r.json()


@pytest.mark.parametrize(
    "event, expected_status, expected_reason_prefix",
    [
        (
            {
                "shipment_id": "T-1001",
                "supplier_id": "SUP-001",
                "original_eta": "2026-03-01",
                "updated_eta": "2026-03-02",
                "delay_days": 1,
                "inventory_days_of_supply": 14,
                "order_value": 25000,
                "region": "US-CENTRAL",
                "priority_flag": False,
            },
            "AUTO_RESOLVED",
            "Auto-resolved:",
        ),
        (
            {
                "shipment_id": "T-3002",
                "supplier_id": "SUP-001",
                "original_eta": "2026-03-01",
                "updated_eta": "2026-03-04",
                "delay_days": 3,
                "inventory_days_of_supply": 5,
                "order_value": 80000,
                "region": "US-CENTRAL",
                "priority_flag": False,
            },
            "ESCALATED",
            "Escalated because:",
        ),
    ],
)
def test_multi_agent_orchestrator_trace(event, expected_status, expected_reason_prefix):
    work_item_id = create_work_item(event)

    run_resp = run_work_item(work_item_id)
    assert run_resp["new_status"] == expected_status

    t = trace(work_item_id)
    ctx = t["work_item"]["context"]
    assert ctx is not None

    # validate agent trace
    agent_trace = ctx["agent_trace"]
    assert isinstance(agent_trace, list)
    assert len(agent_trace) == 3
    names = sorted([a["name"] for a in agent_trace])
    assert names == ["CostAgent", "RiskAgent", "SlaAgent"]

    # validate final summary exists
    final = ctx["final"]
    assert "decision" in final
    assert "votes_escalate" in final
    assert "avg_score" in final

    # validate decision record reason formatting
    decisions = t["decisions"]
    assert len(decisions) >= 1
    assert decisions[0]["reason"].startswith(expected_reason_prefix)