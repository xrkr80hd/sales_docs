import { requireAdmin } from "@/lib/require-admin";
import { getSupabaseServiceClient } from "@/lib/supabase-server";

export async function POST(request: Request) {
  const auth = await requireAdmin(request); if (auth instanceof Response) return auth;
  const body = await request.json();
  const db = getSupabaseServiceClient();

  const name = String(body.name || "").trim();
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');

  if (!name || !slug) return Response.json({ error: "Organization name is required." }, { status: 400 });

  const { data: org, error } = await db.from("organizations").insert({ name, slug }).select().single();
  if (error) return Response.json({ error: error.message }, { status: 500 });

  const { error: convoError } = await db.from("messenger_conversations").insert({
    organization_id: org.id,
    kind: 'organization',
    title: name + ' Chat',
  });
  if (convoError) return Response.json({ error: convoError.message }, { status: 500 });

  return Response.json({ ok: true, org });
}
