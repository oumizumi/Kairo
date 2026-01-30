import os

bind = "0.0.0.0:8000"
worker_class = "gthread"
workers = int(os.getenv("WEB_CONCURRENCY", "4"))
threads = int(os.getenv("WEB_THREADS", "4"))
timeout = 45
graceful_timeout = 30
keepalive = 5
preload_app = True
accesslog = "-"
errorlog = "-"





