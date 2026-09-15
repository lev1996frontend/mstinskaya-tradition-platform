from app.core.config import Settings
from app.core.email import EmailService


def _dev_settings() -> Settings:
    return Settings(resend_api_key=None)


def test_send_role_request_submitted_logs_without_raising(caplog):
    with caplog.at_level("INFO"):
        EmailService.send_role_request_submitted(
            to="mod@example.com", role_code="INSTRUCTOR", applicant_name="Иван Иванов", settings=_dev_settings()
        )
    assert "Иван Иванов" in caplog.text
    assert "Инструктор" in caplog.text


def test_send_role_request_approved_logs_role_label(caplog):
    with caplog.at_level("INFO"):
        EmailService.send_role_request_approved(to="user@example.com", role_code="JUDGE", settings=_dev_settings())
    assert "Судья" in caplog.text


def test_send_role_request_rejected_uses_fixed_label_for_known_reason(caplog):
    with caplog.at_level("INFO"):
        EmailService.send_role_request_rejected(
            to="user@example.com",
            role_code="ORGANIZER",
            reason_code="INSUFFICIENT_EVIDENCE",
            reason_text=None,
            settings=_dev_settings(),
        )
    assert "недостаточно подтверждений" in caplog.text


def test_send_role_request_rejected_uses_free_text_for_other():
    # OTHER without a network call still must not raise even though the
    # caller-supplied text, not a fixed label, drives the message.
    EmailService.send_role_request_rejected(
        to="user@example.com",
        role_code="ORGANIZER",
        reason_code="OTHER",
        reason_text="нет подтверждающих документов от клуба",
        settings=_dev_settings(),
    )
