import type { User } from "@supabase/supabase-js";
import { getSupabaseServiceClient } from "./supabase-server";

// Service clients bypass RLS. Apply this scope before queue reads and manager actions.
export async function dealOwnerScope(db: ReturnType<typeof getSupabaseServiceClient>, user: Pick<User, "id" | "app_metadata">, role: string): Promise<string[] | null> {
  if (role === "admin" || (role === "sales_manager" && user.app_metadata?.workspace_role === "district_manager")) return null;
  const { data: member, error } = await db.from("organization_memberships").select("organization_id").eq("user_id", user.id).maybeSingle();
  if (error || !member?.organization_id) return [];
  const { data: members, error: membersError } = await db.from("organization_memberships").select("user_id").eq("organization_id", member.organization_id);
  if (membersError) return [];
  return (members || []).map(member => member.user_id);
}
