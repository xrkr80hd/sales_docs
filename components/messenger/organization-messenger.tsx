"use client";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowLeft, ChevronDown, ChevronRight, MessageCircle, Search, Send, ShieldCheck, Users, Plus, X, RefreshCw } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { OrganizationBadge } from "@/components/command-center/organization-badge";
import { useSession } from "@/components/auth/supabase-session-gate";
import { messengerRequest } from "@/lib/messenger-request";
import styles from "./organization-messenger.module.css";

type Organization = { id: string; name: string; iconUrl: string; hideIcon: boolean };
type Person = { user_id: string; organization_id?: string; name: string; role: string; can_dm: boolean };
type Conversation = { id: string; kind: string; channel: string | null; title: string; organization_id: string; unread: number; messenger_participants: { user_id: string; last_read_at: string }[] };
type Message = { id: number; sender_id: string; senderName?: string; body: string; created_at: string; edited_at?: string };
type Payload = { me: string; canCreateOrganization: boolean; canDm: boolean; organizations: Organization[]; people: Person[]; conversations: Conversation[] };
function initials(name: string) { return name.split(/\s+/).slice(0, 2).map(w => w[0]).join("").toUpperCase(); }
function Badge({ count }: { count: number }) { return count > 0 ? <span className={styles.badge} aria-label={`${count} unread`}>{count > 99 ? "99+" : count}</span> : null; }
export function OrganizationMessenger() {
  const { accessToken } = useSession();
  const request = useCallback((path?: string, body?: object) => messengerRequest(accessToken, path, body), [accessToken]);
  const loadingDirectory = useRef(false);
  const [data, setData] = useState<Payload | null>(null), [error, setError] = useState("");
  const [orgId, setOrgId] = useState<string | null>(null), [activeId, setActiveId] = useState<string | null>(null);
  const [screen, setScreen] = useState("organizations"), [search, setSearch] = useState("");
  const [messages, setMessages] = useState<Message[]>([]), [hasMore, setHasMore] = useState(false), [loadingHistory, setLoadingHistory] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, string>>({}), [busy, setBusy] = useState(false), [connection, setConnection] = useState("Connecting…");
  const [creating, setCreating] = useState(false), [orgName, setOrgName] = useState("");
  const [editing, setEditing] = useState<Message | null>(null), [editText, setEditText] = useState("");
  const [deleting, setDeleting] = useState<number | null>(null);
  const shell = useRef<HTMLDivElement>(null), list = useRef<HTMLDivElement>(null), activeRef = useRef(activeId), sequence = useRef(0), nearBottom = useRef(true);
  activeRef.current = activeId;
  const report = (e: unknown) => setError(e instanceof Error ? e.message : "Please try again.");
  const load = useCallback(async () => {
    if (loadingDirectory.current) return;
    loadingDirectory.current = true;
    try {
      const payload: Payload = await request(); setData(payload); setError("");
      if (activeRef.current && !payload.conversations.some(c => c.id === activeRef.current)) { setActiveId(null); setMessages([]); setScreen("organizations"); }
    } catch (e) { report(e); } finally { loadingDirectory.current = false; }
  }, [request]);
  const refreshHistory = useCallback(async (id: string, initial = false) => {
    const ticket = ++sequence.current;
    if (initial) setLoadingHistory(true);
    try {
      const page: { messages: Message[]; hasMore: boolean } = await request(`/api/messenger?conversationId=${id}`);
      if (activeRef.current !== id || ticket !== sequence.current) return;
      setMessages(previous => initial ? page.messages : [...previous.filter(m => page.messages.length > 0 && m.id < page.messages[0].id), ...page.messages]);
      if (initial) setHasMore(page.hasMore);
      const latest = page.messages.at(-1);
      if (latest && document.visibilityState === "visible") {
        await request(undefined, { action: "mark-read", conversationId: id, messageId: latest.id });
        if (activeRef.current === id) setData(previous => previous ? { ...previous, conversations: previous.conversations.map(c => c.id === id ? { ...c, unread: 0 } : c) } : previous);
      }
    } catch (e) { report(e); }
    finally { if (activeRef.current === id && ticket === sequence.current) setLoadingHistory(false); }
  }, [request]);
  useEffect(() => {
    void load();
    const refresh = () => { if (document.visibilityState === "visible") { void load(); if (activeRef.current) void refreshHistory(activeRef.current); } };
    const timer = window.setInterval(refresh, 15000);
    window.addEventListener("focus", refresh); document.addEventListener("visibilitychange", refresh);
    const client = getSupabaseBrowserClient();
    const channel = client.channel("messenger-authorized-changes").on("postgres_changes", { event: "*", schema: "public", table: "messenger_messages" }, refresh).subscribe(status => setConnection(status === "SUBSCRIBED" ? "Live" : "Reconnecting · automatic refresh"));
    return () => { clearInterval(timer); window.removeEventListener("focus", refresh); document.removeEventListener("visibilitychange", refresh); void client.removeChannel(channel); };
  }, [load, refreshHistory]);
  useEffect(() => {
    setMessages([]); setHasMore(false); setEditing(null); setDeleting(null); nearBottom.current = true;
    if (activeId) void refreshHistory(activeId, true);
  }, [activeId, refreshHistory]);
  useEffect(() => { if (nearBottom.current && list.current) list.current.scrollTop = list.current.scrollHeight; }, [messages]);
  useEffect(() => {
    // visualViewport shrinks with the software keyboard on iOS and Android.
    const resize = () => { if (shell.current) { const viewport = window.visualViewport; const bottom = (viewport?.height || window.innerHeight) + (viewport?.offsetTop || 0); shell.current.style.height = `${Math.max(180, bottom - shell.current.getBoundingClientRect().top - 8)}px`; } };
    resize(); window.addEventListener("resize", resize); window.visualViewport?.addEventListener("resize", resize); window.visualViewport?.addEventListener("scroll", resize);
    return () => { window.removeEventListener("resize", resize); window.visualViewport?.removeEventListener("resize", resize); window.visualViewport?.removeEventListener("scroll", resize); };
  }, []);
  const org = data?.organizations.find(o => o.id === orgId);
  const active = data?.conversations.find(c => c.id === activeId);
  const person = (id: string) => data?.people.find(p => p.user_id === id);
  const dmPerson = (c: Conversation) => person(c.messenger_participants.find(p => p.user_id !== data?.me)?.user_id || "");
  const title = active?.kind === "dm" ? dmPerson(active)?.name || "Private message" : active?.title;
  const rooms = data?.conversations.filter(c => c.kind === "organization" && c.organization_id === orgId) || [];
  const members = data?.people.filter(p => p.organization_id === orgId) || [];
  const open = (id: string) => { setActiveId(id); setScreen("conversation"); setError(""); };
  const choose = (id: string) => { setOrgId(previous => previous === id ? null : id); setActiveId(null); setScreen(orgId === id ? "organizations" : "directory"); };
  const back = () => { if (screen === "conversation") { setActiveId(null); setScreen(orgId ? "directory" : "organizations"); } else { setOrgId(null); setScreen("organizations"); } };
  async function dm(p: Person) {
    const existing = data?.conversations.find(c => c.kind === "dm" && c.messenger_participants.some(m => m.user_id === p.user_id));
    if (existing) return open(existing.id);
    setBusy(true);
    try { const result = await request(undefined, { action: "start-dm", userId: p.user_id }); await load(); open(result.conversationId); } catch (e) { report(e); } finally { setBusy(false); }
  }
  async function send(event: FormEvent) {
    event.preventDefault(); if (!activeId || busy) return;
    const id = activeId, text = drafts[id]?.trim(); if (!text) return;
    setBusy(true); setError("");
    try { await request(undefined, { action: "send", conversationId: id, body: text }); setDrafts(d => ({ ...d, [id]: "" })); nearBottom.current = true; await refreshHistory(id); await load(); } catch (e) { report(e); } finally { setBusy(false); }
  }
  async function older() {
    if (!activeId || !messages[0] || loadingHistory) return;
    const id = activeId; setLoadingHistory(true);
    const height = list.current?.scrollHeight || 0;
    try { const page = await request(`/api/messenger?conversationId=${id}&before=${messages[0].id}`); if (activeRef.current !== id) return; nearBottom.current = false; setMessages(previous => [...page.messages, ...previous]); setHasMore(page.hasMore); requestAnimationFrame(() => { if (list.current) list.current.scrollTop += list.current.scrollHeight - height; }); } catch (e) { report(e); } finally { if (activeRef.current === id) setLoadingHistory(false); }
  }
  async function changeMessage(action: "edit" | "delete", messageId: number) {
    setBusy(true);
    try { await request(undefined, { action, messageId, body: editText }); setEditing(null); setDeleting(null); if (activeId) await refreshHistory(activeId, true); } catch (e) { report(e); } finally { setBusy(false); }
  }
  async function createOrganization(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try { const result = await request("/api/admin/workspace", { action: "create-organization", name: orgName }); await load(); setOrgName(""); setCreating(false); setOrgId(result.organization.id); setScreen("directory"); } catch (e) { report(e); } finally { setBusy(false); }
  }
  function roomRow(room: Conversation) {
    return <button key={room.id} className={`${styles.row} ${activeId === room.id ? styles.selected : ""}`} onClick={() => open(room.id)}>{room.channel === "management" ? <ShieldCheck className={styles.red} /> : <Users />}<span className={styles.rowText}><strong>{room.title}</strong><small>{room.channel === "management" ? "Authorized management" : "Consultants & management"}</small></span><Badge count={room.unread} /></button>;
  }
  return <div ref={shell} className={`${styles.shell} ${styles[screen]}`}>
    <header className={styles.topbar}><div><strong>NXT <span>DOX</span></strong><small>MESSENGER</small></div><span className={styles.connection}>{connection}</span></header>
    {error && <div className={styles.error} role="alert"><span>{error}</span><button aria-label="Retry" onClick={() => { setError(""); void load(); if (activeId) void refreshHistory(activeId, true); }}><RefreshCw size={18} /></button><button aria-label="Dismiss error" onClick={() => setError("")}><X size={18} /></button></div>}
    {!data ? <div className={styles.empty} role="status">{error ? "Messenger could not load." : "Loading your conversations…"}</div> : <div className={styles.columns}>
      <section className={styles.organizations} aria-label="Organizations">
        <div className={styles.heading}><h1>Organizations</h1>{data.canCreateOrganization && <button aria-label="Create organization" onClick={() => setCreating(!creating)}><Plus size={20} /></button>}</div>
        {creating && <form className={styles.createForm} onSubmit={createOrganization}><label htmlFor="organization-name">Organization name</label><input id="organization-name" value={orgName} onChange={e => setOrgName(e.target.value)} maxLength={120} required /><button disabled={busy || !orgName.trim()}>Create organization</button><button type="button" onClick={() => setCreating(false)}>Cancel</button></form>}
        <label className={styles.search}><Search size={17} /><input aria-label="Search organizations" placeholder="Search organizations…" value={search} onChange={e => setSearch(e.target.value)} /></label>
        <div className={styles.scroll}>
          {data.organizations.filter(o => o.name.toLowerCase().includes(search.toLowerCase())).map(o => <div key={o.id}>
            <button className={`${styles.row} ${o.id === orgId ? styles.selected : ""}`} aria-expanded={o.id === orgId} aria-controls={`rooms-${o.id}`} onClick={() => choose(o.id)}><OrganizationBadge name={o.name} iconUrl={o.iconUrl} hidden={o.hideIcon} className={styles.orgIcon} /><span className={styles.rowText}><strong>{o.name}</strong></span><Badge count={data.conversations.filter(c => c.organization_id === o.id).reduce((n, c) => n + c.unread, 0)} />{o.id === orgId ? <ChevronDown size={16} /> : <ChevronRight size={16} />}</button>
            <div id={`rooms-${o.id}`} className={styles.accordion} hidden={o.id !== orgId}>{rooms.map(roomRow)}</div>
          </div>)}
          {!data.organizations.length && <p className={styles.empty}>No organizations are available for your account.</p>}
          {data.organizations.length > 0 && !data.organizations.some(o => o.name.toLowerCase().includes(search.toLowerCase())) && <p className={styles.empty}>No organizations match your search.</p>}
          {data.conversations.some(c => c.kind === "dm") && <details className={styles.privateMessages}><summary><span>Private messages</span><Badge count={data.conversations.filter(c => c.kind === "dm").reduce((n,c) => n+c.unread,0)} /></summary>{data.conversations.filter(c => c.kind === "dm").map(c => <button key={c.id} className={styles.row} onClick={() => { setOrgId(data.organizations.some(o => o.id === c.organization_id) ? c.organization_id : null); open(c.id); }}><span className={styles.avatar}>{initials(dmPerson(c)?.name || "DM")}</span><span className={styles.rowText}><strong>{dmPerson(c)?.name || "Private message"}</strong><small>Participants only</small></span><Badge count={c.unread} /></button>)}</details>}
        </div>
      </section>
      <section className={styles.directory} aria-label="Channels and people">
        {org ? <><header className={styles.panelHeader}><button className={styles.back} aria-label="Back to organizations" onClick={back}><ArrowLeft /></button><OrganizationBadge name={org.name} iconUrl={org.iconUrl} hidden={org.hideIcon} className={styles.orgIcon} /><div className={styles.rowText}><h2>{org.name}</h2><small>{members.length} team {members.length === 1 ? "member" : "members"}</small></div></header><div className={styles.scroll}>{rooms.map(roomRow)}{!rooms.length && <p className={styles.empty}>Organization chat is not enabled for your account.</p>}<h3 className={styles.sectionLabel}>Team members</h3>{members.map(p => <button key={p.user_id} className={styles.row} disabled={busy || !data.canDm || !p.can_dm || p.user_id === data.me} onClick={() => void dm(p)}><span className={styles.avatar}>{initials(p.name)}</span><span className={styles.rowText}><strong>{p.name}{p.user_id === data.me ? " (you)" : ""}</strong><small>{p.role === "admin" ? "Administrator" : p.role === "sales_manager" ? "Management" : p.role === "fni" ? "F&I" : "Consultant"}</small></span>{p.user_id !== data.me && p.can_dm && <ChevronRight size={16} />}</button>)}{!members.length && <p className={styles.empty}>No members with Messenger access yet.</p>}</div></> : <div className={styles.empty}><Users size={32} /><h2>Your team, connected.</h2><p>Select an organization to see its channels and people.</p></div>}
      </section>
      <section className={styles.conversation} aria-label="Conversation">
        {active ? <><header className={styles.panelHeader}><button className={styles.back} aria-label="Back to team" onClick={back}><ArrowLeft /></button>{active.kind === "dm" ? <span className={styles.avatar}>{initials(title || "DM")}</span> : active.channel === "management" ? <ShieldCheck className={styles.red} /> : <Users className={styles.red} />}<div className={styles.rowText}><h2>{title}</h2><small>{active.kind === "dm" ? "Private · participants only" : org?.name}</small></div></header>
          <div ref={list} className={styles.messages} onScroll={() => { if (list.current) nearBottom.current = list.current.scrollHeight - list.current.scrollTop - list.current.clientHeight < 100; }}>
            {hasMore && <button className={styles.older} disabled={loadingHistory} onClick={() => void older()}>Load earlier messages</button>}
            {loadingHistory && <p className={styles.notice} role="status">Loading messages…</p>}
            {!loadingHistory && !messages.length && <div className={styles.empty}><MessageCircle size={32} /><h3>Start the conversation</h3><p>Your messages will be saved here.</p></div>}
            {messages.map(m => <article key={m.id} className={`${styles.message} ${m.sender_id === data.me ? styles.mine : ""}`}><div className={styles.bubble}><strong>{m.senderName || person(m.sender_id)?.name || "Team member"}</strong><p>{m.body}</p><time dateTime={m.created_at} title={new Date(m.created_at).toLocaleString()}>{new Date(m.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })} · {new Date(m.created_at).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}{m.edited_at ? " · edited" : ""}</time>{m.sender_id === data.me && <div className={styles.messageActions}><button aria-label={`Edit message ${m.id}`} disabled={busy} onClick={() => { setEditing(m); setEditText(m.body); }}>Edit</button><span aria-hidden="true">|</span><button aria-label={`Delete message ${m.id}`} disabled={busy} onClick={() => setDeleting(m.id)}>Delete</button></div>}{deleting === m.id && <div className={styles.confirm}><span>Delete this message?</span><button disabled={busy} onClick={() => void changeMessage("delete", m.id)}>Delete</button><button onClick={() => setDeleting(null)}>Cancel</button></div>}</div></article>)}
          </div>
          {editing ? <form className={styles.composer} onSubmit={e => { e.preventDefault(); void changeMessage("edit", editing.id); }}><textarea aria-label="Edit message" value={editText} onChange={e => setEditText(e.target.value)} maxLength={4000} rows={2} /><button disabled={busy || !editText.trim()} aria-label="Save edit"><Send size={19} /></button><button type="button" aria-label="Cancel edit" onClick={() => setEditing(null)}><X size={19} /></button></form> : <form className={styles.composer} onSubmit={send}><textarea aria-label="Message" placeholder="Type a message…" value={drafts[activeId!] || ""} onChange={e => setDrafts(d => ({ ...d, [activeId!]: e.target.value }))} maxLength={4000} rows={1} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing && window.matchMedia("(min-width: 768px)").matches) { e.preventDefault(); e.currentTarget.form?.requestSubmit(); } }} /><button disabled={busy || !drafts[activeId!]?.trim()} aria-label={busy ? "Sending message" : "Send message"}><Send size={19} /></button></form>}
        </> : <div className={styles.empty}><MessageCircle size={40} /><h2>A place for every conversation.</h2><p>Choose a channel or send a private message to your team.</p></div>}
      </section>
    </div>}
  </div>;
}
