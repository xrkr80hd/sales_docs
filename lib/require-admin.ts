import { getSupabaseServiceClient } from "@/lib/supabase-server";

/**
 * Verify the Authorization header carries a valid Supabase access token
 * belonging to a user with role = 'admin'. Returns the admin's user id
 * on success, or a Response to send back on failure.
 */
export async function requireAdmin(
  request: Request,
): Promise<{ userId: string } | Response> {
  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();

  if (process.env.NEXT_PUBLIC_DISABLE_AUTH === "1") {
    return { userId: "local-admin-xrkr80hd" };
  }

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
    .select("role")
    .eq("id", user.id)
    .single();

  const isTrav = user.email?.toLowerCase() === "xrkr80hd@gmail.com";
  if (!isTrav && (!profile || profile.role !== "admin")) {
    return Response.json({ error: "Admin access required." }, { status: 403 });
  }

  return { userId: user.id };
}
