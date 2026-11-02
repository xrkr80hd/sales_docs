// Column types for the NXTDOX MySQL tables (db/mysql/001_schema.sql).
// The query layer uses this to convert values in both directions so the rest of
// the app keeps receiving exactly what Supabase used to return: booleans as
// booleans, JSON as objects, timestamps as ISO strings ending in +00:00.
export type ColumnType = "text" | "uuid" | "int" | "bool" | "json" | "datetime" | "date";

type TableSpec = { pk: string[]; uuidPk?: boolean; columns: Record<string, ColumnType>; jsonDefaults?: Record<string, string>; defaults?: Record<string, () => unknown> };

const t = (pk: string[], columns: Record<string, ColumnType>, extra: Partial<TableSpec> = {}): TableSpec => ({ pk, columns, ...extra });
const ts = "datetime" as const, b = "bool" as const, j = "json" as const, u = "uuid" as const, s = "text" as const, i = "int" as const;

export const TABLES: Record<string, TableSpec> = {
  app_users: t(["id"], { id: u, email: s, encrypted_password: s, email_confirmed_at: ts, app_metadata: j, user_metadata: j, created_at: ts, updated_at: ts, last_sign_in_at: ts }, { uuidPk: true, jsonDefaults: { app_metadata: "{}", user_metadata: "{}" } }),
  app_sessions: t(["token_hash"], { token_hash: s, user_id: u, created_at: ts, last_seen_at: ts, expires_at: ts }),
  app_password_resets: t(["token_hash"], { token_hash: s, user_id: u, expires_at: ts, used_at: ts }),
  profiles: t(["id"], { id: u, role: s, display_name: s, created_at: ts, card_enabled: b, username: s }),
  organizations: t(["id"], { id: u, name: s, slug: s, created_at: ts }, { uuidPk: true }),
  organization_memberships: t(["user_id"], { user_id: u, organization_id: u, chat_enabled: b, can_dm: b, can_org_chat: b, assigned_by: u, updated_at: ts, chat_nickname: s }),
  user_settings: t(["user_id"], { user_id: u, dealer_info: j, consultant_info: j, updated_at: ts }, { jsonDefaults: { dealer_info: "{}", consultant_info: "{}" } }),
  invites: t(["id"], { id: u, email: s, role: s, invited_by: u, created_at: ts, expires_at: ts, accepted_at: ts }, { uuidPk: true, defaults: { expires_at: () => new Date(Date.now() + 7 * 864e5).toISOString() } }),
  deals: t(["id"], { id: u, user_id: u, workflow_data: j, signatures: j, status: s, finished_at: ts, created_at: ts, updated_at: ts, fni_ready: b, fni_sent_at: ts, fni_claimed_at: ts, fni_claimed_by: u, fni_finished_at: ts, sm_ready: b, sm_sent_at: ts, sm_claimed_at: ts, sm_claimed_by: u, sm_finished_at: ts, deal_number: s, sm_attachments: j }, { uuidPk: true, jsonDefaults: { workflow_data: "{}", signatures: "{}", sm_attachments: "[]" } }),
  notifications: t(["id"], { id: u, recipient_role: s, deal_id: u, message: s, read: b, created_at: ts }, { uuidPk: true }),
  consultant_cards: t(["id"], { id: u, user_id: u, slug: s, is_published: b, published_at: ts, display_name: s, job_title: s, dealership: s, location: s, phone: s, email: s, profile_image_url: s, calling_card_image_url: s, logo_url: s, language_label: s, primary_phrase: s, sales_quote: s, bio: s, inventory_url: s, inventory_button_label: s, call_label: s, text_label: s, email_label: s, created_at: ts, updated_at: ts }, { uuidPk: true }),
  consultant_reviews: t(["id"], { id: u, card_id: u, reviewer_name: s, image_url: s, rating: i, is_long: b, sort_order: i, created_at: ts }, { uuidPk: true }),
  consultant_vehicles: t(["id"], { id: u, card_id: u, title: s, description: s, url: s, image_url: s, vin: s, stock: s, price: s, sort_order: i, created_at: ts, builder_data: j }, { uuidPk: true }),
  consultant_videos: t(["id"], { id: u, card_id: u, title: s, description: s, video_url: s, sort_order: i, created_at: ts }, { uuidPk: true }),
  consultant_sold_gallery: t(["id"], { id: u, card_id: u, title: s, description: s, image_url: s, sort_order: i, created_at: ts }, { uuidPk: true }),
  consultant_social_links: t(["id"], { id: u, card_id: u, title: s, url: s, sort_order: i, created_at: ts }, { uuidPk: true }),
  consultant_analytics_events: t(["id"], { id: u, card_id: u, event_type: s, item_id: s, visitor_hash: s, event_day: "date", created_at: ts }, { uuidPk: true, defaults: { event_day: () => new Date().toISOString().slice(0, 10) } }),
  messenger_conversations: t(["id"], { id: u, organization_id: u, kind: s, title: s, dm_key: s, created_by: u, created_at: ts, updated_at: ts, channel: s }, { uuidPk: true }),
  messenger_participants: t(["conversation_id", "user_id"], { conversation_id: u, user_id: u, last_read_at: ts, joined_at: ts }),
  messenger_messages: t(["id"], { id: i, conversation_id: u, sender_id: u, body: s, created_at: ts, edited_at: ts, deleted_at: ts }),
  messenger_presence: t(["user_id"], { user_id: u, last_seen_at: ts }),
  push_subscriptions: t(["endpoint"], { endpoint: s, user_id: u, subscription: j, created_at: ts, updated_at: ts }),
  media_files: t(["id"], { id: u, user_id: u, bucket: s, path: s, content_type: s, size_bytes: i, created_at: ts }, { uuidPk: true }),
};

