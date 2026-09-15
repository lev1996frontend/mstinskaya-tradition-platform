from __future__ import annotations

import logging

import resend

from app.core.config import Settings, get_settings

logger = logging.getLogger(__name__)

_ROLE_LABELS: dict[str, str] = {
    "INSTRUCTOR": "Инструктор",
    "ORGANIZER": "Организатор",
    "JUDGE": "Судья",
    "MODERATOR": "Модератор",
}
_REJECTION_REASON_LABELS: dict[str, str] = {
    "INSUFFICIENT_EVIDENCE": "недостаточно подтверждений",
    "NOT_RECOGNIZED": "не удалось верифицировать данные",
    "DUPLICATE_REQUEST": "дублирующая заявка",
}


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

    @staticmethod
    def send_role_request_submitted(
        *, to: str, role_code: str, applicant_name: str, settings: Settings | None = None
    ) -> None:
        settings = settings or get_settings()
        role_label = _ROLE_LABELS.get(role_code, role_code)
        subject = f"Новая заявка на роль «{role_label}» — Мстинская традиция"
        html = (
            f"<p>{applicant_name} подал(а) заявку на роль «{role_label}».</p>"
            f"<p>Рассмотреть можно на странице модерации заявок.</p>"
        )
        if not settings.resend_api_key:
            logger.info("EMAIL (dev, not sent): to=%s subject=%r body=%r", to, subject, html)
            return
        resend.api_key = settings.resend_api_key
        resend.Emails.send({"from": settings.email_from, "to": [to], "subject": subject, "html": html})

    @staticmethod
    def send_role_request_approved(*, to: str, role_code: str, settings: Settings | None = None) -> None:
        settings = settings or get_settings()
        role_label = _ROLE_LABELS.get(role_code, role_code)
        subject = f"Заявка на роль «{role_label}» одобрена — Мстинская традиция"
        html = f"<p>Ваша заявка на роль «{role_label}» одобрена.</p>"
        if not settings.resend_api_key:
            logger.info("EMAIL (dev, not sent): to=%s subject=%r body=%r", to, subject, html)
            return
        resend.api_key = settings.resend_api_key
        resend.Emails.send({"from": settings.email_from, "to": [to], "subject": subject, "html": html})

    @staticmethod
    def send_role_request_rejected(
        *, to: str, role_code: str, reason_code: str, reason_text: str | None, settings: Settings | None = None
    ) -> None:
        settings = settings or get_settings()
        role_label = _ROLE_LABELS.get(role_code, role_code)
        reason = reason_text if reason_code == "OTHER" else _REJECTION_REASON_LABELS.get(reason_code, reason_code)
        subject = f"Заявка на роль «{role_label}» отклонена — Мстинская традиция"
        html = f"<p>Ваша заявка на роль «{role_label}» отклонена.</p><p>Причина: {reason}</p>"
        if not settings.resend_api_key:
            logger.info("EMAIL (dev, not sent): to=%s subject=%r body=%r", to, subject, html)
            return
        resend.api_key = settings.resend_api_key
        resend.Emails.send({"from": settings.email_from, "to": [to], "subject": subject, "html": html})
