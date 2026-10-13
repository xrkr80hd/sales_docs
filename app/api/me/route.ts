import { validWorkspaceRole, profileRole } from "@/lib/workspace-roles";
import { getSupabaseServiceClient } from "@/lib/supabase-server";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();

  if (!token) {
    return Response.json({ error: "Missing authorization." }, { status: 401 });
  }

  const supabase = getSupabaseServiceClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser(token);

  if (userError || !user) {
    return Response.json({ error: "Invalid session." }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, display_name")
    .eq("id", user.id)
    .single();

  const [{ data: settings }, { data: card }, { data: membership }] = await Promise.all([
    supabase.from("user_settings").select("consultant_info").eq("user_id", user.id).maybeSingle(),
    supabase.from("consultant_cards").select("profile_image_url").eq("user_id", user.id).maybeSingle(),
    supabase.from("organization_memberships").select("organizations(name)").eq("user_id", user.id).maybeSingle(),
  ]);
  const info = settings?.consultant_info as { profileImageUrl?: string } | null;
  const organization = membership?.organizations as unknown as { name?: string } | null;
  return Response.json({
    id: user.id,
    email: user.email,
    role: profile?.role ?? "user",
    workspaceRole: profile?.role === "admin" ? "admin" : validWorkspaceRole(user.app_metadata?.workspace_role) && profileRole(user.app_metadata.workspace_role) === profile?.role ? user.app_metadata.workspace_role : profile?.role || "user",
    displayName: profile?.display_name ?? user.email?.split("@")[0] ?? "",
    profileImageUrl: info?.profileImageUrl || card?.profile_image_url || "",
    dealership: organization?.name || "",
  });
}
