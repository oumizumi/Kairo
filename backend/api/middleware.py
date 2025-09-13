import logging
import time
from typing import Callable
from django.http import HttpRequest, HttpResponse
from django.conf import settings

logger = logging.getLogger(__name__)


class SecurityHeadersMiddleware:
    """
    Middleware to add security headers to all responses
    """

    def __init__(self, get_response: Callable) -> None:
        self.get_response = get_response

    def __call__(self, request: HttpRequest) -> HttpResponse:
        response = self.get_response(request)

        # Security headers
        response['X-Content-Type-Options'] = 'nosniff'
        response['X-Frame-Options'] = 'DENY'
        response['X-XSS-Protection'] = '1; mode=block'
        response['Referrer-Policy'] = 'strict-origin-when-cross-origin'

        # Remove server header for security
        if 'Server' in response:
            del response['Server']

        return response


class RequestLoggingMiddleware:
    """
    Middleware to log requests and responses for monitoring
    """

    def __init__(self, get_response: Callable) -> None:
        self.get_response = get_response

    def __call__(self, request: HttpRequest) -> HttpResponse:
        start_time = time.time()

        # Log incoming request
        if settings.DEBUG or getattr(settings, 'LOG_REQUESTS', False):
            logger.info(
                f"REQUEST: {request.method} {request.path} "
                f"IP: {self._get_client_ip(request)} "
                f"User: {request.user.username if request.user.is_authenticated else 'Anonymous'}"
            )

        response = self.get_response(request)

        # Log response
        duration = time.time() - start_time
        if settings.DEBUG or getattr(settings, 'LOG_REQUESTS', False):
            logger.info(
                f"RESPONSE: {request.method} {request.path} "
                f"Status: {response.status_code} "
                f"Duration: {duration:.2f}s"
            )

        # Log errors (4xx and 5xx)
        if response.status_code >= 400:
            logger.warning(
                f"ERROR: {request.method} {request.path} "
                f"Status: {response.status_code} "
                f"IP: {self._get_client_ip(request)} "
                f"User: {request.user.username if request.user.is_authenticated else 'Anonymous'} "
                f"Duration: {duration:.2f}s"
            )

        return response

    def _get_client_ip(self, request: HttpRequest) -> str:
        """Get client IP address from request"""
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            ip = x_forwarded_for.split(',')[0]
        else:
            ip = request.META.get('REMOTE_ADDR')
        return ip or 'unknown'


class CORSMiddleware:
    """
    Enhanced CORS middleware for production
    """

    def __init__(self, get_response: Callable) -> None:
        self.get_response = get_response

    def __call__(self, request: HttpRequest) -> HttpResponse:
        response = self.get_response(request)

        # Add CORS headers for API endpoints
        if request.path.startswith('/api/'):
            origin = request.META.get('HTTP_ORIGIN', '')

            # Check if origin is allowed
            allowed_origins = getattr(settings, 'CORS_ALLOWED_ORIGINS', [])
            if origin in allowed_origins or getattr(settings, 'CORS_ALLOW_ALL_ORIGINS', False):
                response['Access-Control-Allow-Origin'] = origin
                response['Access-Control-Allow-Credentials'] = 'true'
                response['Access-Control-Allow-Methods'] = 'GET, POST, PUT, PATCH, DELETE, OPTIONS'
                response['Access-Control-Allow-Headers'] = 'Accept, Content-Type, Authorization, X-CSRFToken'
                response['Access-Control-Max-Age'] = '86400'  # 24 hours

        return response
