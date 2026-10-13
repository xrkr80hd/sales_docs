import { createClient, AuthError } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";

export function getSupabaseServiceClient(options: { allowPasswordChange?: boolean } = {}) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.",
    );
  }

  const client = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  if (!options.allowPasswordChange) {
    const getUser = client.auth.getUser.bind(client.auth);
    client.auth.getUser = async (token?: string) => {
      const result = await getUser(token);
      if (result.data.user?.app_metadata?.must_change_password === true) {
        return { data: { user: null }, error: new AuthError("Change your password before continuing.", 403, "password_change_required") };
      }
      return result;
    };
  }
  return client;
}
