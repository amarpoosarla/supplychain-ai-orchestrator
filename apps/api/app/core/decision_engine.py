from app.core.policy import POLICY

def decide_shipment_delay(event: dict) -> tuple[str, str, float]:
    """
    Returns: (decision, reason, confidence)
    v1: deterministic rules, confidence = 1.0 for rule-based
    """
    delay_days = int(event.get("delay_days", 0))
    inventory_days = int(event.get("inventory_days_of_supply", 0))
    order_value = float(event.get("order_value", 0))
    priority_flag = bool(event.get("priority_flag", False))

    if POLICY["ESCALATE_IF_PRIORITY"] and priority_flag:
        return ("ESCALATE", "Priority shipment: requires human review", 1.0)

    if order_value >= POLICY["ESCALATE_IF_ORDER_VALUE_GTE"]:
        return ("ESCALATE", f"High order value >= {POLICY['ESCALATE_IF_ORDER_VALUE_GTE']}", 1.0)

    if delay_days > POLICY["MAX_DELAY_DAYS_AUTO_RESOLVE"]:
        return ("ESCALATE", f"Delay days {delay_days} exceeds threshold", 1.0)

    if inventory_days < POLICY["MIN_INVENTORY_DAYS_FOR_AUTO_RESOLVE"]:
        return ("ESCALATE", f"Inventory buffer {inventory_days} days below threshold", 1.0)

    return ("AUTO_RESOLVE", "Meets auto-resolve policy thresholds", 1.0)