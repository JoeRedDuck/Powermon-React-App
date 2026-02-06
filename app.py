from database import SessionLocal, get_db
import models
import db
import asyncio
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
try:
    from pydantic import root_validator
except ImportError:
    from pydantic import model_validator as root_validator
from sqlalchemy.orm import Session  # type: ignore
from sqlalchemy import text  # type: ignore
import urllib3  # type: ignore
import warnings
import os
import sys
# Suppress OpenSSL warnings at the C library level
os.environ['PYTHONWARNINGS'] = 'ignore'
os.environ['PYTHONHTTPSVERIFY'] = '0'
os.environ['CURL_CA_BUNDLE'] = ''  # Disable curl CA bundle
os.environ['REQUESTS_CA_BUNDLE'] = ''  # Disable requests CA bundle
os.environ['SSL_CERT_FILE'] = '/dev/null'  # Point SSL cert file to null
os.environ['SSL_CERT_DIR'] = '/dev/null'  # Point SSL cert dir to null


urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

# Disable SSL verification globally for requests library
requests.packages.urllib3.disable_warnings()
warnings.filterwarnings('ignore')

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
    mac: Optional[str] = None
    machine_type: str
    location: str

    @validator('name', 'machine_type', 'location')
    def not_empty(cls, v):
        if not v or not v.strip():
            raise ValueError('Field cannot be empty')
        return v.strip()

    @validator('mac')
    def mac_not_empty_if_provided(cls, v):
        # Treat empty strings as None (not provided)
        if v is not None and not v.strip():
            return None
        return v.strip() if v else None

    @validator('id')
    def validate_monitor_id(cls, v):
        # Treat 0 or negative as None (not provided)
        if v is not None and v <= 0:
            return None
        return v

    @root_validator(skip_on_failure=True)
    def validate_monitor_info(cls, values):
        # If mac is provided, it's okay (with or without id)
        # If mac is not provided, monitor_id can be provided or both can be None
        # No validation error needed - all combinations are valid
        return values


class DeviceUpdate(BaseModel):
    name: str
    id: Optional[int] = None
    location: str | None = None
    machine_type: str | None = None
    # New field for reassigning monitors
    reassign_monitor_id: Optional[int] = None

    @validator('name')
    def not_empty(cls, v):
        if not v or not v.strip():
            raise ValueError('Field cannot be empty')
        return v.strip()

    @validator('location', 'machine_type')
    def optional_not_empty(cls, v):
        if v is not None and (not v or not v.strip()):
            raise ValueError('Field cannot be empty string (use null instead)')
        return v.strip() if v else None


class PollCreate(BaseModel):
    monitor_mac: str
    power_usage: int
    poll_time: Optional[datetime] = None  # Defaults to now if not provided


class NotificationTokenCreate(BaseModel):
    token: str
    device_name: Optional[str] = None


class MonitorCreate(BaseModel):
    id: int
    mac: str
    machine_name: Optional[str] = None


class MutedMachineAdd(BaseModel):
    device_id: str
    machine_name: str


class MutedMachineReplace(BaseModel):
    device_id: str
    machine_names: List[str]


class MonitorUpdate(BaseModel):
    id: Optional[int] = None
    mac: Optional[str] = None

    @validator('mac')
    def validate_mac(cls, v):
        if v is not None and (not v or not v.strip()):
            raise ValueError('MAC address cannot be empty')
        return v.strip() if v else None

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


