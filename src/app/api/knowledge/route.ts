import {
  fail,
  handleError,
  ok,
  optionalString,
  readJson,
} from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { requireOwnedAgent } from "@/lib/agents";
import { ingest, ingestUrl, listDocuments } from "@/lib/rag";
import { checkDocumentQuota } from "@/lib/usage";
import {
  extractFromFile,
  isSupportedFile,
  MAX_UPLOAD_BYTES,
  SUPPORTED_EXTENSIONS,
} from "@/lib/extract";
import type { PlanId } from "@/lib/plans";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const agentId = new URL(request.url).searchParams.get("agentId");
    if (!agentId) return fail(400, "agentId is required.");

    const agent = requireOwnedAgent(agentId, user.id);
    return ok({ documents: listDocuments(agent.id) });
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const quota = checkDocumentQuota(user.id, user.plan as PlanId);
    if (!quota.allowed) {
      return Response.json({ error: quota.reason, code: quota.code }, { status: 402 });
    }

    const contentType = request.headers.get("content-type") ?? "";

    /* ---------------------------- file upload ---------------------------- */
    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      const agentId = String(form.get("agentId") ?? "");
      const file = form.get("file");

      if (!(file instanceof File)) return fail(400, "No file was uploaded.");
      if (!isSupportedFile(file.name)) {
        return fail(400, `Unsupported file type. Supported: ${SUPPORTED_EXTENSIONS.join(", ")}`);
      }
      if (file.size > MAX_UPLOAD_BYTES) {
        return fail(413, `File is too large. Maximum is ${MAX_UPLOAD_BYTES / 1024 / 1024} MB.`);
      }

      const agent = requireOwnedAgent(agentId, user.id);
      const bytes = new Uint8Array(await file.arrayBuffer());

      try {
        const result = await ingest({
          agentId: agent.id,
          userId: user.id,
          title: file.name,
          sourceType: "file",
          sourceRef: file.name,
          text: await extractFromFile(file.name, bytes),
        });
        return ok({ documentId: result.documentId, chunks: result.chunks, chars: result.chars });
      } catch (error) {
        // The document row is already marked `error`; surface the reason so the
        // UI can show it next to the document rather than failing silently.
        return fail(422, error instanceof Error ? error.message : "Could not index the file.");
      }
    }

    /* ------------------------- URL or raw text --------------------------- */
    const body = await readJson<{
      agentId?: string;
      url?: string;
      text?: string;
      title?: string;
    }>(request);

    const agentId = optionalString(body.agentId, 80);
    if (!agentId) return fail(400, "agentId is required.");
    const agent = requireOwnedAgent(agentId, user.id);

    const url = optionalString(body.url, 2000);
    const text = optionalString(body.text, 500_000);

    if (!url && !text) return fail(400, "Provide either a url to fetch or text to index.");

    try {
      if (url) {
        const result = await ingestUrl(agent.id, user.id, url);
        return ok({ documentId: result.documentId, chunks: result.chunks, chars: result.chars });
      }
      const result = await ingest({
        agentId: agent.id,
        userId: user.id,
        title: optionalString(body.title, 200) ?? "Pasted text",
        sourceType: "text",
        text: text!,
      });
      return ok({ documentId: result.documentId, chunks: result.chunks, chars: result.chars });
    } catch (error) {
      return fail(422, error instanceof Error ? error.message : "Could not index the content.");
    }
  } catch (error) {
    return handleError(error);
  }
}
