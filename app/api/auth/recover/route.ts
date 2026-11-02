import { sendPasswordReset } from "@/lib/auth/server";
import { clientIp, noStore, rateLimited } from "@/lib/auth/http";

// Always answers the same way, so it never reveals whether an email has an account.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { email?: unknown; redirectTo?: unknown } | null;
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!email) return Response.json({ error: { message: "Enter your email address.", status: 400 } }, { status: 400, headers: noStore });
  if (rateLimited(`recover:${clientIp(request)}`, 10, 60 * 60e3) || rateLimited(`recover:${email}`, 3, 60 * 60e3)) {
    return Response.json({ error: { message: "Too many reset requests. Try again later.", status: 429 } }, { status: 429, headers: noStore });
  }
  try { await sendPasswordReset(email, typeof body?.redirectTo === "string" ? body.redirectTo : undefined); }
  catch { console.error("password_reset_email_failed"); }
  return Response.json({ ok: true }, { headers: noStore });
}
