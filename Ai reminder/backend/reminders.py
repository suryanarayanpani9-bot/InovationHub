import queue
import threading
import time as time_mod
from datetime import datetime, date, time, timedelta

import db

_CLIENT_LAST_SEEN_AT = None


def mark_client_active(now=None):
    global _CLIENT_LAST_SEEN_AT
    _CLIENT_LAST_SEEN_AT = now or datetime.now()


def client_active_recently(now=None, grace_seconds=120):
    if _CLIENT_LAST_SEEN_AT is None:
        return False
    now = now or datetime.now()
    return (now - _CLIENT_LAST_SEEN_AT).total_seconds() <= grace_seconds


class _TTSWorker:
    def __init__(self):
        self._queue = queue.Queue()
        self._enabled = True
        self._thread = threading.Thread(target=self._run, daemon=True)
        self._thread.start()

    def _run(self):
        try:
            import pyttsx3

            try:
                engine = pyttsx3.init("sapi5")
            except Exception:
                engine = pyttsx3.init()
        except Exception as exc:
            print(f"[tts] disabled: {exc}")
            self._enabled = False
            return

        while True:
            text = self._queue.get()
            if text is None:
                break
            try:
                engine.say(text)
                engine.runAndWait()
            except Exception as exc:
                print(f"[tts] error: {exc}")

    def speak(self, text):
        if not self._enabled:
            return False
        self._queue.put(text)
        return True


_TTS = _TTSWorker()


def _speak_powershell(text):
    try:
        import subprocess

        script = (
            "param([string]$t) "
            "Add-Type -AssemblyName System.Speech; "
            "$speak = New-Object System.Speech.Synthesis.SpeechSynthesizer; "
            "$speak.Speak($t);"
        )
        subprocess.Popen(
            ["powershell", "-NoProfile", "-Command", f"& {{ {script} }}", text],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
    except Exception:
        pass


def _speak(text):
    if not _TTS.speak(text):
        _speak_powershell(text)


def _play_sound():
    try:
        import winsound

        winsound.MessageBeep()
        return
    except Exception:
        pass

    try:
        print("\a", end="")
    except Exception:
        pass


def _desktop_notify(title, message):
    try:
        from plyer import notification

        notification.notify(title=title, message=message, timeout=10)
    except Exception:
        pass


def notify_task(task, message):
    title = f"Reminder: {task['title']}"
    _desktop_notify(title, message)
    _play_sound()
    _speak(message)


def get_due_tasks(now=None, mark_reminded=True):
    now = now or datetime.now()
    today = now.date()

    tasks = db.list_tasks()
    if not tasks:
        return []

    completed_ids = db.get_task_ids_by_status(today.isoformat(), "completed")
    due = []

    for task in tasks:
        if not task.get("enabled"):
            continue
        if task["id"] in completed_ids:
            continue

        try:
            scheduled_time = time.fromisoformat(task["time"])
        except ValueError:
            continue

        scheduled_dt = datetime.combine(today, scheduled_time)
        if now < scheduled_dt:
            continue

        interval_seconds = max(1, int(task["reminder_interval"]))
        last_reminded_at = task.get("last_reminded_at")
        last_dt = None
        if last_reminded_at:
            try:
                last_dt = datetime.fromisoformat(last_reminded_at)
            except ValueError:
                last_dt = None

        if last_dt is None or now - last_dt >= timedelta(seconds=interval_seconds):
            is_repeat = last_dt is not None and last_dt.date() == today
            if is_repeat:
                message = "Sir, I am Jerry. Please do your task properly."
            else:
                message = f"Sir, I am Jerry. Please do your task properly: {task['title']}."
            due.append({"task": task, "message": message})
            if mark_reminded:
                db.set_last_reminded_at(task["id"], now.isoformat())

    return due


class ReminderEngine:
    def __init__(self, interval_seconds=1):
        self._interval_seconds = interval_seconds
        self._stop_event = threading.Event()
        self._thread = threading.Thread(target=self._loop, daemon=True)
        self._last_day = date.today()

    def start(self):
        if not self._thread.is_alive():
            self._thread.start()

    def stop(self):
        self._stop_event.set()

    def _loop(self):
        while not self._stop_event.is_set():
            try:
                self._run_cycle()
            except Exception as exc:
                print(f"[reminders] error: {exc}")
            self._stop_event.wait(self._interval_seconds)

    def _run_cycle(self):
        now = datetime.now()
        today = now.date()

        if today != self._last_day:
            self._handle_day_rollover(self._last_day)
            self._last_day = today

        if client_active_recently(now):
            return

        due = get_due_tasks(now)
        for item in due:
            notify_task(item["task"], item["message"])

    def _handle_day_rollover(self, previous_day):
        tasks = db.list_tasks()
        if not tasks:
            return

        enabled_task_ids = {task["id"] for task in tasks if task.get("enabled")}
        prev_date_str = previous_day.isoformat()
        completed_ids = db.get_task_ids_by_status(prev_date_str, "completed", enabled_task_ids)

        for task in tasks:
            if task["id"] not in enabled_task_ids:
                continue
            if task["id"] in completed_ids:
                continue
            db.add_log(task["id"], prev_date_str, "missed")

        db.reset_last_reminded_at(enabled_task_ids)
