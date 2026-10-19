import "server-only";

import { HttpError } from "./auth";

export function ok(data: unknown, init?: ResponseInit): Response {
  return Response.json(data, init);
}

export function fail(status: number, message: string, extra?: Record<string, unknown>): Response {
  return Response.json({ error: message, ...extra }, { status });
}

/** Convert a thrown error into a JSON response, logging genuine bugs. */
export function handleError(error: unknown): Response {
  if (error instanceof HttpError) return fail(error.status, error.message);
  if (error instanceof SyntaxError) return fail(400, "Request body was not valid JSON.");
  console.error("[api] unhandled error:", error);
  return fail(500, error instanceof Error ? error.message : "Something went wrong.");
}

export async function readJson<T>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T;
  } catch {
    throw new HttpError(400, "Request body was not valid JSON.");
  }
}

export function requireString(value: unknown, field: string, max = 100_000): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new HttpError(400, `"${field}" is required.`);
  }
  if (value.length > max) {
    throw new HttpError(400, `"${field}" is too long (max ${max} characters).`);
  }
  return value.trim();
}

export function optionalString(value: unknown, max = 100_000): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  return value.trim().slice(0, max);
}

/** Client IP from proxy headers, used for widget rate limiting. */
export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return request.headers.get("x-real-ip") || "unknown";
}
