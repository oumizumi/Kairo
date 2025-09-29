from django.contrib import admin
from django.urls import path, include
from django.http import JsonResponse
from django.db import connections

def healthz(request):
    return JsonResponse({"ok": True})

def readyz(request):
    try:
        connections['default'].cursor()
        return JsonResponse({"db": True})
    except Exception:
        return JsonResponse({"db": False}, status=503)

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include('api.urls')), # Include API urls
    path('healthz/', healthz),
    path('readyz/', readyz),
]
