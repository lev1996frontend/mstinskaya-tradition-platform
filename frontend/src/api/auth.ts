import { apiRequest } from "@/lib/api";
import type { AuthTokens, CurrentUser } from "@/types";

/**
 * Both `app/modules/auth` and `app/modules/identity` expose `/auth/register`
 * and `/auth/login`; the former is registered first and wins route resolution.
 * `/users/me` only exists in `identity`.
 */
export const login = (body: { email: string; password: string }) =>
  apiRequest<AuthTokens>("/api/v1/auth/login", { method: "POST", body, token: null });

export const register = (body: {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
}) => apiRequest<AuthTokens>("/api/v1/auth/register", { method: "POST", body, token: null });

export const refresh = (refreshToken: string) =>
  apiRequest<AuthTokens>("/api/v1/auth/refresh", {
    method: "POST",
    body: { refresh_token: refreshToken },
    token: null,
  });

export const logout = (refreshToken: string) =>
  apiRequest<{ message: string }>("/api/v1/auth/logout", {
    method: "POST",
    body: { refresh_token: refreshToken },
    token: null,
  });

export const getCurrentUser = (token?: string) =>
  apiRequest<CurrentUser>("/api/v1/users/me", token ? { token } : {});
