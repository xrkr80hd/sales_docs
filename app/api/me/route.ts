import { organizationBranding, type OrganizationBranding } from "@/lib/organization-branding";
import { validWorkspaceRole, profileRole } from "@/lib/workspace-roles";
import { getSupabaseServiceClient } from "@/lib/supabase-server";

export async function GET(request: Request) {
  const token = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return Response.json({ error: "Missing authorization." }, { status: 401 });
  const headers = { "Cache-Control": "no-store" };
  let stage = "session";
  try {
    const supabase = getSupabaseServiceClient({ allowPasswordChange: true });
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      console.warn("account_session_check_failed", { status: userError?.status, code: userError?.code });
      // Network/auth-service failures are recoverable; signing in again cannot fix them.
      const unavailable = userError && (!userError.status || userError.status >= 500);
      return Response.json({ error: unavailable ? "Account verification is temporarily unavailable. Please retry." : "Your session has expired. Please sign in again." }, { status: unavailable ? 503 : 401, headers });
    }
    if (user.app_metadata?.must_change_password === true) return Response.json({ mustChangePassword: true }, { headers });

    stage = "workspace";
    const [profileResult, membershipResult] = await Promise.all([
      supabase.from("profiles").select("role, display_name").eq("id", user.id).single(),
      supabase.from("organization_memberships").select("organization_id,organizations(name)").eq("user_id", user.id).maybeSingle(),
    ]);
    if (profileResult.error || membershipResult.error) throw new Error("Workspace lookup failed");
    const profile = profileResult.data;
    if (!profile?.role) return Response.json({ error: "Your workspace profile is unavailable. Contact your administrator." }, { status: 403, headers });
    const membership = membershipResult.data;
    const organization = membership?.organizations as unknown as { name?: string } | null;
    const identity = {
      id: user.id, email: user.email,
      role: profile.role,
      workspaceRole: profile.role === "admin" ? "admin" : validWorkspaceRole(user.app_metadata?.workspace_role) && profileRole(user.app_metadata.workspace_role) === profile.role ? user.app_metadata.workspace_role : profile.role,
      displayName: profile.display_name ?? user.email?.split("@")[0] ?? "",
      dealership: organization?.name || "", organizationId: membership?.organization_id || "",
      mustChangePassword: false,
    };
    // Startup needs identity and permissions only. Profile photos and branding load later.
    if (new URL(request.url).searchParams.get("access") === "1") return Response.json(identity, { headers });

    stage = "appearance";
    const [settingsResult, brands] = await Promise.all([
      supabase.from("user_settings").select("profileImageUrl:consultant_info->>profileImageUrl").eq("user_id", user.id).maybeSingle(),
      membership?.organization_id ? organizationBranding(supabase) : Promise.resolve({} as Record<string, OrganizationBranding>),
    ]);
    if (settingsResult.error) throw new Error("Profile settings lookup failed");
    const info = settingsResult.data;
    const branding = brands[membership?.organization_id || ""];
    return Response.json({ ...identity, profileImageUrl: info?.profileImageUrl || "", organizationHideIcon: branding?.hideIcon || false, organizationIconUrl: branding?.iconUrl || "", organizationTheme: branding?.theme || "", organizationAddress: branding?.address || { street: "", city: "", state: "", zip: "" } }, { headers });
  } catch {
    // Record the failing stage without tokens, email addresses, or private records.
    console.error("account_lookup_failed", { stage });
    return Response.json({ error: stage === "session" ? "Account verification is temporarily unavailable. Please retry." : "Your workspace could not be loaded. Please retry." }, { status: 503, headers });
  }
}
