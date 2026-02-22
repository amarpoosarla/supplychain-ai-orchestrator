from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.routes.health import router as health_router
from app.api.routes.work_items import router as work_items_router
from app.api.routes.knowledge import router as knowledge_router

from app.db.session import init_db

app = FastAPI(
    title="Supply Chain AI Orchestrator",
    version="0.1.0",
    description="Decision automation + escalation (human-in-the-loop) for supply chain exceptions."
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # Next.js dev server
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def _startup():
    init_db()

app.include_router(health_router)
app.include_router(work_items_router)
app.include_router(knowledge_router)   # 👈 THIS LINE IS REQUIRED


@app.get("/version", tags=["meta"])
def version():
    return {"version": app.version, "service": app.title}