import { getUser } from "@/lib/auth/server";
import { requireAdmin } from "@/lib/require-admin";
import { createTicket, listTickets, updateTicket } from "@/lib/tickets-server";

/*
 * GET            — your own tickets.  GET ?all=1 — master admin: every ticket.
 * POST           — anyone signed in: { category, subject, details, page? }.
 * PATCH          — master admin: { id, status, adminNote }.
 */
export const runtime = "nodejs";
const noStore = { "Cache-Control": "private, no-store" };
const bearer = (request: Request) => (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
const failed = (error: unknown) => Response.json({ error: error instanceof Error ? error.message : "Request failed." }, { status: 500, headers: noStore });

export async function GET(request: Request) {
  try {
    if (new URL(request.url).searchParams.get("all") === "1") {
      const admin = await requireAdmin(request);
      if (admin instanceof Response) return admin;
      return Response.json({ tickets: await listTickets() }, { headers: noStore });
    }
    const { data } = await getUser(bearer(request));
    if (!data.user) return Response.json({ error: "Sign in required." }, { status: 401, headers: noStore });
    return Response.json({ tickets: await listTickets({ userId: data.user.id }) }, { headers: noStore });
  } catch (error) { return failed(error); }
}

export async function POST(request: Request) {
  const { data } = await getUser(bearer(request));
  if (!data.user) return Response.json({ error: "Sign in required." }, { status: 401, headers: noStore });
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return Response.json({ error: "Invalid request." }, { status: 400, headers: noStore }); }
  try {
    const ticket = await createTicket(data.user.id, body);
    return typeof ticket === "string" ? Response.json({ error: ticket }, { status: 400, headers: noStore }) : Response.json({ ticket }, { headers: noStore });
  } catch (error) { return failed(error); }
}

export async function PATCH(request: Request) {
  const admin = await requireAdmin(request);
  if (admin instanceof Response) return admin;
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return Response.json({ error: "Invalid request." }, { status: 400, headers: noStore }); }
  try {
    const ticket = await updateTicket(body);
    return typeof ticket === "string" ? Response.json({ error: ticket }, { status: 400, headers: noStore }) : Response.json({ ticket }, { headers: noStore });
  } catch (error) { return failed(error); }
}
