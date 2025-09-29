import json
from django.http import JsonResponse
from django.views.decorators.http import require_POST
from kairo.runtime_config import cfg
from .intent import detect_intent
from .ai_client import call_openai_with_timeouts
from .fast_cache import cache_get_or_set
from .daily_limit import check_and_increment_daily_limit
from .tasks import run_ai


def _get_payload(request):
    try:
        return request.json if hasattr(request, "json") else json.loads(request.body.decode() or "{}")
    except Exception:
        return {}


@require_POST
def ai_router(request):
    payload = _get_payload(request)
    user_id = (
        str(request.user.id) if getattr(request, "user", None) and request.user.is_authenticated
        else request.META.get("HTTP_X_FORWARDED_FOR", request.META.get("REMOTE_ADDR", "anon"))
    )

    ok, count, limit = check_and_increment_daily_limit(user_id)
    if not ok:
        return JsonResponse({
            "error": "limit_reached",
            "message": cfg("AI_LIMIT_BLOCK_MSG", "Daily free limit reached. Try again tomorrow."),
            "limit": limit,
        }, status=429)

    intent = detect_intent(payload)

    if intent == "build_schedule" and cfg("SCHEDULE_FEATURE_ENABLED", "0") != "1":
        return JsonResponse({
            "intent": "build_schedule",
            "status": "disabled",
            "message": cfg("SCHEDULE_COMING_SOON_MSG", "Schedule generation is coming soon. Stay tuned."),
        })

    q = (payload.get("q") or payload.get("message") or "").strip()
    if not q:
        return JsonResponse({"error": "empty_message"}, status=400)

    def _produce():
        return {"answer": call_openai_with_timeouts({"q": q}).get("answer", "")}

    result = cache_get_or_set("qa", {"q": q}, _produce)

    if payload.get("upgrade", True):
        try:
            job = run_ai.delay({"q": q})
            return JsonResponse({
                "intent": "qa",
                "status": "ok",
                "fast": result["answer"],
                "task_id": str(job.id),
                "count": count,
                "limit": None if limit == -1 else limit,
            })
        except Exception:
            pass

    return JsonResponse({
        "intent": "qa",
        "status": "ok",
        "fast": result["answer"],
        "count": count,
        "limit": None if limit == -1 else limit,
    })


