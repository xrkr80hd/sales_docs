import "server-only";
import type { Queryable } from "./pool";
import { QueryBuilder, type ScopeFilter } from "./query";
import { messengerAccess, markRead, startDirectMessage } from "./messenger-access";
import { admin, authError, getUser, type UserResponse } from "@/lib/auth/server";
import { storage } from "@/lib/storage/server";

/*
 * The server-side database client. It keeps the shape of the Supabase client the
 * app was written against (`from`, `rpc`, `auth`, `storage`) so routes did not
 * need rewriting, but everything runs against the local MySQL database.
 */

// New organizations get their two Messenger channels (was a Postgres trigger).
async function afterInsert(table: string, rows: Record<string, unknown>[], conn: Queryable) {
  if (table !== "organizations") return;
  for (const row of rows) {
    await conn.query(`INSERT IGNORE INTO messenger_conversations (id, organization_id, kind, channel, title) VALUES
      (UUID(), ?, 'organization', 'consultant', 'Consultant Chat'), (UUID(), ?, 'organization', 'management', 'Management Chat')`, [row.id, row.id]);
  }
}

type Options = { allowPasswordChange?: boolean; signal?: AbortSignal; actingUserId?: string };

export function createDbClient(options: Options = {}) {
  // A user-scoped client sees only the Messenger rows that user may see (was row-level security).
  let access: ReturnType<typeof messengerAccess> | undefined;
  const scope: ScopeFilter | undefined = options.actingUserId ? async table => {
    if (!["messenger_conversations", "messenger_participants", "messenger_messages"].includes(table)) return null;
    access ??= messengerAccess(options.actingUserId!);
    const { conversations } = await access;
    return { column: table === "messenger_conversations" ? "id" : "conversation_id", values: conversations };
  } : undefined;

  return {
    from<T = any[]>(table: string) { return new QueryBuilder<T>(table, scope, { afterInsert }); },

    async rpc(name: string, args: Record<string, unknown> = {}): Promise<{ data: any; error: { message: string; code: string } | null }> {
      const userId = options.actingUserId;
      try {
        if (!userId) throw Object.assign(new Error("Sign in required."), { code: "42501" });
        if (name === "messenger_accessible_organizations") return { data: (await (access ??= messengerAccess(userId))).organizations, error: null };
        if (name === "messenger_start_dm") return { data: await startDirectMessage(userId, String(args.other || "")), error: null };
        if (name === "messenger_mark_read") { await markRead(userId, String(args.cid || ""), String(args.mid || "")); return { data: null, error: null }; }
        throw new Error(`Unknown function ${name}`);
      } catch (error) {
        const e = error as { message?: string; code?: string };
        return { data: null, error: { message: e.message || "Request failed.", code: e.code || "XX000" } };
      }
    },

    auth: {
      async getUser(token?: string): Promise<UserResponse> {
        const result = await getUser(token);
        if (!options.allowPasswordChange && result.data.user?.app_metadata?.must_change_password === true) {
          return { data: { user: null }, error: authError("Change your password before continuing.", 403, "password_change_required") };
        }
        return result;
      },
      admin,
    },

    storage,

    /** A client that applies Messenger privacy rules for this user. */
    asUser(userId: string) { return createDbClient({ ...options, actingUserId: userId }); },
  };
}

export type DbClient = ReturnType<typeof createDbClient>;
