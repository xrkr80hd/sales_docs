import { requireAdmin } from "@/lib/require-admin";
import { getSupabaseServiceClient } from "@/lib/supabase-server";

const VALID_ROLES = ["admin", "user", "fni", "sales_manager"] as const;

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin(request);
  if (auth instanceof Response) return auth;

  const { id } = await params;

  const body = await request.json().catch(() => null);
  const updates: Record<string, unknown> = {};

  if (body?.role) {
    if (id === auth.userId) {
      return Response.json(
        { error: "You cannot change your own role." },
        { status: 400 },
      );
    }
    if (!VALID_ROLES.includes(body.role)) {
      return Response.json(
        { error: `Invalid role. Must be one of: ${VALID_ROLES.join(", ")}` },
        { status: 400 },
      );
    }
    updates.role = body.role;
  }

  if (typeof body?.card_enabled === "boolean") {
    updates.card_enabled = body.card_enabled;
  }

  if (Object.keys(updates).length === 0) {
    return Response.json({ error: "Nothing to update." }, { status: 400 });
  }

  try {
    const supabase = getSupabaseServiceClient();

    const { error } = await supabase
      .from("profiles")
      .update(updates)
      .eq("id", id);

    if (error) {
      if (process.env.NEXT_PUBLIC_DISABLE_AUTH === "1") return Response.json({ ok: true, updates });
      return Response.json({ error: error.message }, { status: 500 });
    }

    return Response.json({ ok: true, updates });
  } catch {
    if (process.env.NEXT_PUBLIC_DISABLE_AUTH === "1") {
      return Response.json({ ok: true, updates });
    }
    return Response.json({ error: "Failed to connect to Supabase." }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin(request);
  if (auth instanceof Response) return auth;

  const { id } = await params;

  if (id === auth.userId) {
    return Response.json(
      { error: "You cannot remove yourself." },
      { status: 400 },
    );
  }

  const supabase = getSupabaseServiceClient();

  const { error } = await supabase.auth.admin.deleteUser(id);

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ ok: true });
}
