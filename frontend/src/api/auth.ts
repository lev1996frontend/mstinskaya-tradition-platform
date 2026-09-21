import { apiRequest } from "@/lib/api";
import type { CurrentUser } from "@/types";

/**
 * Both `app/modules/auth` and `app/modules/identity` expose `/auth/register`
 * and `/auth/login`; the former is registered first and wins route
 * resolution. `/users/me` is `auth`'s own too (it shadows identity's the same
 * way), cookie-authenticated — see the backend's `session_auth.py`.
 *
 * None of these pass or read a token: login/register/refresh set the session
 * as an httpOnly cookie server-side, and the browser never needs to know the
 * token's value to use it.
 */
export const login = (body: { email: string; password: string }) =>
  apiRequest<{ message?: string }>("/api/v1/auth/login", { method: "POST", body });

export const register = (body: {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  privacy_consent: boolean;
}) => apiRequest<{ message?: string }>("/api/v1/auth/register", { method: "POST", body });

export const logout = () => apiRequest<{ message: string }>("/api/v1/auth/logout", { method: "POST" });

export const getCurrentUser = () => apiRequest<CurrentUser>("/api/v1/users/me");

export const verifyEmail = (token: string) =>
  apiRequest<{ message?: string }>("/api/v1/auth/verify-email", { method: "POST", body: { token } });

export const resendVerification = () =>
  apiRequest<{ message?: string }>("/api/v1/auth/resend-verification", { method: "POST" });
