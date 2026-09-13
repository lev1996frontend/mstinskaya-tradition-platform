/**
 * Wire types mirroring the FastAPI response models for authentication.
 *
 * Names follow the backend schemas one-to-one so a mismatch is easy to spot.
 */

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export interface CurrentUser {
  id: string;
  email: string;
  name: string;
  roles: string[];
  profile: Record<string, unknown> | null;
}
