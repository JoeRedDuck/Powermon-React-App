import asyncio
import os
import subprocess
from datetime import datetime, timedelta, timezone
from math import floor
from typing import Optional, List
import shutil
import requests
import json
import argparse
from dateutil import parser
from dotenv import load_dotenv  # type: ignore
from fastapi import FastAPI, HTTPException, Query, Depends  # type: ignore
from fastapi.middleware.cors import CORSMiddleware  # type: ignore
from pydantic import BaseModel, validator  # type: ignore
from sqlalchemy.orm import Session  # type: ignore
from sqlalchemy import text  # type: ignore

import db
import models
from database import SessionLocal, get_db

# --- Config ---
load_dotenv()
UPS_CMD = shutil.which("upsc") or "/usr/bin/upsc"
EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"

app = FastAPI()
app.add_middleware(CORSMiddleware, allow_origins=[
                   "*"], allow_methods=["*"], allow_headers=["*"])

_monitor_task: asyncio.Task | None = None
_ups_task: asyncio.Task | None = None
UPS_OUTAGE = asyncio.Event()

# --- Models ---


class DeviceCreate(BaseModel):
    name: str
    id: Optional[int] = None
    mac: str
    machine_type: str
    location: str
    ip: str

    @validator('name', 'mac', 'machine_type', 'location', 'ip')
    def not_empty(cls, v, field):
        if not v or not v.strip():
            raise ValueError(f'{field.name} cannot be empty')
        return v.strip()


class DeviceUpdate(BaseModel):
    name: str
    id: Optional[int] = None
    ip: str
    location: str | None = None
    machine_type: str | None = None

    @validator('name', 'ip')
    def not_empty(cls, v, field):
        if not v or not v.strip():
            raise ValueError(f'{field.name} cannot be empty')
        return v.strip()

    @validator('location', 'machine_type')
    def optional_not_empty(cls, v, field):
        if v is not None and (not v or not v.strip()):
            raise ValueError(
                f'{field.name} cannot be empty string (use null instead)')
        return v.strip() if v else None


class PollCreate(BaseModel):
    monitor_mac: str
    power_usage: int
    poll_time: Optional[datetime] = None  # Defaults to now if not provided


class NotificationTokenCreate(BaseModel):
    token: str
    device_name: Optional[str] = None

# --- Helpers ---


def to_utc(dt):
    if dt is None:
        return None
    if isinstance(dt, str):
        dt = parser.isoparse(dt)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=datetime.now().astimezone().tzinfo)
    return dt.astimezone(timezone.utc)


def get_device_status(device, low_threshold=50, stale_minutes=1):
    last_seen = to_utc(device.get("last_seen"))
    last_power = device.get("last_power")
    if last_seen is None or last_power is None:
        return "offline"
    if last_seen < datetime.now(timezone.utc) - timedelta(minutes=stale_minutes):
        return "offline"
    return "no power" if last_power == 0 else ("low power" if last_power < low_threshold else "online")


def send_expo_notification(title: str, body: str, priority: str = "default"):
    """
    Send push notification to all registered Expo tokens.
    Priority: 'default', 'high' (for critical alerts)
    """
    with SessionLocal() as session:
        tokens = db.get_all_notification_tokens(session)
        if not tokens:
            print("No notification tokens registered")
            return

        timestamp = datetime.now(timezone.utc).isoformat()

        for token in tokens:
            message = {
                "to": token,
                "title": title,
                "body": body,
                "priority": priority,
                "sound": "default",
                "data": {"createdAt": timestamp}
            }

            try:
                response = requests.post(
                    EXPO_PUSH_URL,
                    json=message,
                    headers={"Accept": "application/json",
                             "Content-Type": "application/json"},
                    timeout=5
                )
                if response.status_code != 200:
                    print(
                        f"Failed to send notification to {token}: {response.text}")
            except Exception as e:
                print(f"Error sending notification to {token}: {e}")

# --- Background Monitors ---


