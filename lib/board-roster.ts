import "server-only";
import { sql } from "@/lib/db/pool";

/*
 * Who appears on a dealership's manager boards: everyone who sells there.
 * That is consultants, plus floor managers and admins who belong to the
 * dealership, since they sell too. Floor-manager status lives on the account
 * (app_users.app_metadata.workspace_role), not on the profile, so it's looked up here.
 */
type Member = { user_id: string; profiles?: unknown };

export async function sellingMembers<T extends Member>(members: T[] | null | undefined): Promise<T[]> {
  const list = members || [];
  const roleOf = (m: T) => (m.profiles as { role?: string } | null | undefined)?.role;
  const managers = list.filter(m => roleOf(m) === "sales_manager").map(m => m.user_id);
  let floor = new Set<string>();
  if (managers.length) {
    const rows = await sql<{ id: string; wr: string | null }>(
      "SELECT id, JSON_UNQUOTE(JSON_EXTRACT(app_metadata, '$.workspace_role')) AS wr FROM app_users WHERE id IN (?)", [managers]);
    floor = new Set(rows.filter(r => r.wr === "floor_manager").map(r => r.id));
  }
  return list.filter(m => { const role = roleOf(m); return role === "user" || role === "admin" || floor.has(m.user_id); });
}

/** Can this one member be put on the board (for confirm / change actions)? */
export async function sellsHere(member: Member | null | undefined) {
  return member ? (await sellingMembers([member])).length === 1 : false;
}
