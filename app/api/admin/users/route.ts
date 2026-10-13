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
    const users: Array<{id:string;email?:string;email_confirmed_at?:string|null;app_metadata?:Record<string,unknown>;user_metadata?:Record<string,unknown>;created_at:string}> = [];
    for(let page=1;page<=100;page++){
      const {data,error:usersError}=await supabase.auth.admin.listUsers({page,perPage:200});
      if(usersError)return Response.json({error:usersError.message},{status:500});
      users.push(...data.users);
      if(data.users.length<200)break;
    }
    const roleMap = new Map(users.map(u => [u.id, u.app_metadata?.workspace_role]));
    const emailMap = new Map(users.map((u) => [u.id, u.email]));

    const { data: cards, error: cardsError } = await supabase
      .from("consultant_cards")
      .select("user_id, slug, is_published");
    if (cardsError) return Response.json({ error: cardsError.message }, { status: 500 });
    const cardMap = new Map((cards ?? []).map((card) => [card.user_id, card]));

    const profileMap=new Map((profiles??[]).map(p=>[p.id,p]));
    const enriched=users.map(u=>{
      const p=profileMap.get(u.id);
      const name=String(p?.display_name||u.user_metadata?.display_name||u.email?.split("@")[0]||"Unassigned");
      return {
        id:u.id,email:u.email||"",role:p?.role||"user",workspace_role:p?.role==="admin"?"admin":roleMap.get(u.id)||p?.role||"user",
        display_name:name,created_at:p?.created_at||u.created_at,card_enabled:p?.card_enabled===true,
        email_verified:Boolean(u.email_confirmed_at),must_change_password:u.app_metadata?.must_change_password===true,
        card_slug:cardMap.get(u.id)?.slug??null,card_is_published:Boolean(cardMap.get(u.id)?.is_published),
        needs_setup:!p,
      };
    });
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
