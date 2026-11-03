import { signOut } from "@/lib/auth/server";
import { bearer, noStore } from "@/lib/auth/http";

export async function POST(request: Request) {
  const token = bearer(request);
  if (token) await signOut(token).catch(() => undefined);
  return Response.json({ ok: true }, { headers: noStore });
}
