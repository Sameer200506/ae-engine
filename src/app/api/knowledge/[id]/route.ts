import { fail, handleError, ok } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { get, run } from "@/lib/db";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function DELETE(_request: Request, { params }: Ctx) {
  try {
    const user = await requireUser();
    const { id } = await params;

    const doc = get<{ id: string; user_id: string }>(
      "SELECT id, user_id FROM documents WHERE id = ?",
      [id],
    );
    if (!doc || doc.user_id !== user.id) return fail(404, "Document not found.");

    // Chunks cascade via the foreign key.
    run("DELETE FROM documents WHERE id = ?", [id]);
    return ok({ success: true });
  } catch (error) {
    return handleError(error);
  }
}