def send_expo_notification(title: str, body: str, priority: str = "default", machine_names: Optional[List[str]] = None):
    """
    Send push notification to all registered Expo tokens.
    Priority: 'default', 'high' (for critical alerts)
    machine_names: Optional list of machines this notification is about.
                   If provided, will check device mute preferences.
    """
    with SessionLocal() as session:
        # Get tokens with device information
        token_data = db.get_notification_tokens_with_devices(session)
        if not token_data:
            print("No notification tokens registered")
            return

        # Get all mute preferences if machine_names provided
        mute_prefs = {}
        if machine_names:
            mute_prefs = db.get_all_mute_preferences(session)

        timestamp = datetime.now(timezone.utc).isoformat()

        for token_info in token_data:
            token = token_info["token"]
            device_id = token_info["device_name"]

            # Skip if this device has muted any of the machines in this notification
            if machine_names and device_id:
                muted_machines = mute_prefs.get(device_id, [])
                # If any machine in the notification is muted by this device, skip
                if any(machine in muted_machines for machine in machine_names):
                    print(
                        f"Skipping notification to device {device_id} (has muted machines)")
                    continue

            message = {
                "to": token,
                "title": title,
                "body": body,
                "priority": priority,
                "sound": "default",
                "data": {
                    "createdAt": timestamp,
                    "machines": machine_names if machine_names else []
                }
            }

            try:
                response = requests.post(
                    EXPO_PUSH_URL,
                    json=message,
                    headers={"Accept": "application/json",
                             "Content-Type": "application/json"},
                    timeout=5,
                    verify=False  # Disable SSL verification to prevent OpenSSL warnings
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

                # Collect all affected machine names
                affected_machines = []

                if new_none:
                    messages.append(
                        "Power loss alert: " + (f"{new_none[0]['name']}" if len(new_none) == 1 else "Multiple devices"))
                    affected_machines.extend([d["name"] for d in new_none])
                if new_low:
                    messages.append(
                        "Low Power Alert: " + (f"{new_low[0]['name']}" if len(new_low) == 1 else "Multiple devices"))
                    affected_machines.extend([d["name"] for d in new_low])
                if new_off:
                    messages.append(
                        "Offline Alert: " + (f"{new_off[0]['name']}" if len(new_off) == 1 else "Multiple devices"))
                    affected_machines.extend([d["name"] for d in new_off])

                if messages:
                    title = "Machine Alert"
                    body = "\n".join(messages)
                    # Pass machine names to enable mute preferences filtering
                    send_expo_notification(
                        title, body, priority="high", machine_names=affected_machines)
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

    # Validate parameters
    if time_range not in range_min:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid time_range. Must be one of: {', '.join(range_min.keys())}"
        )
    if bucket not in buck_sec:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid bucket. Must be one of: {', '.join(buck_sec.keys())}"
        )

    cutoff = datetime.now(timezone.utc) - \
        timedelta(minutes=range_min[time_range])
    rows = db.get_power(session, mac, cutoff)
    buckets = {}
    for r in rows:
        # Skip rows with None values
        if r.get("value") is None or r.get("date") is None:
            continue
        idx = floor(
            (to_utc(r["date"]) - cutoff).total_seconds() / buck_sec[bucket])
        # Skip negative indices (data before cutoff)
        if idx < 0:
            continue
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


@app.get("/api/v1/machines/{machine_name}")
def get_device_by_name(machine_name: str, session: Session = Depends(get_db)):
    """Get device information by machine name."""
    d = db.get_device_by_name(session, machine_name)
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


@app.get("/api/v1/monitors")
def list_monitors(session: Session = Depends(get_db)):
    """Get all monitors with their IDs, MAC addresses, and assignment status."""
    return db.get_monitors(session)


@app.post("/api/v1/monitors", status_code=201)
def create_monitor(monitor: MonitorCreate, session: Session = Depends(get_db)):
    """
    Create a new monitor, optionally assigning it to a machine.

    Request Body:
    {
        "id": 1,
        "mac": "AA:BB:CC:DD:EE:FF",
        "machine_name": "Pump 1"  // optional, null if unassigned
    }
    """
    success, error_message = db.create_monitor(session, monitor)

    if success:
        return {
            "status": "Monitor created successfully",
            "monitor": {
                "id": monitor.id,
                "mac": monitor.mac,
                "machine_name": monitor.machine_name
            }
        }

    # Determine appropriate HTTP status code based on error
    if "already exists" in error_message:
        raise HTTPException(status_code=400, detail=error_message)
    elif "not found" in error_message:
        raise HTTPException(status_code=400, detail=error_message)
    else:
        raise HTTPException(status_code=422, detail=error_message)


