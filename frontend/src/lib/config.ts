/**
 * Base URL of the FastAPI backend.
 *
 * Server components call it directly (no CORS involved); the browser needs the
 * origin to be listed in the backend's `CORS_ORIGINS` setting.
 */
export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ?? "http://localhost:8000";

export const ACCESS_TOKEN_KEY = "mstina.access_token";
export const REFRESH_TOKEN_KEY = "mstina.refresh_token";
