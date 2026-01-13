import httpx  # type: ignore
from typing import List
from datetime import datetime, timezone
import requests

TOKEN = "ExponentPushToken[fQXUGcOmxBzxtQb_Iveayj]"
timestamp = datetime.now(timezone.utc).isoformat()

test_message = {
    "to": TOKEN,
    "title": "Critical Power Alert",
    "body": "UPS is on battery, mains power to factory is down",
    "data": {"createdAt": timestamp}
}

response = requests.post(
    "https://exp.host/--/api/v2/push/send",
    json=test_message,
    headers={"Accept": "application/json", "Content-Type": "application/json"}
)

print(response.status_code)
print(response.text)
