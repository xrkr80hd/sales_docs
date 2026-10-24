"use client";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowLeft, ChevronDown, ChevronRight, MessageCircle, Search, Send, ShieldCheck, Users, Plus, X, RefreshCw } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import {useWorkspaceIdentity} from "@/components/command-center/workspace-context";
import {readMessengerCache,cacheMessengerDirectory,cacheMessengerMessages,clearMessengerCache} from "@/lib/messenger-cache";
import { OrganizationBadge } from "@/components/command-center/organization-badge";
import { useSession } from "@/components/auth/supabase-session-gate";
import { MessageBubble } from "./message-bubble";
import { useMessengerUnread } from "./unread-context";
import { messengerRequest } from "@/lib/messenger-request";
import {cachedResource,loadResource,primeResource,invalidateResource} from "@/lib/client-resource-cache";
import {moderateChatText} from "@/lib/chat-moderation";
import styles from "./organization-messenger.module.css";

type Organization = { id: string; name: string; iconUrl: string; hideIcon: boolean };
type Person = { user_id: string; organization_id?: string; name: string; role: string; can_dm: boolean };
type Conversation = { id: string; kind: string; channel: string | null; title: string; organization_id: string; unread: number; messenger_participants: { user_id: string; last_read_at: string }[] };
export type Message = { id: number; sender_id: string; senderName?: string; body: string; created_at: string; edited_at?: string };
export type Payload = { me: string; canCreateOrganization: boolean; canDm: boolean; organizations: Organization[]; people: Person[]; conversations: Conversation[] };
function initials(name: string) { return name.split(/\s+/).slice(0, 2).map(w => w[0]).join("").toUpperCase(); }
function Badge({ count }: { count: number }) { return count > 0 ? <span className={styles.badge} aria-label={`${count} unread`}>{count > 99 ? "99+" : count}</span> : null; }
export function OrganizationMessenger() {
  const { accessToken } = useSession();
  const identity=useWorkspaceIdentity();
  const cacheScope=identity?`${identity.id}:${identity.organizationId||""}:${identity.role}:${identity.workspaceRole||""}`:"";
  const historyRevision=useRef(0);
  const {counts:unreadCounts,markRead}=useMessengerUnread();
  const unreadRef=useRef(unreadCounts);unreadRef.current=unreadCounts;
  const request = useCallback((path?: string, body?: object) => messengerRequest(accessToken, path, body), [accessToken]);
  const tokenRef=useRef(accessToken);tokenRef.current=accessToken;
  const loadingDirectory = useRef(false);
  const lastRead = useRef(new Map<string, number>());
  const historyRequests = useRef(new Map<string, number>());
  const [historyError, setHistoryError] = useState("");
  const [data, setData] = useState<Payload | null>(()=>accessToken?cachedResource<Payload>(accessToken,"messenger-directory")||readMessengerCache(cacheScope)?.directory||null:null), [error, setError] = useState("");
  const [orgId, setOrgId] = useState<string | null>(null), [activeId, setActiveId] = useState<string | null>(null);
  const [screen, setScreen] = useState("organizations"), [search, setSearch] = useState("");
  const [messages, setMessages] = useState<Message[]>([]), [hasMore, setHasMore] = useState(false), [loadingHistory, setLoadingHistory] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, string>>({}), [busy, setBusy] = useState(false), [connection, setConnection] = useState("Connecting…");
  const [creating, setCreating] = useState(false), [orgName, setOrgName] = useState("");
  const [editing, setEditing] = useState<Message | null>(null), [editText, setEditText] = useState("");
  const [actionsId, setActionsId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState<number | null>(null);
  const shell = useRef<HTMLDivElement>(null), list = useRef<HTMLDivElement>(null), activeRef = useRef(activeId), sequence = useRef(0), nearBottom = useRef(true);
  activeRef.current = activeId;
  const report = (e: unknown) => setError(e instanceof Error ? e.message : "Please try again.");
  const load = useCallback(async () => {
    if (loadingDirectory.current) return;
    loadingDirectory.current = true;
    try {
      const payload: Payload = await loadResource(accessToken||"","messenger-directory",()=>request(),300000); if(tokenRef.current!==accessToken)return;cacheMessengerDirectory(cacheScope,payload);setData({ ...payload, conversations: payload.conversations.map(c => ({ ...c, unread: unreadRef.current[c.id] || 0 })) }); setError("");
      if (activeRef.current && !payload.conversations.some(c => c.id === activeRef.current)) { setActiveId(null); setMessages([]); setScreen("organizations"); }
    } catch (e) { if(e instanceof Error&&"status" in e&&[401,403].includes(Number(e.status))){clearMessengerCache(cacheScope);setData(null);setMessages([]);}report(e); } finally { loadingDirectory.current = false; }
  }, [request,accessToken,cacheScope]);
  useEffect(()=>{setData(previous=>previous?{...previous,conversations:previous.conversations.map(c=>({...c,unread:unreadCounts[c.id]||0}))}:previous);},[unreadCounts]);
  const refreshHistory = useCallback(async (id: string, initial = false, force = false) => {
    if (!force && historyRequests.current.has(id)) return;
    const ticket = ++sequence.current;
    const revision=historyRevision.current;
    historyRequests.current.set(id, ticket);
    if (initial) setLoadingHistory(!cachedResource<Message[]>(accessToken||"",`messenger-history:${id}`));
    try {
      const page: { messages: Message[]; hasMore: boolean } = await request(`/api/messenger?conversationId=${id}`);
      if (activeRef.current !== id || ticket !== sequence.current || revision!==historyRevision.current) return;
      setMessages(previous => {
        const next=initial?page.messages:[...previous.filter(m=>page.messages.length>0&&m.id<page.messages[0].id),...page.messages];
        primeResource(accessToken||"",`messenger-history:${id}`,next,300000);cacheMessengerMessages(cacheScope,id,next);return next;
      });
      if (initial) setHasMore(page.hasMore);
      setHistoryError("");
      setLoadingHistory(false);
      const latest = page.messages.at(-1);
      if (latest && lastRead.current.get(id) !== latest.id && document.visibilityState === "visible") {
        await request(undefined, { action: "mark-read", conversationId: id, messageId: latest.id });
        lastRead.current.set(id, latest.id);
        markRead(id);
        if (activeRef.current === id) setData(previous => previous ? { ...previous, conversations: previous.conversations.map(c => c.id === id ? { ...c, unread: 0 } : c) } : previous);
      }
    } catch (e) { if(e instanceof Error&&"status" in e&&[401,403].includes(Number(e.status))){clearMessengerCache(cacheScope);invalidateResource(accessToken||"",`messenger-history:${id}`);setMessages([]);}if (activeRef.current === id && ticket === sequence.current) setHistoryError(e instanceof Error ? e.message : "Could not load messages."); }
    finally { if (historyRequests.current.get(id) === ticket) historyRequests.current.delete(id); if (activeRef.current === id && ticket === sequence.current) setLoadingHistory(false); }
  }, [request,markRead,accessToken,cacheScope]);
  useEffect(() => {
    void load();
    // Refresh directory on focus, rather than polling every organization/person.
    const refresh = () => { if (document.visibilityState === "visible" && activeRef.current) void refreshHistory(activeRef.current); };
    const focus = () => { if (document.visibilityState === "visible") { void load(); refresh(); } };
    window.addEventListener("focus", focus); document.addEventListener("visibilitychange", focus);
    return () => { window.removeEventListener("focus", focus); document.removeEventListener("visibilitychange", focus); };
  }, [load, refreshHistory]);
  useEffect(() => {
    if (!activeId) { setConnection("Ready"); return; }
    // Subscribe only to the open room; don't reload every directory on any message.
    const client = getSupabaseBrowserClient();
    let live=false;
    const refresh = () => { if (document.visibilityState === "visible") void refreshHistory(activeId); };
    const channel = client.channel(`messenger-${activeId}`).on("postgres_changes", { event: "*", schema: "public", table: "messenger_messages", filter: `conversation_id=eq.${activeId}` }, payload=>{
      if(activeRef.current!==activeId||tokenRef.current!==accessToken)return;
      historyRevision.current++;
      const row=payload.new as Record<string,unknown>,old=payload.old as Record<string,unknown>;
      const id=Number(row.id||old.id);if(!Number.isSafeInteger(id))return;
      if(payload.eventType==='DELETE'||row.deleted_at){
        setMessages(previous=>{const next=previous.filter(message=>message.id!==id);primeResource(accessToken||"",`messenger-history:${activeId}`,next,300000);cacheMessengerMessages(cacheScope,activeId,next);return next;});return;
      }
      if(row.conversation_id!==activeId||typeof row.body!=='string'||typeof row.sender_id!=='string'||typeof row.created_at!=='string')return;
      const message:Message={id,sender_id:row.sender_id,body:moderateChatText(row.body),created_at:row.created_at,edited_at:typeof row.edited_at==='string'?row.edited_at:undefined};
      setMessages(previous=>{const existing=previous.find(m=>m.id===id);const next=[...previous.filter(m=>m.id!==id),{...message,senderName:existing?.senderName}].sort((a,b)=>a.id-b.id);primeResource(accessToken||"",`messenger-history:${activeId}`,next,300000);cacheMessengerMessages(cacheScope,activeId,next);return next;});
      if(document.visibilityState==='visible'&&lastRead.current.get(activeId)!==id){
        lastRead.current.set(activeId,id);
        void request(undefined,{action:'mark-read',conversationId:activeId,messageId:id}).then(()=>markRead(activeId)).catch(()=>lastRead.current.delete(activeId));
      }
    }).subscribe(status=>{live=status==='SUBSCRIBED';setConnection(live?'Live':'Reconnecting…');if(live)refresh();});
    // REST is a fallback while realtime is disconnected, not a second live transport.
    const timer = window.setInterval(()=>{if(!live)refresh();},30000);
    return () => { clearInterval(timer); void client.removeChannel(channel); };
  }, [activeId, refreshHistory,accessToken,request,markRead,cacheScope]);
  useEffect(() => {
    const cached=activeId&&accessToken?cachedResource<Message[]>(accessToken,`messenger-history:${activeId}`)||readMessengerCache(cacheScope)?.rooms[activeId]:undefined;
    setMessages(cached||[]); setHasMore(false); setEditing(null); setDeleting(null); setActionsId(null); setHistoryError(""); nearBottom.current = true;
    if (activeId) void refreshHistory(activeId, true);
  }, [activeId, refreshHistory,accessToken,cacheScope]);
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
    invalidateResource(accessToken||"","messenger-directory");
    setBusy(true);
    try { const result = await request(undefined, { action: "start-dm", userId: p.user_id }); setData(previous => previous ? { ...previous, conversations: previous.conversations.some(c => c.id === result.conversationId) ? previous.conversations : [...previous.conversations, { id: result.conversationId, kind: "dm", channel: null, title: "", organization_id: orgId || "", unread: 0, messenger_participants: [{ user_id: previous.me, last_read_at: "" }, { user_id: p.user_id, last_read_at: "" }] }] } : previous); open(result.conversationId); } catch (e) { report(e); } finally { setBusy(false); }
  }
  async function send(event: FormEvent) {
    event.preventDefault(); if (!activeId || busy) return;
    const id = activeId, text = drafts[id]?.trim(); if (!text) return;
    setBusy(true); setError("");
    try { const result = await request(undefined, { action: "send", conversationId: id, body: text }); setDrafts(d => ({ ...d, [id]: d[id]?.trim() === text ? "" : d[id] })); nearBottom.current = true; if(result.message)historyRevision.current++;if (activeRef.current === id && result.message) setMessages(previous => {const next=[...previous.filter(m=>m.id!==result.message.id),result.message].sort((a,b)=>a.id-b.id);primeResource(accessToken||"",`messenger-history:${id}`,next,300000);cacheMessengerMessages(cacheScope,id,next);return next;}); } catch (e) { report(e); } finally { setBusy(false); }
  }
  async function older() {
    if (!activeId || !messages[0] || loadingHistory) return;
    const id = activeId; setLoadingHistory(true);
    const height = list.current?.scrollHeight || 0;
    try { const page = await request(`/api/messenger?conversationId=${id}&before=${messages[0].id}`); if (activeRef.current !== id) return; nearBottom.current = false; setMessages(previous => [...page.messages, ...previous]); setHasMore(page.hasMore); requestAnimationFrame(() => { if (list.current) list.current.scrollTop += list.current.scrollHeight - height; }); } catch (e) { report(e); } finally { if (activeRef.current === id) setLoadingHistory(false); }
  }
  async function changeMessage(action: "edit" | "delete", messageId: number) {
    setBusy(true);
    try { await request(undefined, { action, messageId, body: editText }); setEditing(null); setDeleting(null); setActionsId(null); if (activeId) await refreshHistory(activeId, true); } catch (e) { report(e); } finally { setBusy(false); }
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
          {historyError && <div className={styles.error} role="alert"><span>{historyError}</span><button aria-label="Retry messages" onClick={() => void refreshHistory(active.id, true)}><RefreshCw size={18} /></button></div>}
          <div ref={list} className={styles.messages} onScroll={() => { if (list.current) nearBottom.current = list.current.scrollHeight - list.current.scrollTop - list.current.clientHeight < 100; }}>
            {hasMore && <button className={styles.older} disabled={loadingHistory} onClick={() => void older()}>Load earlier messages</button>}
            {loadingHistory && <p className={styles.notice} role="status">Loading messages…</p>}
            {!loadingHistory && !historyError && !messages.length && <div className={styles.empty}><MessageCircle size={32} /><h3>Start the conversation</h3><p>Your messages will be saved here.</p></div>}
            {messages.map(m => <MessageBubble key={m.id} message={m} own={m.sender_id === data.me} senderName={m.senderName || person(m.sender_id)?.name || "Team member"} expanded={actionsId === m.id} confirmingDelete={deleting === m.id} busy={busy} onToggle={() => { setActionsId(current => current === m.id ? null : m.id); setDeleting(null); }} onEdit={() => { setEditing(m); setEditText(m.body); setActionsId(null); }} onDelete={() => setDeleting(m.id)} onConfirmDelete={() => void changeMessage("delete", m.id)} onCancelDelete={() => setDeleting(null)} />)}
          </div>
          {editing ? <form className={styles.composer} onSubmit={e => { e.preventDefault(); void changeMessage("edit", editing.id); }}><textarea aria-label="Edit message" value={editText} onChange={e => setEditText(e.target.value)} maxLength={4000} rows={2} /><button disabled={busy || !editText.trim()} aria-label="Save edit"><Send size={19} /></button><button type="button" aria-label="Cancel edit" onClick={() => setEditing(null)}><X size={19} /></button></form> : <form className={styles.composer} onSubmit={send}><textarea aria-label="Message" placeholder="Type a message…" value={drafts[activeId!] || ""} onChange={e => setDrafts(d => ({ ...d, [activeId!]: e.target.value }))} maxLength={4000} rows={1} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing && window.matchMedia("(min-width: 768px)").matches) { e.preventDefault(); e.currentTarget.form?.requestSubmit(); } }} /><button disabled={busy || !drafts[activeId!]?.trim()} aria-label={busy ? "Sending message" : "Send message"}><Send size={19} /></button></form>}
        </> : <div className={styles.empty}><MessageCircle size={40} /><h2>A place for every conversation.</h2><p>Choose a channel or send a private message to your team.</p></div>}
      </section>
    </div>}
  </div>;
}
