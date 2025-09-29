import hashlib
import json
from typing import Any, Callable, Optional

from django.core.cache import cache
from kairo.runtime_config import cfg


def cache_get_or_set(key_base: str, payload: dict, producer: Callable[[], Any], ttl: Optional[int] = None):
    if cfg("AI_ENABLE_RESPONSE_CACHE", "1") != "1":
        return producer()
    ttl = ttl or int(cfg("AI_RESPONSE_CACHE_TTL_S", "90"))
    key_material = (key_base + "|" + json.dumps(payload, sort_keys=True))[:4096]
    key = "airesp:" + hashlib.sha256(key_material.encode()).hexdigest()
    val = cache.get(key)
    if val is not None:
        return val
    val = producer()
    cache.set(key, val, ttl)
    return val


