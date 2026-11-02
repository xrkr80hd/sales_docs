import { exchangeRecoveryToken } from "@/lib/auth/server";
import { clientIp, noStore, rateLimited } from "@/lib/auth/http";

// Trades the one-time token from a reset or invite email for a session.
export async function POST(request: Request) {
  if (rateLimited(`recovery:${clientIp(request)}`, 20, 15 * 60e3)) return Response.json({ error: { message: "Too many attempts. Try again later.", status: 429 } }, { status: 429, headers: noStore });
  const body = await request.json().catch(() => null) as { token?: unknown } | null;
  const token = typeof body?.token === "string" ? body.token : "";
  if (!token) return Response.json({ error: { message: "This link is incomplete.", status: 400 } }, { status: 400, headers: noStore });
  const { session, error } = await exchangeRecoveryToken(token);
  if (error) return Response.json({ error }, { status: error.status, headers: noStore });
  return Response.json({ session }, { headers: noStore });
}
