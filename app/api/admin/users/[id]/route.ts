import { requireAdmin } from "@/lib/require-admin";
import { getSupabaseServiceClient } from "@/lib/supabase-server";

const VALID_ROLES = ["admin", "user", "fni", "sales_manager"] as const;
const OWNER_EMAIL = "xrkr80hd@gmail.com";

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "consultant";
}

async function isOwnerAccount(id: string) {
  const supabase = getSupabaseServiceClient();
  const { data, error } = await supabase.auth.admin.getUserById(id);
  if (error) throw error;
  return data.user.email?.toLowerCase() === OWNER_EMAIL;
}

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
    if (await isOwnerAccount(id)) {
      return Response.json(
        { error: "The master admin role cannot be changed." },
        { status: 400 },
      );
    }
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

    let card: { slug: string; is_published: boolean } | null = null;
    if (body?.card_enabled === true) {
      const { data: existingCard } = await supabase
        .from("consultant_cards")
        .select("slug, is_published")
        .eq("user_id", id)
        .maybeSingle();
      if (existingCard) return Response.json({ ok: true, updates, card: existingCard });

      const [{ data: profile }, { data: authUser, error: authUserError }] = await Promise.all([
        supabase.from("profiles").select("display_name").eq("id", id).single(),
        supabase.auth.admin.getUserById(id),
      ]);
      if (authUserError) return Response.json({ error: authUserError.message }, { status: 500 });
      const email = authUser.user.email || "";
      const displayName = profile?.display_name || email.split("@")[0] || "Consultant";
      const slug = email.toLowerCase() === OWNER_EMAIL ? "trav" : `${slugify(displayName)}-${id.slice(0, 6)}`;
      const { data: savedCard, error: cardError } = await supabase
        .from("consultant_cards")
        .insert({ user_id: id, slug, display_name: displayName, email, updated_at: new Date().toISOString() })
        .select("slug, is_published")
        .single();
      if (cardError) return Response.json({ error: cardError.message }, { status: 500 });
      card = savedCard;
    }

    return Response.json({ ok: true, updates, card });
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

  if (await isOwnerAccount(id)) {
    return Response.json(
      { error: "The master admin account cannot be removed." },
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
