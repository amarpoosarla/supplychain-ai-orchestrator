from fastapi import FastAPI
from app.api.routes.health import router as health_router
from app.api.routes.work_items import router as work_items_router

from app.db.session import Base, engine
from app.db import models  # noqa: F401

app = FastAPI(
    title="Supply Chain AI Orchestrator",
    version="0.1.0",
    description="Decision automation + escalation (human-in-the-loop) for supply chain exceptions."
)

Base.metadata.create_all(bind=engine)

app.include_router(health_router)
app.include_router(work_items_router)


@app.get("/version", tags=["meta"])
def version():
    return {"version": app.version, "service": app.title}