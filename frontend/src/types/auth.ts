/**
 * Wire types mirroring the FastAPI response models for authentication.
 *
 * Names follow the backend schemas one-to-one so a mismatch is easy to spot.
 */

export interface CurrentUser {
  id: string;
  email: string;
  name: string;
  roles: string[];
  profile: Record<string, unknown> | null;
  // snake_case, matching the backend's `UserMeResponse` field name exactly —
  // this type already mirrors the backend 1:1 with no case conversion, so
  // `emailVerified` here would silently never match the real JSON key.
  email_verified: boolean;
}
