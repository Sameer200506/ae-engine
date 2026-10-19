/**
 * Client-side reader for our SSE chat protocol.
 *
 * Uses fetch + ReadableStream rather than EventSource because the request body
 * (agent id, conversation id, message) must be POSTed, which EventSource cannot do.
 */

export interface StreamHandlers {
  onEvent: (event: Record<string, unknown>) => void;
  signal?: AbortSignal;
}

export async function streamChatRequest(
  url: string,
  body: unknown,
  { onEvent, signal }: StreamHandlers,
): Promise<void> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });

  if (!response.ok) {
    // Errors before the stream starts come back as plain JSON.
    let message = `Request failed (HTTP ${response.status}).`;
    try {
      const data = await response.json();
      if (data?.error) message = String(data.error);
    } catch {
      /* keep the status-based message */
    }
    throw new Error(message);
  }

  if (!response.body) throw new Error("The server returned no response body.");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const frames = buffer.split("\n\n");
    buffer = frames.pop() ?? "";

    for (const frame of frames) {
      for (const line of frame.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;
        const payload = trimmed.slice(5).trim();
        if (!payload) continue;
        try {
          onEvent(JSON.parse(payload));
        } catch {
          /* ignore malformed frames */
        }
      }
    }
  }
}

/** POST JSON and unwrap `{ error }` responses into thrown Errors. */
export async function postJson<T = unknown>(url: string, body?: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return unwrap<T>(response);
}

export async function patchJson<T = unknown>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return unwrap<T>(response);
}

export async function deleteJson<T = unknown>(url: string): Promise<T> {
  const response = await fetch(url, { method: "DELETE" });
  return unwrap<T>(response);
}

export async function getJson<T = unknown>(url: string): Promise<T> {
  const response = await fetch(url);
  return unwrap<T>(response);
}

async function unwrap<T>(response: Response): Promise<T> {
  let data: unknown = null;
  try {
    data = await response.json();
  } catch {
    /* empty body */
  }
  if (!response.ok) {
    const message =
      (data as { error?: string } | null)?.error ?? `Request failed (HTTP ${response.status}).`;
    const error = new Error(message) as Error & { code?: string; status?: number };
    error.code = (data as { code?: string } | null)?.code;
    error.status = response.status;
    throw error;
  }
  return data as T;
}