@app.put("/api/v1/monitors/{monitor_id}")
def update_monitor(monitor_id: int, monitor_update: MonitorUpdate, session: Session = Depends(get_db)):
    """
    Update a monitor's ID and/or MAC address.

    Request Body:
    {
        "id": 10,      // optional, new ID
        "mac": "AA:BB:CC:DD:EE:FF"  // optional, new MAC
    }

    At least one field must be provided.
    """
    # Validate that at least one field is provided
    if monitor_update.id is None and monitor_update.mac is None:
        raise HTTPException(
            status_code=400,
            detail="At least one field (id or mac) must be provided"
        )

    success, error_message = db.update_monitor(
        session, monitor_id, monitor_update)

    if success:
        # Get updated monitor info
        monitor = session.query(models.Monitor).filter(
            models.Monitor.id == (
                monitor_update.id if monitor_update.id is not None else monitor_id)
        ).first()

        return {
            "status": "Monitor updated successfully",
            "monitor": {
                "id": monitor.id,
                "mac": monitor.mac,
                "machine_name": monitor.machine_name
            }
        }

    # Determine appropriate HTTP status code based on error
    if "not found" in error_message:
        raise HTTPException(status_code=404, detail=error_message)
    elif "already exists" in error_message or "in use" in error_message or "poll" in error_message.lower():
        raise HTTPException(status_code=400, detail=error_message)
    else:
        raise HTTPException(status_code=422, detail=error_message)


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


@app.delete("/api/v1/machines/{machine_name}")
def remove_machine(machine_name: str, session: Session = Depends(get_db)):
    """Delete a machine by its name. Use this for machines without monitors."""
    return {"status": "deleted" if db.delete_machine_by_name(session, machine_name) else "not_deleted"}


@app.put("/api/v1/devices/{mac}")
def edit_device(mac: str, device: DeviceUpdate, session: Session = Depends(get_db)):
    # Get current device to check if ID is changing
    current_device = db.get_device(session, mac)
    if not current_device:
        raise HTTPException(status_code=404, detail={"status": "not_found"})

    machine_name = current_device.get("name")

    # If ID is being changed (but not using reassign_monitor_id), reject with helpful error message
    if device.id is not None and device.id != current_device.get("id") and device.reassign_monitor_id is None:
        raise HTTPException(
            status_code=400,
            detail={
                "status": "error",
                "message": "Monitor ID cannot be changed via edit. Use POST /api/v1/monitors/{monitor_id}/reassign?machine_name=<machine_name> to reassign monitors, or use reassign_monitor_id field."
            }
        )

    # Handle monitor reassignment if requested
    if device.reassign_monitor_id is not None:
        if not db.reassign_monitor(session, device.reassign_monitor_id, machine_name):
            raise HTTPException(
                status_code=404,
                detail={
                    "status": "error",
                    "message": f"Monitor with id {device.reassign_monitor_id} not found"
                }
            )

        # After reassignment, get the new MAC address
        monitor = session.query(models.Monitor).filter(
            models.Monitor.id == device.reassign_monitor_id).first()
        if monitor:
            mac = monitor.mac  # Update mac to the new monitor's MAC
        else:
            raise HTTPException(status_code=500, detail={
                                "status": "error", "message": "Monitor reassignment succeeded but could not retrieve new MAC"})

    # Update only the allowed fields (name, location, machine_type)
    if db.update_device(session, mac, device):
        return {"status": "updated"}
    raise HTTPException(status_code=404, detail={"status": "not_found"})


@app.post("/api/v1/monitors/{monitor_id}/unassign")
def unassign_monitor_endpoint(monitor_id: int, session: Session = Depends(get_db)):
    """
    Unassign a monitor from its current machine.
    The monitor remains in the database but is no longer associated with any machine.
    """
    if db.unassign_monitor(session, monitor_id):
        return {
            "status": f"Monitor {monitor_id} unassigned successfully",
            "monitor_id": monitor_id
        }
    raise HTTPException(
        status_code=404,
        detail=f"Monitor with id {monitor_id} not found"
    )


@app.delete("/api/v1/monitors/{monitor_id}")
def delete_monitor_endpoint(monitor_id: int, session: Session = Depends(get_db)):
    """
    Permanently delete a monitor from the database.
    Note: Monitors with associated poll data cannot be deleted.
    Use the unassign endpoint instead to preserve historical data.
    """
    success, error_message = db.delete_monitor(session, monitor_id)

    if success:
        return {
            "status": f"Monitor {monitor_id} deleted successfully",
            "monitor_id": monitor_id
        }

    if error_message:
        # Constraint violation or other database error
        raise HTTPException(
            status_code=400,
            detail=error_message
        )

    # Monitor not found
    raise HTTPException(
        status_code=404,
        detail=f"Monitor with id {monitor_id} not found"
    )


