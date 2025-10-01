import os

try:
    from .models.runtime_config import RuntimeConfig
except Exception:  # pragma: no cover
    RuntimeConfig = None  # type: ignore


def cfg(key: str, default: str = "") -> str:
    try:
        if RuntimeConfig is not None:
            row = RuntimeConfig.objects.filter(key=key).only("value").first()
            if row and row.value not in (None, ""):
                return row.value
    except Exception:
        # DB might be unavailable during migration/startup
        pass
    return os.getenv(key, default)






