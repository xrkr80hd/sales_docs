import { getUser } from "@/lib/auth/server";
import { acceptDisclosure, getUserState, markRead } from "@/lib/user-state-server";
import { DISCLOSURE_VERSION } from "@/lib/disclosure";

/*
 * GET  → { disclosureVersion, currentDisclosureVersion, readAnnouncements }
 * POST { acceptDisclosure: true } | { read: [ids] } → saves to the account.
 */
export const runtime = "nodejs";
const noStore = { "Cache-Control": "private, no-store" };

async function who(request: Request) {
  const token = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  const { data } = await getUser(token);
  return data.user;
}

export async function GET(request: Request) {
  const user = await who(request);
  if (!user) return Response.json({ error: "Sign in required." }, { status: 401, headers: noStore });
  try { return Response.json({ ...(await getUserState(user.id)), currentDisclosureVersion: DISCLOSURE_VERSION }, { headers: noStore }); }
  catch { return Response.json({ error: "Could not load your settings." }, { status: 500, headers: noStore }); }
}

export async function POST(request: Request) {
  const user = await who(request);
  if (!user) return Response.json({ error: "Sign in required." }, { status: 401, headers: noStore });
  let body: { acceptDisclosure?: boolean; read?: unknown };
  try { body = await request.json(); } catch { return Response.json({ error: "Invalid request." }, { status: 400, headers: noStore }); }
  try {
    if (body.acceptDisclosure) await acceptDisclosure(user.id, DISCLOSURE_VERSION);
    const readAnnouncements = Array.isArray(body.read) ? await markRead(user.id, body.read as string[]) : undefined;
    return Response.json({ ok: true, ...(readAnnouncements ? { readAnnouncements } : {}) }, { headers: noStore });
  } catch { return Response.json({ error: "Could not save." }, { status: 500, headers: noStore }); }
}
