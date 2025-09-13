import os
from django.core.wsgi import get_wsgi_application

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'kairo.settings')

application = get_wsgi_application()

# Vercel expects the WSGI application to be named 'app'
app = application 