try:
    from .celery import app as celery_app  # noqa
except Exception:  # pragma: no cover
    celery_app = None  # Celery not installed/available in some dev envs

__all__ = ("celery_app",)
