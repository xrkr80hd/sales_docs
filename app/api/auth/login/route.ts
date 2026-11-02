import { signInWithPassword } from "@/lib/auth/server";
import { clientIp, noStore, rateLimited } from "@/lib/auth/http";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { email?: unknown; password?: unknown } | null;
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  if (!email || !password) return Response.json({ error: { message: "Enter your email and password.", status: 400 } }, { status: 400, headers: noStore });
  if (rateLimited(`login:${clientIp(request)}`, 30, 15 * 60e3) || rateLimited(`login:${email}`, 10, 15 * 60e3)) {
    return Response.json({ error: { message: "Too many sign-in attempts. Wait a few minutes and try again.", status: 429 } }, { status: 429, headers: noStore });
  }
  try {
    const { session, error } = await signInWithPassword(email, password);
    if (error) return Response.json({ error }, { status: error.status, headers: noStore });
    return Response.json({ session }, { headers: noStore });
  } catch {
    return Response.json({ error: { message: "Sign-in is temporarily unavailable. Try again.", status: 503 } }, { status: 503, headers: noStore });
  }
}
