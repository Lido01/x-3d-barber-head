from .models import AuditLog


def log_action(request, action, target=None, details=None):
    """Best-effort audit entry. Never block a shop operation because logging failed."""
    try:
        forwarded = request.META.get("HTTP_X_FORWARDED_FOR", "").split(",")[0].strip()
        AuditLog.objects.create(
            actor=request.user if getattr(request.user, "is_authenticated", False) else None,
            action=action,
            target_type=target.__class__.__name__ if target else "",
            target_id=str(getattr(target, "pk", "")) if target else "",
            details=details or {},
            ip_address=forwarded or request.META.get("REMOTE_ADDR") or None,
        )
    except Exception:
        pass
