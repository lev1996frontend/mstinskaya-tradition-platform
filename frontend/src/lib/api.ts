import { ACCESS_TOKEN_KEY, API_BASE_URL } from "./config";

export class ApiError extends Error {
  readonly status: number;
  readonly detail: unknown;

  constructor(status: number, detail: unknown, message?: string) {
    super(message ?? `Запрос завершился с кодом ${status}`);
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
  }
}

/** Thrown when the backend cannot be reached at all (not running, wrong URL). */
export class ApiUnreachableError extends Error {
  constructor(cause?: unknown) {
    super("Не удалось связаться с API");
    this.name = "ApiUnreachableError";
    this.cause = cause;
  }
}

type RequestOptions = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  token?: string | null;
  /** Public tournament data changes during an event, so it is never cached. */
  revalidate?: number | false;
  signal?: AbortSignal;
};

function readBrowserToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(ACCESS_TOKEN_KEY);
  } catch {
    return null;
  }
}

function extractDetail(payload: unknown): string | undefined {
  if (typeof payload === "string") return payload;
  if (payload && typeof payload === "object" && "detail" in payload) {
    const detail = (payload as { detail: unknown }).detail;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail)) {
      const first = detail[0] as { msg?: string } | undefined;
      if (first?.msg) return first.msg;
    }
  }
  return undefined;
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, token, revalidate = false, signal } = options;
  const authToken = token !== undefined ? token : readBrowserToken();

  const headers: Record<string, string> = { Accept: "application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (authToken) headers.Authorization = `Bearer ${authToken}`;

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
      ...(revalidate === false ? { cache: "no-store" as const } : { next: { revalidate } }),
    });
  } catch (error) {
    throw new ApiUnreachableError(error);
  }

  if (response.status === 204) return undefined as T;

  const text = await response.text();
  const payload = text ? safeJsonParse(text) : null;

  if (!response.ok) {
    throw new ApiError(response.status, payload, extractDetail(payload));
  }
  return payload as T;
}

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

/**
 * Server-component helper: returns `null` instead of throwing when a resource
 * is missing or the API is down, so a page can render a placeholder rather
 * than a crash screen.
 */
export async function apiRequestOrNull<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T | null> {
  try {
    return await apiRequest<T>(path, options);
  } catch (error) {
    if (error instanceof ApiError || error instanceof ApiUnreachableError) return null;
    throw error;
  }
}

/** Same as above for collection endpoints, degrading to an empty list. */
export async function apiListOrEmpty<T>(path: string, options: RequestOptions = {}): Promise<T[]> {
  const result = await apiRequestOrNull<T[]>(path, options);
  return result ?? [];
}

/**
 * Same as `apiListOrEmpty`, but keeps the "API unreachable" case distinct
 * from a genuinely empty list, so a page can tell the two apart instead of
 * showing an offline notice for an empty-but-working backend.
 */
export async function apiListWithOffline<T>(
  path: string,
  options: RequestOptions = {},
): Promise<{ items: T[]; offline: boolean }> {
  try {
    const items = await apiRequest<T[]>(path, options);
    return { items, offline: false };
  } catch (error) {
    if (error instanceof ApiUnreachableError) return { items: [], offline: true };
    if (error instanceof ApiError) return { items: [], offline: false };
    throw error;
  }
}
