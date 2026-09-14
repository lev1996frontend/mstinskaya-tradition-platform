from __future__ import annotations

import logging

import resend

from app.core.config import Settings, get_settings

logger = logging.getLogger(__name__)


class EmailService:
    """Thin wrapper around Resend. `settings` is an explicit optional
    parameter (not always read from `get_settings()` internally) so tests can
    pass a throwaway `Settings` instance without touching the process-wide,
    `lru_cache`d one."""

    @staticmethod
    def send_verification_email(*, to: str, verify_url: str, settings: Settings | None = None) -> None:
        settings = settings or get_settings()
        subject = "Подтвердите почту — Мстинская традиция"
        html = (
            f"<p>Перейдите по ссылке, чтобы подтвердить почту:</p>"
            f'<p><a href="{verify_url}">{verify_url}</a></p>'
            f"<p>Ссылка действует 24 часа.</p>"
        )
        if not settings.resend_api_key:
            logger.info("EMAIL (dev, not sent): to=%s subject=%r url=%s", to, subject, verify_url)
            return
        resend.api_key = settings.resend_api_key
        resend.Emails.send(
            {
                "from": settings.email_from,
                "to": [to],
                "subject": subject,
                "html": html,
            }
        )