// Relationships the app embeds in selects, e.g. "organizations(name)" or "claimer:profiles!fni_claimed_by(display_name)".
export type Relation = { from: string; to: string; fromCol: string; toCol: string; many: boolean; names: string[] };
export const RELATIONS: Relation[] = [
  { from: "organization_memberships", to: "organizations", fromCol: "organization_id", toCol: "id", many: false, names: ["organization_memberships_organization_id_fkey", "organization_id"] },
  { from: "organization_memberships", to: "profiles", fromCol: "user_id", toCol: "id", many: false, names: ["organization_memberships_user_id_fkey", "user_id"] },
  { from: "organization_memberships", to: "profiles", fromCol: "assigned_by", toCol: "id", many: false, names: ["organization_memberships_assigned_by_fkey", "assigned_by"] },
  { from: "deals", to: "profiles", fromCol: "fni_claimed_by", toCol: "id", many: false, names: ["deals_fni_claimed_by_fkey", "fni_claimed_by"] },
  { from: "deals", to: "profiles", fromCol: "sm_claimed_by", toCol: "id", many: false, names: ["deals_sm_claimed_by_fkey", "sm_claimed_by"] },
  { from: "messenger_conversations", to: "messenger_participants", fromCol: "id", toCol: "conversation_id", many: true, names: ["messenger_participants_conversation_id_fkey"] },
  { from: "messenger_conversations", to: "messenger_messages", fromCol: "id", toCol: "conversation_id", many: true, names: ["messenger_messages_conversation_id_fkey"] },
  { from: "consultant_cards", to: "consultant_reviews", fromCol: "id", toCol: "card_id", many: true, names: [] },
  { from: "consultant_cards", to: "consultant_vehicles", fromCol: "id", toCol: "card_id", many: true, names: [] },
  { from: "consultant_cards", to: "consultant_videos", fromCol: "id", toCol: "card_id", many: true, names: [] },
  { from: "consultant_cards", to: "consultant_sold_gallery", fromCol: "id", toCol: "card_id", many: true, names: [] },
  { from: "consultant_cards", to: "consultant_social_links", fromCol: "id", toCol: "card_id", many: true, names: [] },
];

export function tableSpec(name: string) {
  const spec = TABLES[name];
  if (!spec) throw new Error(`Unknown table ${name}`);
  return spec;
}
