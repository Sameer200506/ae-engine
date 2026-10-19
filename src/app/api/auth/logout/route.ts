import { cookies } from "next/headers";
import { clearSessionCookie, destroySession, SESSION_COOKIE } from "@/lib/auth";
import { handleError, ok } from "@/lib/api";

export const runtime = "nodejs";

export async function POST() {
  try {
    const store = await cookies();
    const token = store.get(SESSION_COOKIE)?.value;
    if (token) destroySession(token);
    await clearSessionCookie();
    return ok({ success: true });
  } catch (error) {
    return handleError(error);
  }
}
