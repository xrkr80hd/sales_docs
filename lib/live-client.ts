"use client";
/*
 * Live updates without Supabase Realtime. Components still call
 * `client.channel(name).on(...).subscribe(...)`, but one shared, light poll to
 * /api/live delivers new messages, board updates and who is online. Polling is
 * fast while the tab is visible and slows down when it is hidden.
 */
type Payload = { eventType: "INSERT" | "UPDATE" | "DELETE"; new: Record<string, unknown>; old: Record<string, unknown>; table: string; schema: string };
type ChangeListener = { conversation: string | "*"; callback: (payload: Payload) => void };
type BroadcastListener = { event: string; callback: (payload: unknown) => void };
type Status = "SUBSCRIBED" | "CHANNEL_ERROR" | "TIMED_OUT" | "CLOSED";

// Fast only while a Messenger conversation is open; the menu's unread badge alone polls slowly.
const VISIBLE_MS = 3000, HIDDEN_MS = 60000, IDLE_MS = 20000;
const BACKGROUND_CHANNELS = /^messenger-unread/;

export class LiveChannel {
  changes: ChangeListener[] = [];
  broadcasts: BroadcastListener[] = [];
  presenceSync: (() => void)[] = [];
  tracking = false;
  online = new Set<string>();
  private statusCallback?: (status: Status) => void;
  constructor(public name: string, private hub: LiveHub, public presenceKey?: string) {}

  on(type: string, filter: Record<string, string>, callback: (payload: any) => void) {
    if (type === "postgres_changes" && filter.table === "messenger_messages") {
      const conversation = filter.filter?.match(/^conversation_id=eq\.(.+)$/)?.[1] || "*";
      this.changes.push({ conversation, callback });
    } else if (type === "broadcast") this.broadcasts.push({ event: filter.event, callback });
    else if (type === "presence") this.presenceSync.push(callback as () => void);
    return this;
  }
  subscribe(callback?: (status: Status) => void) {
    this.statusCallback = callback;
    this.hub.add(this);
    queueMicrotask(() => this.statusCallback?.("SUBSCRIBED"));
    return this;
  }
  async send(message: { type: string; event: string; payload?: unknown }) {
    if (message.type === "broadcast") await this.hub.broadcast(this.name, message.event);
    return "ok";
  }
  async track(_state?: unknown) { this.tracking = true; this.hub.kick(); return "ok"; }
  async untrack() { this.tracking = false; return "ok"; }
  presenceState(): Record<string, unknown[]> { return Object.fromEntries([...this.online].map(id => [id, [{ user_id: id }]])); }
  unsubscribe() { this.hub.remove(this); this.statusCallback?.("CLOSED"); return Promise.resolve("ok"); }
}

export class LiveHub {
  private channels = new Set<LiveChannel>();
  private timer: number | undefined;
  private since: string | null = null;
  private broadcastVersions = new Map<string, number>();
  private seen = new Set<string>();
  private busy = false;
  constructor(private token: () => string | undefined) {
    if (typeof document !== "undefined") document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") this.kick(); });
  }
  add(channel: LiveChannel) { this.channels.add(channel); this.kick(); }
  remove(channel: LiveChannel) { this.channels.delete(channel); if (!this.channels.size) { window.clearTimeout(this.timer); this.timer = undefined; } }
  kick() { window.clearTimeout(this.timer); this.timer = window.setTimeout(() => void this.poll(), 50); }

  async broadcast(name: string, event: string) {
    const token = this.token();
    if (!token) return;
    await fetch("/api/live", { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ broadcast: `${name}:${event}` }) }).catch(() => undefined);
  }

  private schedule() {
    if (!this.channels.size) return;
    const hasMessages = [...this.channels].some(c => !BACKGROUND_CHANNELS.test(c.name) && (c.changes.length || c.tracking));
    const delay = document.visibilityState !== "visible" ? HIDDEN_MS : hasMessages ? VISIBLE_MS : IDLE_MS;
    window.clearTimeout(this.timer);
    this.timer = window.setTimeout(() => void this.poll(), delay);
  }

  private async poll() {
    const token = this.token();
    if (this.busy || !token || !this.channels.size) { this.schedule(); return; }
    this.busy = true;
    const channels = [...this.channels];
    const conversations = [...new Set(channels.flatMap(c => c.changes.map(l => l.conversation)))];
    const broadcasts = [...new Set(channels.flatMap(c => c.broadcasts.map(b => `${c.name}:${b.event}`)))];
    const presence = channels.some(c => c.presenceSync.length || c.tracking);
    try {
      const response = await fetch("/api/live", {
        method: "POST", cache: "no-store",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ conversations, since: this.since, broadcasts, presence }),
      });
      if (!response.ok) throw new Error(String(response.status));
      const result = await response.json() as { now: string; messages: Record<string, unknown>[]; broadcasts: Record<string, number>; online?: string[] };
      const first = this.since === null;
      this.since = result.now;
      if (!first) for (const row of result.messages) {
        const signature = `${row.id}|${row.edited_at ?? ""}|${row.deleted_at ?? ""}`;
        if (this.seen.has(signature)) continue;
        this.seen.add(signature);
        const payload: Payload = { eventType: row.__insert ? "INSERT" : "UPDATE", new: row, old: { id: row.id }, table: "messenger_messages", schema: "public" };
        for (const channel of channels) for (const listener of channel.changes) if (listener.conversation === "*" || listener.conversation === row.conversation_id) listener.callback(payload);
      } else for (const row of result.messages) this.seen.add(`${row.id}|${row.edited_at ?? ""}|${row.deleted_at ?? ""}`);
      if (this.seen.size > 5000) this.seen = new Set([...this.seen].slice(-2000));
      for (const [key, version] of Object.entries(result.broadcasts || {})) {
        const before = this.broadcastVersions.get(key);
        this.broadcastVersions.set(key, version);
        if (before !== undefined && version !== before) {
          const [name, event] = [key.slice(0, key.lastIndexOf(":")), key.slice(key.lastIndexOf(":") + 1)];
          for (const channel of channels) if (channel.name === name) for (const b of channel.broadcasts) if (b.event === event) b.callback({ type: "broadcast", event, payload: {} });
        }
      }
      if (result.online) for (const channel of channels) if (channel.presenceSync.length || channel.tracking) { channel.online = new Set(result.online); channel.presenceSync.forEach(cb => cb()); }
    } catch { /* The next poll retries; components keep their own fallback refresh. */ }
    finally { this.busy = false; this.schedule(); }
  }
}
