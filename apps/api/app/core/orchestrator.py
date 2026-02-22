import os
from sqlalchemy.orm import Session
from app.core.agents import RiskAgent, CostAgent, SlaAgent, AgentResult
from app.ai.llm_agent import LlmDecisionAgent


def orchestrate(event: dict, db: Session) -> dict:
    """
    Hybrid orchestration:
    - Deterministic agents (Risk, Cost, SLA)
    - Optional LLM RAG agent (only when OPENAI_API_KEY is set)
    - Hard overrides
    - Voting logic
    """

    deterministic_agents = [RiskAgent(), CostAgent(), SlaAgent()]
    results: list[AgentResult] = []

    # Run deterministic agents
    for agent in deterministic_agents:
        results.append(agent.evaluate(event))

    # Run LLM agent only if API key is present
    api_key = os.getenv("OPENAI_API_KEY", "").strip()
    if api_key:
        try:
            llm_agent = LlmDecisionAgent()
            llm_result = llm_agent.evaluate(event, db)
            results.append(
                AgentResult(
                    name=llm_result["name"],
                    recommendation=llm_result["recommendation"],
                    reason=llm_result["reason"],
                    score=llm_result["score"],
                )
            )
        except Exception:
            # If LLM fails, skip it entirely (do NOT add a 4th agent)
            # This keeps tests stable and avoids noisy traces.
            pass

    # =============================
    # HARD OVERRIDE 1: PRIORITY
    # =============================
    if bool(event.get("priority_flag", False)):
        return _override_response(results, "PRIORITY_FLAG")

    # =============================
    # HARD OVERRIDE 2: HIGH VALUE
    # =============================
    order_value = float(event.get("order_value", 0.0))
    if order_value >= 100000:
        return _override_response(results, "HIGH_ORDER_VALUE")

    # =============================
    # HYBRID VOTING LOGIC
    # =============================

    # Weighted voting:
    # Deterministic agents = 1 vote each
    # LLM = 1.5 vote weight (only if present)
    escalate_score = 0.0

    for r in results:
        if r.recommendation == "ESCALATE":
            escalate_score += 1.5 if r.name == "LlmDecisionAgent" else 1.0

    # Threshold logic:
    # - With 3 deterministic agents: ESCALATE if >= 2
    # - With LLM included: still works because score range increases
    final_decision = "ESCALATE" if escalate_score >= 2 else "AUTO_RESOLVE"

    avg_score = sum(r.score for r in results) / len(results) if results else 0.0

    key_reasons = [r.reason for r in results if r.recommendation == "ESCALATE"]
    if key_reasons:
        reason = "Escalated because: " + " | ".join(key_reasons)
    else:
        reason = "Auto-resolved: low combined risk across agents."

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
            "weighted_escalate_score": escalate_score,
            "avg_score": avg_score,
        },
    }

    return {
        "decision": final_decision,
        "reason": reason,
        "confidence": round(min(1.0, 0.5 + avg_score / 2), 3),
        "context": context,
    }


# =============================
# OVERRIDE HELPER
# =============================
def _override_response(results: list[AgentResult], override_type: str) -> dict:
    avg_score = sum(r.score for r in results) / len(results) if results else 0.0

    return {
        "decision": "ESCALATE",
        "reason": f"Escalated due to override: {override_type}",
        "confidence": 1.0,
        "context": {
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
                "override": override_type,
                "avg_score": avg_score,
            },
        },
    }