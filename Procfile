web: gunicorn kairo.wsgi:application -c gunicorn.conf.py
worker: celery -A kairo worker --concurrency=${CELERY_CONCURRENCY:-16} -Ofair
beat: celery -A kairo beat








