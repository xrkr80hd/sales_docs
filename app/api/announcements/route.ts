import { getUser } from "@/lib/auth/server";
import { requireAdmin } from "@/lib/require-admin";
import { cleanAnnouncement, createAnnouncement, deleteAnnouncement, listAnnouncements } from "@/lib/announcements-server";

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
  try { return Response.json({ announcements: await listAnnouncements() }, { headers: noStore }); }
  catch (error) { return failed(error); }
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
