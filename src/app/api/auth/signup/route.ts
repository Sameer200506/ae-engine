import { createSession, createUser, setSessionCookie, toPublicUser, findUserById } from "@/lib/auth";
import { fail, handleError, ok, readJson, requireString } from "@/lib/api";

export const runtime = "nodejs";

interface Body {
  email?: string;
  password?: string;
  name?: string;
}

export async function POST(request: Request) {
  try {
    const body = await readJson<Body>(request);
    const email = requireString(body.email, "email", 320);
    const password = requireString(body.password, "password", 200);

    if (password.length < 8) {
      return fail(400, "Password must be at least 8 characters.");
    }

    const user = await createUser(email, password, body.name ?? "");
    const { token, expiresAt } = createSession(user.id);
    await setSessionCookie(token, expiresAt);

    return ok({ user: toPublicUser(findUserById(user.id)!) });
  } catch (error) {
    return handleError(error);
  }
}
