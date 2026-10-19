import { all, now, run, uid } from "@/lib/db";
import { fail, handleError, ok, readJson, requireString } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { getPlan, type PlanId } from "@/lib/plans";

export const runtime = "nodejs";

interface PromptRow {
  id: string;
  title: string;
  body: string;
  created_at: number;
}

export async function GET() {
  try {
    const user = await requireUser();
    const prompts = all<PromptRow>(
      "SELECT id, title, body, created_at FROM saved_prompts WHERE user_id = ? ORDER BY created_at DESC",
      [user.id],
    );
    return ok({ prompts });
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = await readJson<{ title?: string; body?: string }>(request);
    const title = requireString(body.title, "title", 120);
    const promptBody = requireString(body.body, "body", 8000);

    const existing = all<{ c: number }>(
      "SELECT COUNT(*) AS c FROM saved_prompts WHERE user_id = ?",
      [user.id],
    )[0]?.c ?? 0;

    // Free accounts get a small shelf; saved prompts are a Pro selling point.
    const cap = getPlan(user.plan as PlanId).id === "free" ? 5 : 200;
    if (existing >= cap) {
      return Response.json(
        { error: `You can save up to ${cap} prompts on your current plan.`, code: "plan_feature" },
        { status: 402 },
      );
    }

    const id = uid("prm_");
    run("INSERT INTO saved_prompts (id, user_id, title, body, created_at) VALUES (?, ?, ?, ?, ?)", [
      id,
      user.id,
      title,
      promptBody,
      now(),
    ]);
    return ok({ prompt: { id, title, body: promptBody, created_at: now() } });
  } catch (error) {
    return handleError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await requireUser();
    const id = new URL(request.url).searchParams.get("id");
    if (!id) return fail(400, "id is required.");

    const row = all<{ id: string }>(
      "SELECT id FROM saved_prompts WHERE id = ? AND user_id = ?",
      [id, user.id],
    )[0];
    if (!row) return fail(404, "Prompt not found.");

    run("DELETE FROM saved_prompts WHERE id = ?", [id]);
    return ok({ success: true });
  } catch (error) {
    return handleError(error);
  }
}
