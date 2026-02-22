import uuid
import pytest
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def create_work_item(event: dict) -> str:
    r = client.post("/work-items", json={"event": event})
    assert r.status_code == 200, r.text
    work_item_id = r.json()["id"]
    uuid.UUID(work_item_id)  # validates uuid format
    return work_item_id


def run_work_item(work_item_id: str) -> dict:
    r = client.post(f"/work-items/{work_item_id}/run")
    assert r.status_code == 200, r.text
    return r.json()


def get_work_item(work_item_id: str) -> dict:
    r = client.get(f"/work-items/{work_item_id}")
    assert r.status_code == 200, r.text
    return r.json()


@pytest.mark.parametrize(
    "event, expected_status",
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
        ),
        (
            {
                "shipment_id": "T-2001",
                "supplier_id": "SUP-001",
                "original_eta": "2026-03-01",
                "updated_eta": "2026-03-02",
                "delay_days": 1,
                "inventory_days_of_supply": 14,
                "order_value": 25000,
                "region": "US-CENTRAL",
                "priority_flag": True,
            },
            "ESCALATED",
        ),
    ],
)
def test_end_to_end_run_sets_status(event, expected_status):
    work_item_id = create_work_item(event)
    run_resp = run_work_item(work_item_id)
    assert run_resp["new_status"] == expected_status

    wi = get_work_item(work_item_id)
    assert wi["status"] == expected_status