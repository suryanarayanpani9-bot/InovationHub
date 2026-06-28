import os
import sqlite3
from datetime import datetime

DB_PATH = os.path.join(os.path.dirname(__file__), "data.db")


def get_conn():
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_conn()
    with conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS tasks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                category TEXT NOT NULL,
                time TEXT NOT NULL,
                reminder_interval INTEGER NOT NULL,
                enabled INTEGER NOT NULL DEFAULT 1,
                created_at TEXT NOT NULL,
                last_reminded_at TEXT
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS task_log (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                task_id INTEGER NOT NULL,
                date TEXT NOT NULL,
                status TEXT NOT NULL,
                timestamp TEXT NOT NULL,
                UNIQUE(task_id, date, status)
            )
            """
        )
        conn.execute("CREATE INDEX IF NOT EXISTS idx_task_log_date ON task_log(date)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_task_log_task ON task_log(task_id)")
    conn.close()


def create_task(title, category, time_str, reminder_interval, enabled=True):
    conn = get_conn()
    created_at = datetime.now().isoformat()
    with conn:
        cur = conn.execute(
            """
            INSERT INTO tasks (title, category, time, reminder_interval, enabled, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (title, category, time_str, reminder_interval, 1 if enabled else 0, created_at),
        )
    task_id = cur.lastrowid
    conn.close()
    return task_id


def update_task(task_id, title=None, category=None, time_str=None, reminder_interval=None, enabled=None):
    conn = get_conn()
    fields = []
    values = []
    if title is not None:
        fields.append("title = ?")
        values.append(title)
    if category is not None:
        fields.append("category = ?")
        values.append(category)
    if time_str is not None:
        fields.append("time = ?")
        values.append(time_str)
    if reminder_interval is not None:
        fields.append("reminder_interval = ?")
        values.append(reminder_interval)
    if enabled is not None:
        fields.append("enabled = ?")
        values.append(1 if enabled else 0)

    if not fields:
        conn.close()
        return

    values.append(task_id)
    with conn:
        conn.execute(f"UPDATE tasks SET {', '.join(fields)} WHERE id = ?", values)
    conn.close()


def delete_task(task_id):
    conn = get_conn()
    with conn:
        conn.execute("DELETE FROM tasks WHERE id = ?", (task_id,))
        conn.execute("DELETE FROM task_log WHERE task_id = ?", (task_id,))
    conn.close()


def list_tasks():
    conn = get_conn()
    rows = conn.execute("SELECT * FROM tasks ORDER BY time ASC").fetchall()
    conn.close()
    return [dict(row) for row in rows]


def get_task(task_id):
    conn = get_conn()
    row = conn.execute("SELECT * FROM tasks WHERE id = ?", (task_id,)).fetchone()
    conn.close()
    return dict(row) if row else None


def set_last_reminded_at(task_id, ts):
    conn = get_conn()
    with conn:
        conn.execute("UPDATE tasks SET last_reminded_at = ? WHERE id = ?", (ts, task_id))
    conn.close()


def add_log(task_id, date_str, status):
    conn = get_conn()
    ts = datetime.now().isoformat()
    with conn:
        conn.execute(
            """
            INSERT OR IGNORE INTO task_log (task_id, date, status, timestamp)
            VALUES (?, ?, ?, ?)
            """,
            (task_id, date_str, status, ts),
        )
    conn.close()


def remove_log(task_id, date_str, status):
    conn = get_conn()
    with conn:
        conn.execute(
            "DELETE FROM task_log WHERE task_id = ? AND date = ? AND status = ?",
            (task_id, date_str, status),
        )
    conn.close()


def get_task_ids_by_status(date_str, status, task_ids=None):
    conn = get_conn()
    if task_ids is None:
        rows = conn.execute(
            "SELECT task_id FROM task_log WHERE date = ? AND status = ?",
            (date_str, status),
        ).fetchall()
        conn.close()
        return {row[0] for row in rows}

    task_id_list = list(task_ids)
    if not task_id_list:
        conn.close()
        return set()

    placeholders = ",".join(["?"] * len(task_id_list))
    rows = conn.execute(
        f"SELECT task_id FROM task_log WHERE date = ? AND status = ? AND task_id IN ({placeholders})",
        [date_str, status] + task_id_list,
    ).fetchall()
    conn.close()
    return {row[0] for row in rows}


def count_logs_for_date(date_str, status, task_ids=None):
    conn = get_conn()
    if task_ids is None:
        row = conn.execute(
            "SELECT COUNT(*) FROM task_log WHERE date = ? AND status = ?",
            (date_str, status),
        ).fetchone()
        conn.close()
        return row[0] if row else 0

    task_id_list = list(task_ids)
    if not task_id_list:
        conn.close()
        return 0

    placeholders = ",".join(["?"] * len(task_id_list))
    row = conn.execute(
        f"SELECT COUNT(*) FROM task_log WHERE date = ? AND status = ? AND task_id IN ({placeholders})",
        [date_str, status] + task_id_list,
    ).fetchone()
    conn.close()
    return row[0] if row else 0


def reset_last_reminded_at(task_ids=None):
    conn = get_conn()
    with conn:
        if task_ids is None:
            conn.execute("UPDATE tasks SET last_reminded_at = NULL")
        else:
            task_id_list = list(task_ids)
            if not task_id_list:
                conn.close()
                return
            placeholders = ",".join(["?"] * len(task_id_list))
            conn.execute(
                f"UPDATE tasks SET last_reminded_at = NULL WHERE id IN ({placeholders})",
                task_id_list,
            )
    conn.close()


def get_status_for_task_and_date(task_id, date_str):
    conn = get_conn()
    rows = conn.execute(
        "SELECT status FROM task_log WHERE task_id = ? AND date = ?",
        (task_id, date_str),
    ).fetchall()
    conn.close()
    return {row[0] for row in rows}


def get_logs_for_task(task_id, date_list):
    placeholders = ",".join(["?"] * len(date_list))
    conn = get_conn()
    rows = conn.execute(
        f"SELECT date, status FROM task_log WHERE task_id = ? AND date IN ({placeholders})",
        [task_id] + list(date_list),
    ).fetchall()
    conn.close()
    return {(row[0], row[1]) for row in rows}
