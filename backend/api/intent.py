from typing import Literal
from kairo.runtime_config import cfg

Intent = Literal["build_schedule", "qa", "other"]


def detect_intent(payload: dict) -> "Intent":
    text = (payload.get("q") or payload.get("message") or "").lower()
    schedule_kw = [s.strip() for s in cfg(
        "INTENT_SCHEDULE_KW",
        "build schedule,generate schedule,make a schedule,create schedule,plan my classes,build my timetable,kairoll",
    ).split(",") if s.strip()]
    if any(k in text for k in schedule_kw):
        return "build_schedule"
    return "qa" if text else "other"


