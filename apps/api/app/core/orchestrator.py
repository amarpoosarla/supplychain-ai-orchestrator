import os
from sqlalchemy.orm import Session

from app.core.agents import RiskAgent, CostAgent, SlaAgent, AgentResult
from app.ai.llm_agent import LlmDecisionAgent


def _is_llm_enabled() -> bool:
    """
    LLM should be enabled only when an API key is present and not explicitly disabled.
    This makes CI deterministic and prevents failures when OPENAI_API_KEY is missing.
    """
    if os.getenv("DISABLE_LLM", "").lower() in {"1", "true", "yes"}:
        return False
    return bool(os.getenv("OPENAI_API_KEY"))


def orchestrate(event: dict, db: Session) -> dict:
    """
    Hybrid orchestration:
    - Deterministic agents (Risk, Cost, SLA)
    - Optional LLM agent (RAG)
    - Hard overrides
    - Voting logic
    """

    deterministic_agents = [RiskAgent(), CostAgent(), SlaAgent()]
    llm_agent = LlmDecisionAgent()

    # Always collect agent_trace items here
    results: list[AgentResult] = []

    # Run deterministic agents (always)
    for agent in deterministic_agents:
        results.append(agent.evaluate(event))

    # Run LLM agent only if enabled, but ALWAYS add a trace record for it
    llm_enabled = _is_llm_enabled()
    if llm_enabled:
        llm_result = llm_agent.evaluate(event, db)
        llm_trace = AgentResult(
            name=llm_result["name"],
            recommendation=llm_result["recommendation"],
            reason=llm_result["reason"],
            score=llm_result["score"],
        )
    else:
        # IMPORTANT: still include LLM in trace, but make it neutral and excluded from voting
        llm_trace = AgentResult(
            name="LlmDecisionAgent",
            recommendation="AUTO_RESOLVE",
            reason="LLM disabled (missing OPENAI_API_KEY or DISABLE_LLM=1).",
            score=0.0,
        )

    results.append(llm_trace)

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
    # Deterministic agents count always.
    # LLM contributes only if enabled.
    escalate_score = 0.0
    votes_escalate = 0

    for r in results:
        # Skip LLM in voting if disabled
        if r.name == "LlmDecisionAgent" and not llm_enabled:
            continue

        if r.recommendation == "ESCALATE":
            votes_escalate += 1
            if r.name == "LlmDecisionAgent":
                escalate_score += 1.5
            else:
                escalate_score += 1.0

    final_decision = "ESCALATE" if escalate_score >= 2 else "AUTO_RESOLVE"

    # avg_score should be computed consistently
    scoring_results = [r for r in results if not (r.name == "LlmDecisionAgent" and not llm_enabled)]
    avg_score = sum(r.score for r in scoring_results) / max(1, len(scoring_results))

    key_reasons = [
        r.reason
        for r in scoring_results
        if r.recommendation == "ESCALATE"
    ]

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
            "votes_escalate": votes_escalate,
            "weighted_escalate_score": escalate_score,
            "avg_score": avg_score,
            "llm_enabled": llm_enabled,
        },
    }

    return {
        "decision": final_decision,
        "reason": reason,
        "confidence": round(min(1.0, 0.5 + avg_score / 2), 3),
        "context": context,
    }


def _override_response(results: list[AgentResult], override_type: str) -> dict:
    avg_score = sum(r.score for r in results) / max(1, len(results))

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
                "llm_enabled": _is_llm_enabled(),
            },
        },
    }