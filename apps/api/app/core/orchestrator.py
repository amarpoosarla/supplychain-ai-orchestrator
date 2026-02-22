from app.core.agents import RiskAgent, CostAgent, SlaAgent, AgentResult


def orchestrate(event: dict) -> dict:
    agents = [RiskAgent(), CostAgent(), SlaAgent()]
    results: list[AgentResult] = [a.evaluate(event) for a in agents]

    # Hard override: priority shipments must escalate
    if bool(event.get("priority_flag", False)):
        avg_score = sum(r.score for r in results) / len(results)

        key_reasons = [r.reason for r in results if r.recommendation == "ESCALATE"]
        reason = "Escalated because: priority shipment (priority_flag=true)"
        if key_reasons:
            reason += " | " + " | ".join(key_reasons)

        context = {
            "agent_trace": [
                {
                    "name": r.name,
                    "score": r.score,
                    "recommendation": r.recommendation,
                    "reason": r.reason,
                }
                for r in results
            ],
            "final": {
                "decision": "ESCALATE",
                "votes_escalate": len(results),
                "avg_score": avg_score,
                "override": "PRIORITY_FLAG",
            },
        }

        return {
            "decision": "ESCALATE",
            "reason": reason,
            "confidence": 1.0,
            "context": context,
        }

    # Normal voting rule: if 2+ agents say ESCALATE, escalate
    escalate_votes = sum(1 for r in results if r.recommendation == "ESCALATE")
    final_decision = "ESCALATE" if escalate_votes >= 2 else "AUTO_RESOLVE"

    avg_score = sum(r.score for r in results) / len(results)

    key_reasons = [r.reason for r in results if r.recommendation == "ESCALATE"]
    if key_reasons:
        reason = "Escalated because: " + " | ".join(key_reasons)
    else:
        reason = "Auto-resolved: all agents indicate low risk."

    context = {
        "agent_trace": [
            {
                "name": r.name,
                "score": r.score,
                "recommendation": r.recommendation,
                "reason": r.reason,
            }
            for r in results
        ],
        "final": {
            "decision": final_decision,
            "votes_escalate": escalate_votes,
            "avg_score": avg_score,
        },
    }

    return {
        "decision": final_decision,
        "reason": reason,
        "confidence": round(min(1.0, 0.5 + avg_score / 2), 3),
        "context": context,
    }