async def alert_monitor(poll_sec=10, cooldown=300):
    alerted_devices = []
    while True:
        if UPS_OUTAGE.is_set():
            await asyncio.sleep(poll_sec)
            continue
        with SessionLocal() as session:
            try:
                devices = db.get_devices(session)
                messages, off, low, none = [], [], [], []
                for d in devices:
                    d["status"] = get_device_status(d)
                    if d["status"] == "offline":
                        off.append(d)
                    elif d["status"] == "low power":
                        low.append(d)
                    elif d["status"] == "no power":
                        none.append(d)

                # Deduplication logic
                online_now = {d["name"]
                              for d in devices if d["status"] == "online"}
                alerted_devices = [
                    d for d in alerted_devices if d["name"] not in online_now]
                alerted_names = {a["name"] for a in alerted_devices}

                new_off = [d for d in off if d["name"] not in alerted_names]
                new_low = [d for d in low if d["name"] not in alerted_names]
                new_none = [d for d in none if d["name"] not in alerted_names]

                if new_none:
                    messages.append(
                        "Power loss alert: " + (f"{new_none[0]['name']}" if len(new_none) == 1 else "Multiple devices"))
                if new_low:
                    messages.append(
                        "Low Power Alert: " + (f"{new_low[0]['name']}" if len(new_low) == 1 else "Multiple devices"))
                if new_off:
                    messages.append(
                        "Offline Alert: " + (f"{new_off[0]['name']}" if len(new_off) == 1 else "Multiple devices"))

                if messages:
                    title = "Machine Alert"
                    body = "\n".join(messages)
                    send_expo_notification(title, body, priority="high")
                    alerted_devices.extend(new_off + new_low + new_none)
                    await asyncio.sleep(cooldown)
                else:
                    await asyncio.sleep(poll_sec)
            except Exception as e:
                print(f"Monitor Error: {e}")
                await asyncio.sleep(poll_sec)


async def ups_monitor(poll_sec=10):
    while True:
        if not shutil.which("upsc"):
            await asyncio.sleep(60)
            continue
        try:
            out = await asyncio.to_thread(subprocess.check_output, [UPS_CMD, "ups@localhost"], text=True)
            status = next(
                (l.split(":")[1].strip() for l in out.splitlines() if "ups.status:" in l), "")
            on_battery = "OB" in status
            if on_battery and not UPS_OUTAGE.is_set():
                UPS_OUTAGE.set()
                send_expo_notification(
                    "Critical Power Alert",
                    "UPS is on battery - mains power to factory is down",
                    priority="high"
                )
            elif (not on_battery) and UPS_OUTAGE.is_set():
                UPS_OUTAGE.clear()
                send_expo_notification(
                    "Power Restored",
                    "UPS is back on mains power",
                    priority="default"
                )
            await asyncio.sleep(poll_sec)
        except Exception as e:
            print(f"UPS Error: {e}")
            await asyncio.sleep(poll_sec)

# --- Lifecycle ---


@app.on_event("startup")
async def _start():
    global _monitor_task, _ups_task
    _monitor_task, _ups_task = asyncio.create_task(
        alert_monitor()), asyncio.create_task(ups_monitor())


@app.on_event("shutdown")
async def _stop():
    if _monitor_task:
        _monitor_task.cancel()
    if _ups_task:
        _ups_task.cancel()

# --- Endpoints ---


@app.get("/")
def hello(): return {"message": "Hello World! This is FastAPI"}


@app.get("/api/v1/status")
def get_status(location: str = None, status: str = None, machine_type: str = None, session: Session = Depends(get_db)):
    devices = db.get_devices(session)
    if location:
        devices = [d for d in devices if d['location'] == location]
    if machine_type:
        devices = [d for d in devices if d['machine_type'] == machine_type]
    for d in devices:
        d["status"] = get_device_status(d)
        if d["status"] == "offline":
            d["last_power"] = None
    if status:
        devices = [d for d in devices if d['status'] == status]
    return devices


@app.get("/api/v1/power")
def get_power_data(mac: str, time_range: str, bucket: str, session: Session = Depends(get_db)):
    range_min = {"5m": 5, "10m": 10, "30m": 30, "1h": 60,
                 "3h": 180, "6h": 360, "12h": 720, "24h": 1440}
    buck_sec = {"10s": 10, "20s": 20, "30s": 30,
                "1m": 60, "2m": 120, "5m": 300, "10m": 600}
    cutoff = datetime.now(timezone.utc) - \
        timedelta(minutes=range_min[time_range])
    rows = db.get_power(session, mac, cutoff)
    buckets = {}
    for r in rows:
        idx = floor(
            (to_utc(r["date"]) - cutoff).total_seconds() / buck_sec[bucket])
        b = buckets.setdefault(idx, {"sum": 0, "count": 0})
        b["sum"] += r["value"]
        b["count"] += 1
    points = [{"date": cutoff + timedelta(seconds=i*buck_sec[bucket]), "value": buckets[i]
               ["sum"]/buckets[i]["count"]} for i in sorted(buckets.keys())]
    vals = [p["value"] for p in points]
    return {"mac": mac, "time_range": time_range, "bucket": bucket, "points": points, "min": round(min(vals)) if vals else None, "max": round(max(vals)) if vals else None, "average": round(sum(vals)/len(vals)) if vals else None}


