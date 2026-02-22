SCENARIOS = [
    # Auto-resolve cases
    {
        "shipment_id": "SIM-1001",
        "supplier_id": "SUP-001",
        "original_eta": "2026-03-01",
        "updated_eta": "2026-03-02",
        "delay_days": 1,
        "inventory_days_of_supply": 14,
        "order_value": 12000,
        "region": "US-CENTRAL",
        "priority_flag": False,
    },
    {
        "shipment_id": "SIM-1002",
        "supplier_id": "SUP-002",
        "original_eta": "2026-03-10",
        "updated_eta": "2026-03-11",
        "delay_days": 1,
        "inventory_days_of_supply": 10,
        "order_value": 30000,
        "region": "US-EAST",
        "priority_flag": False,
    },

    # Escalation due to delay + low inventory
    {
        "shipment_id": "SIM-2001",
        "supplier_id": "SUP-003",
        "original_eta": "2026-04-01",
        "updated_eta": "2026-04-05",
        "delay_days": 4,
        "inventory_days_of_supply": 4,
        "order_value": 18000,
        "region": "US-WEST",
        "priority_flag": False,
    },

    # Escalation due to high order value
    {
        "shipment_id": "SIM-2002",
        "supplier_id": "SUP-004",
        "original_eta": "2026-05-01",
        "updated_eta": "2026-05-03",
        "delay_days": 2,
        "inventory_days_of_supply": 12,
        "order_value": 150000,
        "region": "US-CENTRAL",
        "priority_flag": False,
    },

    # Priority override escalation
    {
        "shipment_id": "SIM-3001",
        "supplier_id": "SUP-005",
        "original_eta": "2026-06-01",
        "updated_eta": "2026-06-02",
        "delay_days": 1,
        "inventory_days_of_supply": 20,
        "order_value": 25000,
        "region": "US-SOUTH",
        "priority_flag": True,
    },
]