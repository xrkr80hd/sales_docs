import { requireAdmin } from "@/lib/require-admin";
import { getSupabaseServiceClient } from "@/lib/supabase-server";

export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if (auth instanceof Response) return auth;

  try {
    const supabase = getSupabaseServiceClient();

    const { data: profiles, error } = await supabase
      .from("profiles")
      .select("id, role, display_name, created_at, card_enabled")
      .order("created_at", { ascending: true });

    if (error) {
      if (process.env.NEXT_PUBLIC_DISABLE_AUTH === "1") throw error;
      return Response.json({ error: error.message }, { status: 500 });
    }

    // Enrich with email from auth.users
    const {
      data: { users },
      error: usersError,
    } = await supabase.auth.admin.listUsers({ perPage: 1000 });

    if (usersError) {
      if (process.env.NEXT_PUBLIC_DISABLE_AUTH === "1") throw usersError;
      return Response.json({ error: usersError.message }, { status: 500 });
    }

    const emailMap = new Map(users.map((u) => [u.id, u.email]));

    const { data: cards, error: cardsError } = await supabase
      .from("consultant_cards")
      .select("user_id, slug, is_published");
    if (cardsError) return Response.json({ error: cardsError.message }, { status: 500 });
    const cardMap = new Map((cards ?? []).map((card) => [card.user_id, card]));

    const enriched = (profiles ?? []).map((p) => ({
      ...p,
      email: emailMap.get(p.id) ?? "unknown",
      card_slug: cardMap.get(p.id)?.slug ?? null,
      card_is_published: Boolean(cardMap.get(p.id)?.is_published),
    }));

    return Response.json({ users: enriched });
  } catch {
    if (process.env.NEXT_PUBLIC_DISABLE_AUTH === "1") {
      return Response.json({
        users: [
          {
            id: "local-xrkr80hd",
            email: "xrkr80hd@gmail.com",
            role: "admin",
            display_name: "Travis Wilkinson",
            created_at: new Date().toISOString(),
            card_enabled: true,
            card_slug: "trav",
            card_is_published: true,
          },
          {
            id: "donald-goff",
            email: "donald.goff@walkerautomotive.com",
            role: "user",
            display_name: "Donald Goff",
            created_at: new Date().toISOString(),
            card_enabled: true,
            card_slug: "donald-goff-donald",
            card_is_published: true,
          },
          {
            id: "local-user-demo",
            email: "consultant@walkerautomotive.com",
            role: "user",
            display_name: "Sales Consultant",
            created_at: new Date().toISOString(),
            card_enabled: false,
            card_slug: null,
            card_is_published: false,
          },
        ],
      });
    }
    return Response.json({ error: "Failed to connect to Supabase." }, { status: 500 });
  }
}
