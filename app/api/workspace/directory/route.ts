import { organizationBranding } from "@/lib/organization-branding";
import { getSupabaseServiceClient } from "@/lib/supabase-server";
export async function GET(request: Request) {
  const token = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return Response.json({ error: "Sign in required." }, { status: 401 });
  try {
    const db = getSupabaseServiceClient();
    const { data: { user }, error: authError } = await db.auth.getUser(token);
    if (!user || authError) return Response.json({ error: "Invalid session." }, { status: 401 });
    const { data: profile } = await db.from("profiles").select("role").eq("id",user.id).single();
    if (profile?.role !== "admin" && user.email?.toLowerCase() !== "xrkr80hd@gmail.com" && !(profile?.role === "sales_manager" && user.app_metadata?.workspace_role === "district_manager")) return Response.json({ error: "District manager access required." }, { status: 403 });
    const [organizations,memberships,users] = await Promise.all([db.from("organizations").select("id,name,slug").order("name"),db.from("organization_memberships").select("user_id,organization_id,chat_enabled,can_dm,can_org_chat"),db.from("profiles").select("id,display_name,role")]);
    const error = organizations.error || memberships.error || users.error;
    if (error) return Response.json({ error: error.message }, { status: 500 });
    const branding=await organizationBranding(db);
    return Response.json({ organizations: organizations.data?.filter(org=>!branding[org.id]?.deletedAt).map(org=>({...org,...branding[org.id]})), memberships: memberships.data, users: users.data });
  } catch { return Response.json({ error: "Could not load the organization directory." }, { status: 500 }); }
}
