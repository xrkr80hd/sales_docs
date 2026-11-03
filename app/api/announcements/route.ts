import { getUser } from "@/lib/auth/server";
import { requireAdmin } from "@/lib/require-admin";
import { cleanAnnouncement, createAnnouncement, deleteAnnouncement, listAnnouncements } from "@/lib/announcements-server";
import { listTickets } from "@/lib/tickets-server";
import { OWNER_EMAIL } from "@/lib/auth/server";
import { sql } from "@/lib/db/pool";
import type { Announcement } from "@/lib/announcements";

/*
 * GET    — signed-in users: announcements sent from the Notification Center.
 * POST   — master admin: send one { title, body, signoff?, linkUrl?, linkLabel? }.
 * DELETE — master admin: ?id=<announcement id>.
 */
export const runtime = "nodejs";
const noStore = { "Cache-Control": "private, no-store" };
const token = (request: Request) => (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
const failed = (error: unknown) => Response.json({ error: error instanceof Error ? error.message : "Request failed." }, { status: 500, headers: noStore });

export async function GET(request: Request) {
  const { data } = await getUser(token(request));
  if (!data.user) return Response.json({ error: "Sign in required." }, { status: 401, headers: noStore });
  try {
    const announcements = await listAnnouncements();
    // The master admin also gets every open ticket as a notification, in any view.
    const tickets = await isAdmin(data.user.id, data.user.email) ? await ticketNotifications() : null;
    return Response.json({ announcements: tickets ? [...tickets.items, ...announcements] : announcements, ...(tickets ? { openTickets: tickets.open } : {}) }, { headers: noStore });
  } catch (error) { return failed(error); }
}

async function isAdmin(userId: string, email?: string | null) {
  if (email?.toLowerCase() === OWNER_EMAIL) return true;
  const [row] = await sql<{ role: string }>("SELECT role FROM profiles WHERE id = ?", [userId]);
  return row?.role === "admin";
}

const ROLE_NAMES: Record<string, string> = { admin: "Admin", user: "Consultant", sales_manager: "Sales Manager", fni: "F&I" };
async function ticketNotifications() {
  const open = (await listTickets()).filter(ticket => ticket.status !== "resolved");
  const items: Announcement[] = open.map(ticket => ({
    id: `ticket-${ticket.id}`,
    date: new Date(ticket.createdAt).toLocaleDateString("en-CA", { timeZone: "America/Chicago" }),
    postedAt: ticket.createdAt,
    title: `New ticket: ${ticket.subject}`,
    paragraphs: [
      [ticket.name || ticket.email || "Someone", ROLE_NAMES[ticket.role] || ticket.role, ticket.organization].filter(Boolean).join(" · "),
      ticket.details.length > 220 ? ticket.details.slice(0, 220) + "…" : ticket.details,
    ],
    link: { url: "/admin/tickets", label: "Open Tickets" },
  }));
  return { items, open: open.length };
}

export async function POST(request: Request) {
  const admin = await requireAdmin(request);
  if (admin instanceof Response) return admin;
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return Response.json({ error: "Invalid request." }, { status: 400, headers: noStore }); }
  const value = cleanAnnouncement(body);
  if (typeof value === "string") return Response.json({ error: value }, { status: 400, headers: noStore });
  try { return Response.json({ announcement: await createAnnouncement(value, admin.userId) }, { headers: noStore }); }
  catch (error) { return failed(error); }
}

export async function DELETE(request: Request) {
  const admin = await requireAdmin(request);
  if (admin instanceof Response) return admin;
  const id = new URL(request.url).searchParams.get("id") || "";
  if (!id) return Response.json({ error: "Missing id." }, { status: 400, headers: noStore });
  try { return Response.json({ deleted: await deleteAnnouncement(id) }, { headers: noStore }); }
  catch (error) { return failed(error); }
}
