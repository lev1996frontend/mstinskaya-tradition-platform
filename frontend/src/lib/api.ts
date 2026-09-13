import { API_BASE_URL } from "./config";

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
  /** Public tournament data changes during an event, so it is never cached. */
  revalidate?: number | false;
  signal?: AbortSignal;
  /**
   * Extra headers for this one request — an idempotency key, say. Applied
   * after the defaults, so a caller can override `Accept`.
   */
  headers?: Record<string, string>;
};

/**
 * In the browser, a relative path so the request goes to Next's own origin
 * and its `/api/v1/*` rewrite (see `next.config.ts`) forwards it to the
 * backend — same-origin from the browser's point of view, which is what lets
 * the auth cookie ride along as a plain `SameSite=Lax` cookie. Server
 * components have no browser and no rewrite to go through, so they call the
 * backend directly.
 */
function resolveUrl(path: string): string {
  return typeof window === "undefined" ? `${API_BASE_URL}${path}` : path;
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
  const { method = "GET", body, revalidate = false, signal, headers: extra } = options;

  const headers: Record<string, string> = { Accept: "application/json", ...(extra ?? {}) };
  if (body !== undefined) headers["Content-Type"] = "application/json";

  let response: Response;
  try {
    response = await fetch(resolveUrl(path), {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
      // The httpOnly auth cookie is only ever relevant in the browser — a
      // server component's fetch has no browser session to send.
      ...(typeof window === "undefined" ? {} : { credentials: "include" as const }),
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
 * Send one or several files as multipart form data.
 *
 * `apiRequest` cannot do this: it unconditionally sets a JSON content type and
 * stringifies the body. Note that `Content-Type` is deliberately *not* set
 * here either — the browser has to write it itself, because only it knows the
 * multipart boundary it generated.
 *
 * Several files go out under the *same* field name, repeated, which is how
 * multipart carries a list and what FastAPI reads back into a `list[UploadFile]`.
 */
export async function apiUpload<T>(
  path: string,
  file: File | File[],
  field = "file",
): Promise<T> {
  const headers: Record<string, string> = { Accept: "application/json" };

  const form = new FormData();
  for (const item of Array.isArray(file) ? file : [file]) form.append(field, item);

  let response: Response;
  try {
    response = await fetch(resolveUrl(path), {
      method: "POST",
      headers,
      body: form,
      credentials: "include",
      cache: "no-store",
    });
  } catch (error) {
    throw new ApiUnreachableError(error);
  }

  const text = await response.text();
  const payload = text ? safeJsonParse(text) : null;
  if (!response.ok) throw new ApiError(response.status, payload, extractDetail(payload));
  return payload as T;
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
