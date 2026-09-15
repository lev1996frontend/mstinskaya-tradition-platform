import pytest
from pydantic import ValidationError

from app.modules.role_requests.schemas.role_request import RoleRequestReviewRequest


def test_reject_without_reason_code_is_invalid():
    with pytest.raises(ValidationError):
        RoleRequestReviewRequest(status="REJECTED")


def test_reject_with_other_and_no_text_is_invalid():
    with pytest.raises(ValidationError):
        RoleRequestReviewRequest(status="REJECTED", reason_code="OTHER")


def test_reject_with_other_and_text_is_valid():
    payload = RoleRequestReviewRequest(status="REJECTED", reason_code="OTHER", reason_text="нет документов")
    assert payload.reason_text == "нет документов"


def test_reject_with_fixed_reason_code_is_valid():
    payload = RoleRequestReviewRequest(status="REJECTED", reason_code="INSUFFICIENT_EVIDENCE")
    assert payload.reason_text is None


def test_approve_ignores_reason_fields():
    payload = RoleRequestReviewRequest(status="APPROVED")
    assert payload.reason_code is None
