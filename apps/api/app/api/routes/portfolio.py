from fastapi import APIRouter
from pydantic import BaseModel
from uuid import uuid4

router = APIRouter(prefix="/portfolio", tags=["portfolio"])


class GradePortfolioRequest(BaseModel):
    candidate_name: str | None = None
    target_role: str | None = None
    portfolio_url: str | None = None
    notes: str | None = None
    content_text: str | None = None


class PortfolioRubric(BaseModel):
    overall: int
    impact: int
    clarity: int
    technical_depth: int
    relevance: int
    presentation: int


class GradePortfolioResponse(BaseModel):
    report_id: str
    rubric: PortfolioRubric
    strengths: list[str]
    gaps: list[str]
    recommendations: list[str]
    rewritten_bullets: list[str] | None = None


@router.post("/grade", response_model=GradePortfolioResponse)
def grade_portfolio(req: GradePortfolioRequest):
    rid = str(uuid4())

    has_text = bool(req.content_text and len(req.content_text.strip()) > 200)
    base = 72 if has_text else 58

    rubric = PortfolioRubric(
        overall=base,
        impact=base - 5,
        clarity=base - 8,
        technical_depth=base - 3,
        relevance=base - 6,
        presentation=base - 10,
    )

    return GradePortfolioResponse(
        report_id=rid,
        rubric=rubric,
        strengths=[
            "Target role provided" if req.target_role else "Role missing",
            "Text provided" if req.content_text else "No text provided",
        ],
        gaps=[
            "Add measurable impact (latency, cost, accuracy, throughput)",
            "Add 1–2 standout projects with architecture + results",
        ],
        recommendations=[
            "Add metrics per project (before/after) and scope",
            "Add links: GitHub + demo + a 1-page case study",
            "Add a short skills summary aligned to target role",
        ],
        rewritten_bullets=[
            "Built a rubric-based portfolio grader that outputs scores, feedback, and action items in a consistent report format.",
            "Designed a Next.js + FastAPI workflow with traceable decisions to support review and iteration.",
        ],
    )