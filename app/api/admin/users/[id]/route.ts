import { validWorkspaceRole, profileRole } from "@/lib/workspace-roles";
import { requireAdmin } from "@/lib/require-admin";
import { getSupabaseServiceClient } from "@/lib/supabase-server";


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

  if (body && Object.prototype.hasOwnProperty.call(body, "display_name")) {
    const name = typeof body.display_name === "string" ? body.display_name.trim() : "";
    if (!name || name.length > 120) return Response.json({ error: "Enter a display name between 1 and 120 characters." }, { status: 400 });
    updates.display_name = name;
  }

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
    if (!validWorkspaceRole(body.role)) {
      return Response.json(
        { error: "Invalid workspace role." },
        { status: 400 },
      );
    }
    updates.role = profileRole(body.role);
  }

  if (typeof body?.card_enabled === "boolean") {
    updates.card_enabled = body.card_enabled;
  }

  const publishChange = typeof body?.card_published === "boolean" ? body.card_published as boolean : null;
  let slugChange: string | null = null;
  if (typeof body?.card_slug === "string") {
    const cleaned: string = body.card_slug.trim().toLowerCase().replace(/^.*\/card\//, "").replace(/[^a-z0-9-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
    slugChange = cleaned;
    if (cleaned.length < 2 || cleaned.length > 80) return Response.json({ error: "Card link must be 2–80 letters, numbers or dashes." }, { status: 400 });
  }

  if (Object.keys(updates).length === 0 && publishChange === null && slugChange === null) {
    return Response.json({ error: "Nothing to update." }, { status: 400 });
  }

  try {
    const supabase = getSupabaseServiceClient();

    // Admin control: repair or assign this person's card link (e.g. to match an NFC band already written).
    if (slugChange !== null) {
      const { data: owned, error: ownedError } = await supabase.from("consultant_cards").select("id").eq("user_id", id).maybeSingle();
      if (ownedError) return Response.json({ error: ownedError.message }, { status: 500 });
      if (!owned) return Response.json({ error: "This person has no card yet. Turn on Consultant card and save first." }, { status: 400 });
      const { data: taken } = await supabase.from("consultant_cards").select("user_id").eq("slug", slugChange).maybeSingle();
      if (taken && taken.user_id !== id) return Response.json({ error: `The link /card/${slugChange} already belongs to someone else.` }, { status: 409 });
      const { error: slugError } = await supabase.from("consultant_cards").update({ slug: slugChange, updated_at: new Date().toISOString() }).eq("id", owned.id).eq("user_id", id);
      if (slugError) return Response.json({ error: slugError.message }, { status: 500 });
      if (Object.keys(updates).length === 0 && publishChange === null) return Response.json({ ok: true, card: { slug: slugChange } });
    }

    // Admin control: publish or take down this person's card (only their own row, by user_id).
    if (publishChange !== null) {
      const { data: target, error: targetError } = await supabase
        .from("consultant_cards")
        .select("id, slug, published_at")
        .eq("user_id", id)
        .maybeSingle();
      if (targetError) return Response.json({ error: targetError.message }, { status: 500 });
      if (!target) return Response.json({ error: "This person has no card yet. Turn on Consultant card and save first." }, { status: 400 });
      const now = new Date().toISOString();
      const { error: publishError } = await supabase
        .from("consultant_cards")
        .update({ is_published: publishChange, published_at: publishChange ? (target.published_at || now) : null, updated_at: now })
        .eq("id", target.id)
        .eq("user_id", id);
      if (publishError) return Response.json({ error: publishError.message }, { status: 500 });
      if (publishChange) await supabase.from("profiles").update({ card_enabled: true }).eq("id", id);
      if (Object.keys(updates).length === 0) return Response.json({ ok: true, card: { slug: slugChange ?? target.slug, is_published: publishChange } });
    }

    const { error } = await supabase
      .from("profiles")
      .update(updates)
      .eq("id", id);

    if (error) {
      if ((process.env.NODE_ENV !== "production" && process.env.NEXT_PUBLIC_DISABLE_AUTH === "1")) return Response.json({ ok: true, updates });
      return Response.json({ error: error.message }, { status: 500 });
    }

    if (body?.role) {
      const { data: target, error: targetError } = await supabase.auth.admin.getUserById(id);
      if (targetError) return Response.json({ error: targetError.message }, { status: 500 });
      const { error: roleError } = await supabase.auth.admin.updateUserById(id, { app_metadata: { ...target.user.app_metadata, workspace_role: body.role } });
      if (roleError) return Response.json({ error: roleError.message }, { status: 500 });
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
    if ((process.env.NODE_ENV !== "production" && process.env.NEXT_PUBLIC_DISABLE_AUTH === "1")) {
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
