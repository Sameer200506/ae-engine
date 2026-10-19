import "server-only";

/**
 * Chat completion client.
 *
 * Speaks the OpenAI-compatible `/chat/completions` SSE protocol, which
 * OpenRouter, OpenAI, Groq, DeepSeek, Together and local Ollama/LM Studio all
 * implement. Pointing at a different vendor is an env-var change.
 */

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export type StreamEvent =
  | { type: "delta"; text: string }
  | { type: "model"; model: string }
  | { type: "error"; message: string; retryable: boolean };

const DEFAULT_BASE = "https://openrouter.ai/api/v1";

export function apiBaseUrl(): string {
  return (process.env.LLM_BASE_URL || DEFAULT_BASE).replace(/\/$/, "");
}

export function isLlmConfigured(): boolean {
  return Boolean(process.env.OPENROUTER_API_KEY || process.env.LLM_API_KEY);
}

export function apiKey(): string {
  return process.env.OPENROUTER_API_KEY || process.env.LLM_API_KEY || "";
}

export function defaultModel(): string {
  return process.env.OPENROUTER_MODEL || process.env.LLM_MODEL || "deepseek/deepseek-v4-flash-0731:free";
}

/**
 * Ordered list of models to try. Free OpenRouter endpoints are frequently
 * refused by their upstream provider with a 429 even when your own quota is
 * untouched, so a fallback chain is the difference between "works" and "flaky".
 */
export function modelChain(preferred?: string | null): string[] {
  const chain = [
    preferred || defaultModel(),
    ...(process.env.OPENROUTER_FALLBACK_MODELS ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
    "openrouter/free",
  ];
  return Array.from(new Set(chain.filter(Boolean)));
}

interface StreamOptions {
  messages: ChatMessage[];
  model?: string | null;
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
}

function extraHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey()}`,
  };
  // OpenRouter uses these for attribution on its dashboard. Harmless elsewhere.
  const referer = process.env.NEXT_PUBLIC_APP_URL;
  if (referer) headers["HTTP-Referer"] = referer;
  headers["X-Title"] = process.env.OPENROUTER_SITE_NAME || "AEO Engine";
  return headers;
}

/**
 * Yields text deltas as they arrive. Transparently retries the next model in
 * the chain if a model fails *before* emitting any text, so the user never sees
 * a half-written answer from a dead endpoint.
 */
export async function* streamChat(options: StreamOptions): AsyncGenerator<StreamEvent> {
  if (!isLlmConfigured()) {
    yield {
      type: "error",
      message:
        "No LLM API key configured. Add OPENROUTER_API_KEY to your .env file (free keys: https://openrouter.ai/keys).",
      retryable: false,
    };
    return;
  }

  const chain = modelChain(options.model);
  let lastError = "All models failed.";

  for (let i = 0; i < chain.length; i++) {
    const model = chain[i];
    let emitted = false;

    try {
      const response = await fetch(`${apiBaseUrl()}/chat/completions`, {
        method: "POST",
        headers: extraHeaders(),
        signal: options.signal,
        body: JSON.stringify({
          model,
          messages: options.messages,
          temperature: options.temperature ?? 0.7,
          // Free endpoints often reason before answering; too small a budget
          // yields an empty completion, so leave generous headroom.
          max_tokens: options.maxTokens ?? 2048,
          stream: true,
        }),
      });

      if (!response.ok || !response.body) {
        const body = await response.text().catch(() => "");
        lastError = describeHttpError(response.status, body, model);
        // Try the next model for auth/rate/availability problems; give up on
        // anything that looks like our own malformed request.
        if (response.status === 400 || response.status === 401) {
          yield { type: "error", message: lastError, retryable: false };
          return;
        }
        continue;
      }

      yield { type: "model", model };

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // SSE frames are separated by a blank line; keep the trailing partial.
        const frames = buffer.split("\n\n");
        buffer = frames.pop() ?? "";

        for (const frame of frames) {
          for (const line of frame.split("\n")) {
            const trimmed = line.trim();
            if (!trimmed.startsWith("data:")) continue;
            const payload = trimmed.slice(5).trim();
            if (!payload || payload === "[DONE]") continue;

            try {
              const json = JSON.parse(payload);
              if (json.error) {
                lastError = String(json.error.message ?? "Upstream model error.");
                continue;
              }
              const delta: string | undefined = json.choices?.[0]?.delta?.content;
              if (delta) {
                emitted = true;
                yield { type: "delta", text: delta };
              }
            } catch {
              // Ignore keep-alive comments and malformed frames.
            }
          }
        }
      }

      // Success (even if the model returned no text at all, we are done).
      return;
    } catch (error) {
      if (options.signal?.aborted) return;
      if (emitted) {
        yield {
          type: "error",
          message: "The connection dropped partway through the response.",
          retryable: false,
        };
        return;
      }
      lastError = error instanceof Error ? error.message : String(error);
    }
  }

  yield { type: "error", message: lastError, retryable: true };
}

function describeHttpError(status: number, body: string, model: string): string {
  let detail = body.slice(0, 300);
  try {
    const parsed = JSON.parse(body);
    detail = parsed?.error?.message ?? detail;
  } catch {
    /* keep raw text */
  }
  switch (status) {
    case 401:
      return `OpenRouter rejected the API key (401). Check OPENROUTER_API_KEY. ${detail}`;
    case 402:
      return `Your OpenRouter balance is negative, which also blocks free models (402). Top up to continue. ${detail}`;
    case 429:
      return `Rate limited on ${model} (429). Free models allow 20 requests/min and 50/day, and upstream providers apply their own caps. ${detail}`;
    default:
      return `Model ${model} failed with HTTP ${status}. ${detail}`;
  }
}
