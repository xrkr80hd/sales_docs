import "server-only";
import { createDbClient } from "@/lib/db/client";

/*
 * Kept under its old name so every route keeps working unchanged.
 * It no longer talks to Supabase: it returns the MySQL-backed client
 * (lib/db/client.ts), which runs on the same server as the app.
 */
export function getSupabaseServiceClient(options: { allowPasswordChange?: boolean; signal?: AbortSignal } = {}) {
  return createDbClient(options);
}
