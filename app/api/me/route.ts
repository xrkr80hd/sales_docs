import { organizationBranding } from "@/lib/organization-branding";
import { validWorkspaceRole, profileRole } from "@/lib/workspace-roles";
import { getSupabaseServiceClient } from "@/lib/supabase-server";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();

  if (!token) {
    return Response.json({ error: "Missing authorization." }, { status: 401 });
  }

  const supabase = getSupabaseServiceClient({ allowPasswordChange: true });

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser(token);

  if (userError || !user) {
    return Response.json({ error: "Invalid session." }, { status: 401 });
  }

  if (user.app_metadata?.must_change_password === true) return Response.json({ mustChangePassword: true }, { headers: { "Cache-Control": "no-store" } });

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, display_name")
    .eq("id", user.id)
    .single();

  const [{ data: settings }, { data: membership }] = await Promise.all([
    supabase.from("user_settings").select("consultant_info").eq("user_id", user.id).maybeSingle(),
    supabase.from("organization_memberships").select("organization_id,organizations(name)").eq("user_id", user.id).maybeSingle(),
  ]);
  const info = settings?.consultant_info as { profileImageUrl?: string } | null;
  const branding = membership?.organization_id ? (await organizationBranding(supabase).catch(()=>({} as Record<string,{iconUrl?:string;theme?:string;hideIcon?:boolean}>)))[membership.organization_id] : undefined;
  const organization = membership?.organizations as unknown as { name?: string } | null;
  return Response.json({
    id: user.id,
    email: user.email,
    role: profile?.role ?? "user",
    workspaceRole: profile?.role === "admin" ? "admin" : validWorkspaceRole(user.app_metadata?.workspace_role) && profileRole(user.app_metadata.workspace_role) === profile?.role ? user.app_metadata.workspace_role : profile?.role || "user",
    displayName: profile?.display_name ?? user.email?.split("@")[0] ?? "",
    profileImageUrl: info?.profileImageUrl || "",
    dealership: organization?.name || "",
    organizationId: membership?.organization_id || "",
    organizationHideIcon: branding?.hideIcon || false,
    organizationIconUrl: branding?.iconUrl || "",
    organizationTheme: branding?.theme || "",
  });
}
