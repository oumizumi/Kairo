from django.db import models


class RuntimeConfig(models.Model):
    key = models.CharField(max_length=120, unique=True)
    value = models.TextField(blank=True, default="")
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self) -> str:  # pragma: no cover
        return f"{self.key}={self.value}"


