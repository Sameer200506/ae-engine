import "server-only";

/**
 * Text extraction for knowledge-base ingestion.
 *
 * The parser choices here are the one thing genuinely worth borrowing from the
 * upstream AionUi project (Apache-2.0): mammoth for .docx, pdf.js for .pdf, and
 * turndown for HTML -> Markdown. See NOTICE.
 */

export const SUPPORTED_EXTENSIONS = [
  ".txt",
  ".md",
  ".markdown",
  ".csv",
  ".json",
  ".html",
  ".htm",
  ".pdf",
  ".docx",
] as const;

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB
const MAX_URL_BYTES = 3 * 1024 * 1024;

export class ExtractionError extends Error {}

export function extensionOf(filename: string): string {
  const idx = filename.lastIndexOf(".");
  return idx === -1 ? "" : filename.slice(idx).toLowerCase();
}

export function isSupportedFile(filename: string): boolean {
  return (SUPPORTED_EXTENSIONS as readonly string[]).includes(extensionOf(filename));
}

/** Normalise whitespace: collapse runs of blank lines, strip trailing spaces. */
export function cleanText(input: string): string {
  return input
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

async function extractPdf(bytes: Uint8Array): Promise<string> {
  const { extractText } = await import("unpdf");
  const result = await extractText(bytes, { mergePages: true });
  const text = Array.isArray(result.text) ? result.text.join("\n\n") : result.text;
  if (!text.trim()) {
    throw new ExtractionError(
      "No selectable text found. This PDF is probably scanned images, which needs OCR.",
    );
  }
  return text;
}

async function extractDocx(bytes: Uint8Array): Promise<string> {
  const mammoth = (await import("mammoth")).default;
  const result = await mammoth.extractRawText({ buffer: Buffer.from(bytes) });
  return result.value;
}

function htmlToText(html: string): string {
  // Lazy require via dynamic import keeps cheerio/turndown out of the client graph.
  const { load } = require("cheerio") as typeof import("cheerio");
  const TurndownService = require("turndown") as typeof import("turndown");

  const $ = load(html);
  $("script, style, noscript, iframe, svg, nav, footer, header, form, aside").remove();
  $("[aria-hidden='true']").remove();

  const title = $("title").first().text().trim();
  const main = $("main").length ? $("main") : $("article").length ? $("article") : $("body");

  const turndown = new TurndownService({ headingStyle: "atx", codeBlockStyle: "fenced" });
  turndown.remove(["script", "style", "nav", "footer"]);
  const markdown = turndown.turndown(main.html() ?? "");

  return title ? `# ${title}\n\n${markdown}` : markdown;
}

/** Extract text from an uploaded file. Throws ExtractionError with a usable message. */
export async function extractFromFile(filename: string, bytes: Uint8Array): Promise<string> {
  const ext = extensionOf(filename);
  let text: string;

  try {
    switch (ext) {
      case ".pdf":
        text = await extractPdf(bytes);
        break;
      case ".docx":
        text = await extractDocx(bytes);
        break;
      case ".html":
      case ".htm":
        text = htmlToText(new TextDecoder().decode(bytes));
        break;
      case ".csv": {
        // Keep the header row attached to each record so chunks stay meaningful.
        const raw = new TextDecoder().decode(bytes);
        const lines = raw.split(/\r?\n/).filter((l) => l.trim());
        const header = lines[0] ?? "";
        text = lines.length > 1 ? `Columns: ${header}\n\n${lines.slice(1).join("\n")}` : raw;
        break;
      }
      case ".json":
        text = jsonToText(new TextDecoder().decode(bytes));
        break;
      case ".txt":
      case ".md":
      case ".markdown":
        text = new TextDecoder().decode(bytes);
        break;
      default:
        throw new ExtractionError(
          `Unsupported file type "${ext || "unknown"}". Supported: ${SUPPORTED_EXTENSIONS.join(", ")}`,
        );
    }
  } catch (error) {
    if (error instanceof ExtractionError) throw error;
    throw new ExtractionError(
      `Could not read ${filename}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  const cleaned = cleanText(text);
  if (cleaned.length < 20) {
    throw new ExtractionError(`${filename} contained no usable text.`);
  }
  return cleaned;
}

function jsonToText(raw: string): string {
  const parsed = JSON.parse(raw);
  const lines: string[] = [];
  const walk = (value: unknown, path: string, depth: number) => {
    if (depth > 6) return;
    if (value === null || typeof value !== "object") {
      lines.push(`${path}: ${String(value)}`);
      return;
    }
    if (Array.isArray(value)) {
      value.slice(0, 500).forEach((item, i) => walk(item, `${path}[${i}]`, depth + 1));
      return;
    }
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      walk(v, path ? `${path}.${k}` : k, depth + 1);
    }
  };
  walk(parsed, "", 0);
  return lines.join("\n");
}

/** Fetch a URL and extract its readable text. Blocks private/loopback hosts. */
export async function extractFromUrl(rawUrl: string): Promise<{ text: string; title: string }> {
  let url: URL;
  try {
    url = new URL(rawUrl.trim());
  } catch {
    throw new ExtractionError("That does not look like a valid URL.");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new ExtractionError("Only http and https URLs are supported.");
  }
  if (isPrivateHost(url.hostname)) {
    throw new ExtractionError("Refusing to fetch a private or loopback address.");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  let html: string;

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: { "User-Agent": "AEOEngineBot/0.1 (+knowledge-base ingestion)" },
    });
    if (!response.ok) {
      throw new ExtractionError(`The page returned HTTP ${response.status}.`);
    }
    const contentType = response.headers.get("content-type") ?? "";
    if (!/text\/html|text\/plain|application\/xhtml/.test(contentType)) {
      throw new ExtractionError(`Unsupported content type: ${contentType || "unknown"}.`);
    }
    html = await response.text();
    if (html.length > MAX_URL_BYTES) html = html.slice(0, MAX_URL_BYTES);
  } catch (error) {
    if (error instanceof ExtractionError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new ExtractionError("The page took too long to respond (15s timeout).");
    }
    throw new ExtractionError(
      `Could not fetch the URL: ${error instanceof Error ? error.message : String(error)}`,
    );
  } finally {
    clearTimeout(timeout);
  }

  const text = cleanText(htmlToText(html));
  if (text.length < 20) throw new ExtractionError("That page had no readable text.");

  const { load } = require("cheerio") as typeof import("cheerio");
  const title = load(html)("title").first().text().trim() || url.hostname;
  return { text, title: title.slice(0, 200) };
}

/** SSRF guard: block loopback, link-local and RFC1918 ranges. */
function isPrivateHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".internal")) return true;
  if (host === "::1" || host.startsWith("fe80:") || host.startsWith("fc") || host.startsWith("fd")) {
    return true;
  }
  const v4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (v4) {
    const [a, b] = [Number(v4[1]), Number(v4[2])];
    if (a === 127 || a === 10 || a === 0) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 169 && b === 254) return true;
  }
  return false;
}
