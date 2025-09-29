from celery import shared_task


@shared_task(bind=True, max_retries=2, acks_late=True, reject_on_worker_lost=True)
def run_ai(self, payload: dict):
	from .ai_client import call_openai_with_timeouts
	return call_openai_with_timeouts(payload)
