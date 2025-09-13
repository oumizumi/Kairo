import logging
from typing import Any, Dict
from django.conf import settings
from django.http import JsonResponse
from rest_framework import status
from rest_framework.exceptions import (
    AuthenticationFailed,
    PermissionDenied,
    NotFound,
    ValidationError,
    Throttled,
)
from rest_framework.views import exception_handler
from rest_framework.response import Response

logger = logging.getLogger(__name__)


def custom_exception_handler(exc: Exception, context: Dict[str, Any]) -> Response:
    """
    Custom exception handler for production error handling
    """
    # Call REST framework's default exception handler first
    response = exception_handler(exc, context)

    if response is not None:
        # Add additional error information for debugging in development
        if settings.DEBUG:
            response.data['debug_info'] = {
                'exception_type': type(exc).__name__,
                'view': context.get('view', {}).get('__class__', {}).get('__name__', 'Unknown'),
                'request_method': context.get('request', {}).method if 'request' in context else 'Unknown',
                'request_path': context.get('request', {}).path if 'request' in context else 'Unknown',
            }

        # Log errors for monitoring
        log_error(exc, context, response.status_code)

        return response

    # Handle unhandled exceptions
    logger.error(
        f"Unhandled exception in {context.get('view', {}).get('__class__', {}).get('__name__', 'Unknown')}: "
        f"{type(exc).__name__}: {str(exc)}",
        exc_info=True
    )

    return JsonResponse(
        {
            'error': 'Internal server error',
            'message': 'An unexpected error occurred. Please try again later.'
        },
        status=status.HTTP_500_INTERNAL_SERVER_ERROR
    )


def log_error(exc: Exception, context: Dict[str, Any], status_code: int) -> None:
    """
    Log errors for monitoring and debugging
    """
    view_name = context.get('view', {}).get('__class__', {}).get('__name__', 'Unknown')
    request = context.get('request')

    if isinstance(exc, Throttled):
        logger.warning(f"Rate limit exceeded in {view_name}: {str(exc)}")
    elif isinstance(exc, AuthenticationFailed):
        logger.warning(f"Authentication failed in {view_name}: {str(exc)}")
    elif isinstance(exc, PermissionDenied):
        logger.warning(f"Permission denied in {view_name}: {str(exc)}")
    elif isinstance(exc, ValidationError):
        logger.info(f"Validation error in {view_name}: {str(exc)}")
    elif status_code >= 500:
        logger.error(
            f"Server error in {view_name}: {type(exc).__name__}: {str(exc)}",
            exc_info=True
        )
    elif status_code >= 400:
        logger.info(f"Client error in {view_name}: {type(exc).__name__}: {str(exc)}")


def validate_request_data(request, required_fields: list) -> Dict[str, Any]:
    """
    Validate that required fields are present in request data
    """
    data = request.data if hasattr(request, 'data') else {}
    missing_fields = []

    for field in required_fields:
        if field not in data or not data[field]:
            missing_fields.append(field)

    if missing_fields:
        raise ValidationError(f"Missing required fields: {', '.join(missing_fields)}")

    return data


def sanitize_log_data(data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Remove sensitive information from log data
    """
    sensitive_fields = ['password', 'token', 'key', 'secret', 'api_key']
    sanitized = data.copy()

    for field in sensitive_fields:
        if field in sanitized:
            sanitized[field] = '***REDACTED***'

    return sanitized


class RateLimitMixin:
    """
    Mixin to add rate limiting to views
    """
    throttle_scope = None

    def get_throttles(self):
        throttles = super().get_throttles() if hasattr(super(), 'get_throttles') else []

        if self.throttle_scope:
            from rest_framework.throttling import ScopedRateThrottle
            throttles.append(ScopedRateThrottle())

        return throttles

