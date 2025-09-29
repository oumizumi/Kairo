import os
from typing import Any, Dict

import openai

from django.conf import settings
import pybreaker


breaker = pybreaker.CircuitBreaker(
	fail_max=5,
	reset_timeout=60,
)


def call_openai_with_timeouts(payload: Dict[str, Any]) -> Dict[str, Any]:
	"""
	Minimal AI call wrapper with timeouts using OpenAI SDK v1.
	Expects payload like {"q": "..."}. Returns a dict result.
	"""
	api_key = settings.OPENAI_API_KEY or os.environ.get("OPENAI_API_KEY")
	if not api_key:
		raise RuntimeError("OPENAI_API_KEY not configured")

	question = (payload or {}).get("q") or "Hello"

	connect_timeout = getattr(settings, "REQUESTS_DEFAULT_CONNECT_TIMEOUT", 2)
	read_timeout = getattr(settings, "REQUESTS_DEFAULT_READ_TIMEOUT", 25)
	timeout_seconds = max(connect_timeout + read_timeout, read_timeout)

	@breaker
	def _do_call() -> Dict[str, Any]:
		client = openai.OpenAI(api_key=api_key)
		resp = client.chat.completions.create(
			model=os.environ.get("OPENAI_MODEL", "gpt-4o-mini"),
			messages=[{"role": "user", "content": question}],
			timeout=timeout_seconds,
		)
		content = resp.choices[0].message.content if resp and resp.choices else ""
		return {"answer": content}

	try:
		return _do_call()
	except pybreaker.CircuitBreakerError:
		# Short-circuit response for open circuit
		return {"error": "AI service temporarily unavailable", "retry_after_seconds": 30}
	except openai.OpenAIError as e:
		# Bubble up provider errors in a friendly shape
		raise RuntimeError(f"OpenAI error: {getattr(e, 'message', str(e))}")


