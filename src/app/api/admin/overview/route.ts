import { handleError, ok } from "@/lib/api";
import { listAllUsers, requireAdmin } from "@/lib/auth";
import { adminListConversations, adminStats } from "@/lib/conversations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await requireAdmin();
    const search = new URL(request.url).searchParams.get("q") ?? undefined;

    return ok({
      stats: adminStats(),
      users: listAllUsers(),
      conversations: adminListConversations(150, search),
    });
  } catch (error) {
    return handleError(error);
  }
}
