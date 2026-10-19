import {
  createSession,
  findUserByEmail,
  purgeExpiredSessions,
  setSessionCookie,
  toPublicUser,
  verifyPassword,
} from "@/lib/auth";
import { fail, handleError, ok, readJson, requireString } from "@/lib/api";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await readJson<{ email?: string; password?: string }>(request);
    const email = requireString(body.email, "email", 320);
    const password = requireString(body.password, "password", 200);

    purgeExpiredSessions();

    const user = findUserByEmail(email);
    // Same message for both branches so the endpoint does not reveal which
    // emails have accounts.
    const genericFailure = fail(401, "Incorrect email or password.");
    if (!user) return genericFailure;
    if (!(await verifyPassword(password, user.password_hash))) return genericFailure;

    const { token, expiresAt } = createSession(user.id);
    await setSessionCookie(token, expiresAt);

    return ok({ user: toPublicUser(user) });
  } catch (error) {
    return handleError(error);
  }
}
