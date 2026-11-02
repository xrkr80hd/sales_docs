import { getUser, setPassword, type AuthError } from "@/lib/auth/server";
import { bearer, noStore } from "@/lib/auth/http";

// Lets a signed-in person (including one who opened a reset link) set a new password.
export async function POST(request: Request) {
  const { data, error } = await getUser(bearer(request));
  if (error || !data.user) return Response.json({ error: error || { message: "Sign in again.", status: 401 } }, { status: 401, headers: noStore });
  const body = await request.json().catch(() => null) as { password?: unknown } | null;
  const password = typeof body?.password === "string" ? body.password : "";
  try {
    await setPassword(data.user.id, password, { must_change_password: false, password_changed_at: new Date().toISOString() });
  } catch (failure) {
    const e = failure as AuthError;
    return Response.json({ error: { message: e.message || "Could not update the password.", status: e.status || 500 } }, { status: e.status || 500, headers: noStore });
  }
  const refreshed = await getUser(bearer(request));
  return Response.json({ user: refreshed.data.user }, { headers: noStore });
}
