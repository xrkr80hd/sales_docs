// Shapes the app used from @supabase/supabase-js, kept so components don't change.
export type User = {
  id: string; email?: string; aud?: string; role?: string;
  app_metadata: Record<string, any>; user_metadata: Record<string, any>;
  email_confirmed_at?: string | null; created_at?: string; updated_at?: string; last_sign_in_at?: string | null;
};
export type Session = {
  access_token: string; refresh_token: string; token_type: string;
  expires_in: number; expires_at?: number; user: User;
};
export type AuthChangeEvent = "INITIAL_SESSION" | "SIGNED_IN" | "SIGNED_OUT" | "TOKEN_REFRESHED" | "USER_UPDATED" | "PASSWORD_RECOVERY";
export type AuthError = { message: string; status?: number; code?: string; name?: string };
