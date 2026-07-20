"""
Manufacturing Analytics Platform — FastAPI entrypoint.

Run locally:
    uvicorn app.main:app --reload --port 8000

Interactive API docs: http://localhost:8000/docs
"""
import csv
import json
import os
from pathlib import Path
from fastapi import FastAPI, File, UploadFile, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app import auth, models
from app.database import Base, engine, initialize_database
from app.routers import (
    auth_router, machines_router, production_router,
    downtime_router, maintenance_router, quality_router,
    dashboard_router, reports_router,
)

# Create tables if they don't exist (use Alembic migrations in a real prod rollout)
initialize_database()

UPLOAD_DIR = Path(__file__).resolve().parent.parent / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)

app = FastAPI(
    title="Manufacturing Analytics Platform API",
    description="Enterprise-grade REST API for production, OEE, maintenance, and quality analytics.",
    version="1.0.0",
)

origins = os.getenv("CORS_ORIGINS", "*").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router.router)
app.include_router(auth_router.users_router)
app.include_router(machines_router.router)
app.include_router(machines_router.lines_router)
app.include_router(production_router.router)
app.include_router(downtime_router.router)
app.include_router(maintenance_router.router)
app.include_router(quality_router.router)
app.include_router(dashboard_router.router)
app.include_router(reports_router.router)


@app.get("/api/health", tags=["Health"])
def health_check():
    return {"status": "ok", "service": "manufacturing-analytics-platform"}


@app.post("/api/upload", tags=["Upload"])
async def upload_data(file: UploadFile = File(...), _: models.User = Depends(auth.require_admin)):
    if not file.filename:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No file selected")

    safe_name = Path(file.filename).name
    destination = UPLOAD_DIR / safe_name
    counter = 1
    while destination.exists():
        destination = UPLOAD_DIR / f"{Path(safe_name).stem}_{counter}{Path(safe_name).suffix}"
        counter += 1

    with destination.open("wb") as fh:
        while chunk := await file.read(1024 * 1024):
            fh.write(chunk)

    payload = None
    if destination.suffix.lower() == ".json":
        with destination.open("r", encoding="utf-8") as fh:
            payload = json.load(fh)
    elif destination.suffix.lower() == ".csv":
        with destination.open("r", encoding="utf-8", newline="") as fh:
            rows = list(csv.DictReader(fh))
        payload = {
            "kpi": {
                "overall_oee": round(float(rows[0]["overall_oee"]) if rows and "overall_oee" in rows[0] else 0, 2),
                "overall_availability": round(float(rows[0]["overall_availability"]) if rows and "overall_availability" in rows[0] else 0, 2),
                "overall_performance": round(float(rows[0]["overall_performance"]) if rows and "overall_performance" in rows[0] else 0, 2),
                "overall_quality": round(float(rows[0]["overall_quality"]) if rows and "overall_quality" in rows[0] else 0, 2),
                "total_units_produced": int(rows[0]["total_units_produced"]) if rows and "total_units_produced" in rows[0] else 0,
                "total_units_rejected": int(rows[0]["total_units_rejected"]) if rows and "total_units_rejected" in rows[0] else 0,
                "total_downtime_minutes": float(rows[0]["total_downtime_minutes"]) if rows and "total_downtime_minutes" in rows[0] else 0,
                "active_machines": int(rows[0]["active_machines"]) if rows and "active_machines" in rows[0] else 0,
                "machines_down": int(rows[0]["machines_down"]) if rows and "machines_down" in rows[0] else 0,
            },
            "oeeList": [
                {
                    "machine_name": row.get("machine_name", "Machine"),
                    "availability": float(row.get("availability", 0) or 0),
                    "performance": float(row.get("performance", 0) or 0),
                    "quality": float(row.get("quality", 0) or 0),
                    "oee": float(row.get("oee", 0) or 0),
                    "status": row.get("status", "running"),
                }
                for row in rows
            ],
            "pareto": [],
            "trend": [],
            "shiftPerf": [],
            "qualitySumm": [],
            "machines": [],
        }

    if not payload:
        payload = {
            "kpi": {},
            "oeeList": [],
            "pareto": [],
            "trend": [],
            "shiftPerf": [],
            "qualitySumm": [],
            "machines": [],
        }

    return {"ok": True, "filename": destination.name, "stored_at": str(destination), **payload}


# Optionally serve the built frontend from the same origin (single-container deploys).
frontend_dir = os.path.join(os.path.dirname(__file__), "..", "..", "frontend")
if os.path.isdir(frontend_dir):
    app.mount("/", StaticFiles(directory=frontend_dir, html=True), name="frontend")