@app.post("/api/v1/monitors/{monitor_id}/reassign")
def reassign_monitor_endpoint(monitor_id: int, machine_name: str = Query(...), session: Session = Depends(get_db)):
    """
    Reassign a monitor to a different machine.

    - The monitor will be associated with the new machine
    - The old monitor on the target machine (if any) will be orphaned
    - Polls stay with machine_name, not the monitor

    Query params:
        machine_name: The name of the machine to assign the monitor to
    """
    # Validate machine_name parameter
    if not machine_name or not machine_name.strip():
        raise HTTPException(
            status_code=400,
            detail="machine_name query parameter is required"
        )

    # Check if monitor exists first
    monitor = session.query(models.Monitor).filter(
        models.Monitor.id == monitor_id).first()
    if not monitor:
        raise HTTPException(
            status_code=404,
            detail=f"Monitor with id {monitor_id} not found"
        )

    # Check if machine exists
    machine = session.query(models.Machine).filter(
        models.Machine.name == machine_name).first()
    if not machine:
        raise HTTPException(
            status_code=400,
            detail=f"Machine '{machine_name}' not found"
        )

    # Perform the reassignment
    if db.reassign_monitor(session, monitor_id, machine_name):
        return {
            "status": f"Monitor {monitor_id} reassigned to {machine_name}",
            "monitor_id": monitor_id,
            "machine_name": machine_name
        }

    # This should not happen given the checks above, but handle it anyway
    raise HTTPException(
        status_code=500,
        detail="Failed to reassign monitor"
    )


@app.post("/api/v1/devices")
def create_device(device: DeviceCreate, session: Session = Depends(get_db)):
    success, error_msg = db.add_device(session, device)
    if success:
        return {"status": "created", "device": device.dict()}

    # Determine appropriate status code based on error
    status_code = 404 if "not found" in error_msg.lower() else 400
    raise HTTPException(status_code=status_code, detail={
                        "status": "error", "reason": error_msg})


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


# --- Device Mute Preferences Endpoints ---

@app.get("/api/v1/muted-machines")
def get_muted_machines(device_id: str = Query(..., description="Device identifier"), session: Session = Depends(get_db)):
    """Get list of muted machines for a specific device."""
    muted = db.get_muted_machines(session, device_id)
    return {"device_id": device_id, "muted_machines": muted}


@app.post("/api/v1/muted-machines")
def add_muted_machine(data: MutedMachineAdd, session: Session = Depends(get_db)):
    """Add a machine to device's muted list."""
    # Verify machine exists
    machine = session.query(models.Machine).filter(
        models.Machine.name == data.machine_name).first()
    if not machine:
        raise HTTPException(
            status_code=404,
            detail={"status": "machine_not_found",
                    "machine_name": data.machine_name}
        )

    if db.add_muted_machine(session, data.device_id, data.machine_name):
        return {"status": "added", "device_id": data.device_id, "machine_name": data.machine_name}
    else:
        return {"status": "already_muted", "device_id": data.device_id, "machine_name": data.machine_name}


@app.delete("/api/v1/muted-machines")
def remove_muted_machine(device_id: str = Query(..., description="Device identifier"), machine_name: str = Query(..., description="Machine name"), session: Session = Depends(get_db)):
    """Remove a machine from device's muted list."""
    if db.remove_muted_machine(session, device_id, machine_name):
        return {"status": "removed", "device_id": device_id, "machine_name": machine_name}
    else:
        raise HTTPException(
            status_code=404,
            detail={"status": "not_found",
                    "message": "Machine not in muted list"}
        )


@app.put("/api/v1/muted-machines")
def replace_muted_machines(data: MutedMachineReplace, session: Session = Depends(get_db)):
    """Replace entire muted machines list for a device (bulk sync)."""
    # Verify all machines exist
    for machine_name in data.machine_names:
        machine = session.query(models.Machine).filter(
            models.Machine.name == machine_name).first()
        if not machine:
            raise HTTPException(
                status_code=404,
                detail={"status": "machine_not_found",
                        "machine_name": machine_name}
            )

    db.replace_muted_machines(session, data.device_id, data.machine_names)
    return {
        "status": "replaced",
        "device_id": data.device_id,
        "muted_machines": data.machine_names
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--mac", required=True)
    parser.add_argument("--time_range", required=True)
    parser.add_argument("--bucket", required=True)
    args = parser.parse_args()
    with SessionLocal() as session:
        print(json.dumps(get_power_data(args.mac, args.time_range,
              args.bucket, session), indent=2, default=str))
