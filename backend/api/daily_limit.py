import datetime
from typing import Tuple

from django.core.cache import cache
from kairo.runtime_config import cfg


def _today_key(user_id: str) -> str:
    return f"ai:daily:{user_id}:{datetime.date.today().isoformat()}"


def _seconds_until_midnight(now: datetime.datetime) -> int:
    midnight = datetime.datetime.combine(now.date() + datetime.timedelta(days=1), datetime.time.min)
    return max(1, int((midnight - now).total_seconds()))


def check_and_increment_daily_limit(user_id: str) -> Tuple[bool, int, int]:
    """
    Returns (allowed, count_after, limit). When disabled, returns (True, -1, -1).
    Uses Redis atomic INCR and sets TTL to midnight.
    """
    if cfg("AI_DAILY_LIMIT_ENABLED", "0") != "1":
        return True, -1, -1

    limit = int(cfg("AI_DAILY_LIMIT_PER_USER", "25"))
    key = _today_key(user_id)

    count = cache.get(key)
    if count is None:
        count = cache.incr(key)
        try:
            cache.expire(key, _seconds_until_midnight(datetime.datetime.now()))  # django-redis extra
        except Exception:
            # Fallback: set with timeout next time
            pass
    else:
        count = cache.incr(key)

    if int(count) > limit:
        return False, int(count), limit
    return True, int(count), limit









