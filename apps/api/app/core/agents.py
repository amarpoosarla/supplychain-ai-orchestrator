from dataclasses import dataclass
from typing import Protocol


@dataclass
class AgentResult:
    name: str
    score: float  # 0.0 to 1.0
    recommendation: str  # "AUTO_RESOLVE" or "ESCALATE"
    reason: str


class Agent(Protocol):
    name: str

    def evaluate(self, event: dict) -> AgentResult:
        ...


class RiskAgent:
    name = "RiskAgent"

    def evaluate(self, event: dict) -> AgentResult:
        delay_days = int(event.get("delay_days", 0))
        inventory_days = int(event.get("inventory_days_of_supply", 0))

        # simple risk heuristic
        score = 0.0
        reasons = []

        if delay_days >= 3:
            score += 0.5
            reasons.append(f"delay_days={delay_days} (high)")
        elif delay_days == 2:
            score += 0.25
            reasons.append(f"delay_days={delay_days} (moderate)")

        if inventory_days < 7:
            score += 0.6
            reasons.append(f"inventory_days={inventory_days} (low)")

        score = min(score, 1.0)

        rec = "ESCALATE" if score >= 0.6 else "AUTO_RESOLVE"
        reason = " | ".join(reasons) if reasons else "Low operational risk"
        return AgentResult(self.name, score, rec, reason)


class CostAgent:
    name = "CostAgent"

    def evaluate(self, event: dict) -> AgentResult:
        order_value = float(event.get("order_value", 0.0))

        # high value orders should lean escalation
        if order_value >= 100000:
            return AgentResult(self.name, 0.9, "ESCALATE", f"order_value={order_value} (high)")
        if order_value >= 50000:
            return AgentResult(self.name, 0.6, "ESCALATE", f"order_value={order_value} (medium-high)")
        return AgentResult(self.name, 0.2, "AUTO_RESOLVE", f"order_value={order_value} (normal)")


class SlaAgent:
    name = "SlaAgent"

    def evaluate(self, event: dict) -> AgentResult:
        delay_days = int(event.get("delay_days", 0))
        priority_flag = bool(event.get("priority_flag", False))

        if priority_flag:
            return AgentResult(self.name, 0.95, "ESCALATE", "priority_flag=true")
        if delay_days > 2:
            return AgentResult(self.name, 0.85, "ESCALATE", f"delay_days={delay_days} exceeds SLA buffer")
        return AgentResult(self.name, 0.25, "AUTO_RESOLVE", "Within SLA buffer")