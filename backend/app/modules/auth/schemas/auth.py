from __future__ import annotations

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


class RegisterRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128)
    first_name: str = Field(..., min_length=1, max_length=100)
    last_name: str = Field(..., min_length=1, max_length=100)
    #: Must be explicitly `true` — a checkbox on the register form, not a
    #: default. Rejected at this boundary (422) rather than left to the
    #: service layer, so there is no path to a registered account without it.
    privacy_consent: bool

    @field_validator("password")
    @classmethod
    def validate_password(cls, value: str) -> str:
        if not any(char.isupper() for char in value) or not any(char.isdigit() for char in value):
            raise ValueError("Password must contain an uppercase letter and a digit")
        return value

    @field_validator("privacy_consent")
    @classmethod
    def validate_privacy_consent(cls, value: bool) -> bool:
        if not value:
            raise ValueError("Registration requires consent to the privacy policy")
        return value


class LoginRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)
    email: EmailStr
    password: str = Field(..., min_length=1)


class MessageResponse(BaseModel):
    message: str


class VerifyEmailRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)
    token: str = Field(..., min_length=1)
