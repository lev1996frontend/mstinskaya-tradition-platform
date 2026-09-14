import logging

from app.core.config import Settings
from app.core.email import EmailService


def _dev_settings() -> Settings:
    return Settings(resend_api_key=None, email_from="Test <test@example.com>", frontend_base_url="http://localhost:3000")


def test_send_verification_email_logs_instead_of_sending_without_api_key(caplog):
    with caplog.at_level(logging.INFO):
        EmailService.send_verification_email(
            to="someone@example.com",
            verify_url="http://localhost:3000/verify-email?token=abc123",
            settings=_dev_settings(),
        )
    assert "someone@example.com" in caplog.text
    assert "http://localhost:3000/verify-email?token=abc123" in caplog.text


def test_send_verification_email_calls_resend_with_api_key(monkeypatch):
    calls = []
    monkeypatch.setattr("app.core.email.resend.Emails.send", lambda payload: calls.append(payload))

    settings = Settings(
        resend_api_key="re_test_key",
        email_from="Test <test@example.com>",
        frontend_base_url="http://localhost:3000",
    )
    EmailService.send_verification_email(
        to="someone@example.com",
        verify_url="http://localhost:3000/verify-email?token=abc123",
        settings=settings,
    )

    assert len(calls) == 1
    assert calls[0]["to"] == ["someone@example.com"]
    assert calls[0]["from"] == "Test <test@example.com>"
    assert "abc123" in calls[0]["html"]
