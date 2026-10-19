/**
 * Minimal SSE writer.
 *
 * We hand-roll the wire format instead of pulling in a streaming framework: the
 * protocol is ~20 lines, works identically for the dashboard and the embedded
 * widget, and has no version churn to track.
 */

export const SSE_HEADERS = {
  "Content-Type": "text/event-stream; charset=utf-8",
  "Cache-Control": "no-cache, no-transform",
  Connection: "keep-alive",
  // Prevents nginx from buffering the stream and breaking token-by-token output.
  "X-Accel-Buffering": "no",
} as const;

export interface SseWriter {
  send: (event: unknown) => void;
  close: () => void;
  readonly closed: boolean;
}

export function sseStream(): { writer: SseWriter; response: Response } {
  const encoder = new TextEncoder();

  // `controller` is assigned by start(), which the ReadableStream constructor
  // invokes synchronously - so it is always set before this function returns.
  // (Referencing the writer object from inside start() would deadlock on the
  // temporal dead zone, since the const is not initialised yet.)
  let controller: ReadableStreamDefaultController<Uint8Array> | null = null;
  let closed = false;

  const stream = new ReadableStream<Uint8Array>({
    start(c) {
      controller = c;
    },
    cancel() {
      // The client went away. Further sends become no-ops.
      closed = true;
    },
  });

  const writer: SseWriter = {
    get closed() {
      return closed;
    },
    send(event: unknown) {
      if (closed || !controller) return;
      try {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      } catch {
        // Enqueue after close/cancel throws; treat it as a closed stream.
        closed = true;
      }
    },
    close() {
      if (closed || !controller) return;
      closed = true;
      try {
        controller.close();
      } catch {
        /* already closed by the client */
      }
    },
  };

  return { writer, response: new Response(stream, { headers: SSE_HEADERS }) };
}

/** Encode a single SSE payload as text (used by tests and non-streaming handlers). */
export function sseEncode(event: unknown): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}
