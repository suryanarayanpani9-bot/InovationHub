import os
from datetime import date, datetime, timedelta
from typing import List, Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

import db
from reminders import ReminderEngine, get_due_tasks, mark_client_active

FRONTEND_DIR = os.path.join(os.path.dirname(__file__), "..", "frontend")

app = FastAPI(title="AI Personal Reminder Coach")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"] ,
    allow_headers=["*"],
)


class TaskCreate(BaseModel):
    title: str = Field(..., min_length=1)
    category: str = Field(..., min_length=1)
    time: str = Field(..., min_length=4)
    reminder_interval: int = Field(10, ge=1)
    enabled: bool = True


class TaskUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1)
    category: Optional[str] = Field(None, min_length=1)
    time: Optional[str] = Field(None, min_length=4)
    reminder_interval: Optional[int] = Field(None, ge=1)
    enabled: Optional[bool] = None


class TaskOut(BaseModel):
    id: int
    title: str
    category: str
    time: str
    reminder_interval: int
    enabled: bool
    created_at: str
    last_reminded_at: Optional[str]
    completed_today: bool


class StatsOut(BaseModel):
    total_tasks: int
    completed_today: int
    pending_today: int
    streak: int
    coach_message: str


@app.on_event("startup")
async def on_startup():
    db.init_db()
    app.state.reminder_engine = ReminderEngine()
    app.state.reminder_engine.start()


@app.on_event("shutdown")
async def on_shutdown():
    engine = getattr(app.state, "reminder_engine", None)
    if engine:
        engine.stop()


@app.get("/")
def index():
    return FileResponse(os.path.join(FRONTEND_DIR, "index.html"))


app.mount("/static", StaticFiles(directory=FRONTEND_DIR), name="static")


@app.get("/styles.css")
def styles():
    return FileResponse(os.path.join(FRONTEND_DIR, "styles.css"))


@app.get("/app.js")
def scripts():
    return FileResponse(os.path.join(FRONTEND_DIR, "app.js"))


@app.get("/api/tasks", response_model=List[TaskOut])
def get_tasks():
    tasks = db.list_tasks()
    today_str = date.today().isoformat()
    completed_ids = db.get_task_ids_by_status(today_str, "completed")

    results = []
    for task in tasks:
        results.append(
            {
                **task,
                "enabled": bool(task["enabled"]),
                "completed_today": task["id"] in completed_ids,
            }
        )

    return results


@app.post("/api/tasks", response_model=TaskOut)
def create_task(payload: TaskCreate):
    task_id = db.create_task(
        payload.title,
        payload.category,
        payload.time,
        payload.reminder_interval,
        payload.enabled,
    )
    task = db.get_task(task_id)
    if not task:
        raise HTTPException(status_code=500, detail="Task not created")

    return {
        **task,
        "enabled": bool(task["enabled"]),
        "completed_today": False,
    }


@app.put("/api/tasks/{task_id}", response_model=TaskOut)
def update_task(task_id: int, payload: TaskUpdate):
    task = db.get_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    db.update_task(
        task_id,
        title=payload.title,
        category=payload.category,
        time_str=payload.time,
        reminder_interval=payload.reminder_interval,
        enabled=payload.enabled,
    )

    updated = db.get_task(task_id)
    today_str = date.today().isoformat()
    completed_ids = db.get_task_ids_by_status(today_str, "completed")

    return {
        **updated,
        "enabled": bool(updated["enabled"]),
        "completed_today": updated["id"] in completed_ids,
    }


@app.delete("/api/tasks/{task_id}")
def delete_task(task_id: int):
    task = db.get_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    db.delete_task(task_id)
    return {"ok": True}


@app.post("/api/tasks/{task_id}/complete")
def complete_task(task_id: int):
    task = db.get_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    today_str = date.today().isoformat()
    db.add_log(task_id, today_str, "completed")
    return {"ok": True}


@app.post("/api/tasks/{task_id}/uncomplete")
def uncomplete_task(task_id: int):
    task = db.get_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    today_str = date.today().isoformat()
    db.remove_log(task_id, today_str, "completed")
    return {"ok": True}


def _compute_streak(enabled_task_ids):
    total_tasks = len(enabled_task_ids)
    if total_tasks == 0:
        return 0

    streak = 0
    day_cursor = date.today()
    while True:
        day_str = day_cursor.isoformat()
        completed_ids = db.get_task_ids_by_status(day_str, "completed", enabled_task_ids)
        missed_ids = db.get_task_ids_by_status(day_str, "missed", enabled_task_ids)

        if len(completed_ids) == total_tasks and not missed_ids:
            streak += 1
            day_cursor -= timedelta(days=1)
            continue
        break

    return streak


def _coach_message(tasks, enabled_task_ids):
    if not tasks:
        return "Add your first task and I will keep you on track."

    today_str = date.today().isoformat()
    if not enabled_task_ids:
        return "Enable a task to get coaching and reminders."

    completed_ids = db.get_task_ids_by_status(today_str, "completed", enabled_task_ids)
    if len(completed_ids) == len(enabled_task_ids):
        return "All tasks completed today. Strong finish."

    yesterday = (date.today() - timedelta(days=1)).isoformat()
    day_before = (date.today() - timedelta(days=2)).isoformat()

    for task in tasks:
        if task["id"] not in enabled_task_ids:
            continue
        logs = db.get_logs_for_task(task["id"], [yesterday, day_before])
        missed_y = (yesterday, "missed") in logs
        missed_db = (day_before, "missed") in logs
        if missed_y and missed_db:
            return f"You missed {task['title']} two days in a row. Want to reschedule it?"

    return "Stay steady. Knock out the next task to keep your streak alive."


@app.get("/api/stats", response_model=StatsOut)
def get_stats():
    tasks = db.list_tasks()
    enabled_task_ids = {t["id"] for t in tasks if t.get("enabled")}

    today_str = date.today().isoformat()
    completed_ids = db.get_task_ids_by_status(today_str, "completed", enabled_task_ids)

    total = len(enabled_task_ids)
    completed = len(completed_ids)
    pending = max(total - completed, 0)

    return {
        "total_tasks": total,
        "completed_today": completed,
        "pending_today": pending,
        "streak": _compute_streak(enabled_task_ids),
        "coach_message": _coach_message(tasks, enabled_task_ids),
    }


@app.get("/api/reminders/due")
def get_due_reminders():
    mark_client_active()
    due = get_due_tasks()
    return [
        {
            "id": item["task"]["id"],
            "title": item["task"]["title"],
            "category": item["task"]["category"],
            "time": item["task"]["time"],
            "message": item["message"],
        }
        for item in due
    ]