@app.get("/api/v1/health")
def health(session: Session = Depends(get_db)):
    try:
        # We must actually execute and fetch to verify the connection is alive
        session.execute(text("SELECT 1")).fetchone()
        return {"status": "ok"}
    except Exception as e:
        raise HTTPException(status_code=503, detail={
                            "status": "db_down", "reason": str(e)})


@app.get("/api/v1/devices")
def list_devices(session: Session = Depends(
    get_db)): return db.get_devices(session)


@app.get("/api/v1/devices/{mac}")
def get_device_detail(mac: str, session: Session = Depends(get_db)):
    d = db.get_device(session, mac)
    if not d:
        raise HTTPException(status_code=404, detail={"status": "not_found"})
    d["status"] = get_device_status(d)
    return d


@app.get("/api/v1/locations")
def list_locations(session: Session = Depends(
    get_db)): return db.get_locations(session)


@app.get("/api/v1/machine_types")
def list_types(session: Session = Depends(get_db)
               ): return db.get_machine_types(session)


@app.get("/api/v1/device_stats")
def get_stats(session: Session = Depends(get_db)):
    devs = get_status(session=session)
    stats = {"offline": 0, "online": 0, "no power": 0, "low power": 0}
    for d in devs:
        stats[d["status"]] += 1
    return stats


@app.delete("/api/v1/devices/{mac}")
def remove_device(mac: str, session: Session = Depends(get_db)):
    return {"status": "deleted" if db.delete_device(session, mac) else "not_deleted"}


@app.put("/api/v1/devices/{mac}")
def edit_device(mac: str, device: DeviceUpdate, session: Session = Depends(get_db)):
    if db.update_device(session, mac, device):
        return {"status": "updated"}
    raise HTTPException(status_code=404, detail={"status": "not_found"})


@app.post("/api/v1/devices")
def create_device(device: DeviceCreate, session: Session = Depends(get_db)):
    if db.add_device(session, device):
        return {"status": "created", "device": device.dict()}
    raise HTTPException(status_code=400, detail={
                        "status": "duplicate", "reason": "Already exists"})


@app.post("/api/v1/checkPoll/{mac}")
def poll_count(mac: str, session: Session = Depends(get_db)):
    return {"count": db.get_no_device_polls(session, mac)}


@app.post("/api/v1/polls")
def create_poll(poll: PollCreate, session: Session = Depends(get_db)):
    """
    Insert a new poll record. Automatically resolves machine_name from monitor_mac.

    The monitor must be registered in the database before polls can be inserted.
    If poll_time is not provided, uses current UTC time.
    """
    poll_time = poll.poll_time if poll.poll_time else datetime.now(
        timezone.utc)

    try:
        success = db.insert_poll(
            session, poll.monitor_mac, poll.power_usage, poll_time)
        if success:
            return {"status": "created", "poll": poll.dict()}
        else:
            raise HTTPException(
                status_code=404,
                detail={
                    "status": "monitor_not_found",
                    "reason": f"Monitor {poll.monitor_mac} not found. Register the device first."
                }
            )
    except ValueError as e:
        raise HTTPException(
            status_code=400,
            detail={"status": "invalid_data", "reason": str(e)}
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={"status": "database_error", "reason": str(e)}
        )


@app.post("/api/v1/notifications/register")
def register_notification_token(token_data: NotificationTokenCreate, session: Session = Depends(get_db)):
    """
    Register an Expo push notification token.
    The mobile app calls this endpoint to register its token for receiving notifications.
    """
    if db.add_notification_token(session, token_data.token, token_data.device_name):
        return {"status": "registered", "token": token_data.token}
    else:
        return {"status": "already_registered", "token": token_data.token}


@app.get("/api/v1/notifications/tokens")
def list_notification_tokens(session: Session = Depends(get_db)):
    """Get all registered notification tokens."""
    tokens = db.get_all_notification_tokens(session)
    return {"tokens": tokens, "count": len(tokens)}


@app.delete("/api/v1/notifications/tokens/{token}")
def delete_notification_token(token: str, session: Session = Depends(get_db)):
    """Delete a notification token (e.g., when user logs out or uninstalls app)."""
    if db.delete_notification_token(session, token):
        return {"status": "deleted"}
    else:
        raise HTTPException(status_code=404, detail={"status": "not_found"})


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--mac", required=True)
    parser.add_argument("--time_range", required=True)
    parser.add_argument("--bucket", required=True)
    args = parser.parse_args()
    with SessionLocal() as session:
        print(json.dumps(get_power_data(args.mac, args.time_range,
              args.bucket, session), indent=2, default=str))
