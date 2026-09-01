"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";

import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

import styles from "./messenger-workspace.module.css";

type Participant = { user_id: string; last_read_at: string };
type Conversation = {
  id: string;
  kind: "organization" | "dm";
  title?: string;
  updated_at: string;
  messenger_participants?: Participant[];
};
type Message = {
  id: string | number;
  conversation_id: string;
  sender_id: string;
  body: string;
  created_at: string;
  deleted_at?: string | null;
  profiles?: { display_name?: string };
};
type Person = { user_id: string; profiles?: { display_name?: string } };
type MessengerPayload = {
  membership?: {
    organization_id: string;
    chat_enabled: boolean;
    can_dm: boolean;
    can_org_chat: boolean;
    organizations?: { name: string };
  };
  conversations?: Conversation[];
  people?: Person[];
  messages?: Message[];
  me?: string;
};

async function call(path: string, init?: RequestInit) {
  let token = "local-dev-token";
  try {
    const { data } = await getSupabaseBrowserClient().auth.getSession();
    if (data.session?.access_token) token = data.session.access_token;
  } catch {
    // Local auth bypass uses the server fallback.
  }
  const response = await fetch(path, {
    ...init,
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      ...init?.headers,
    },
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Messenger request failed.");
  return result;
}

function formatTime(value: string) {
  return new Date(value).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export function MessengerWorkspace() {
  const [data, setData] = useState<MessengerPayload | null>(null);
  const [teamDraft, setTeamDraft] = useState("");
  const [dmDrafts, setDmDrafts] = useState<Record<string, string>>({});
  const [openDmIds, setOpenDmIds] = useState<string[]>([]);
  const [collapsedDmIds, setCollapsedDmIds] = useState<string[]>([]);
  const [sendingId, setSendingId] = useState("");
  const [error, setError] = useState("");
  const teamEndRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      setData(await call("/api/messenger"));
      setError("");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load Messenger.");
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 4000);
    return () => window.clearInterval(timer);
  }, [load]);

  const teamConversation = data?.conversations?.find((conversation) => conversation.kind === "organization");
  const teamMessages = (data?.messages ?? []).filter((message) => message.conversation_id === teamConversation?.id && !message.deleted_at);
  const dmConversations = (data?.conversations ?? []).filter((conversation) => conversation.kind === "dm");

  useEffect(() => {
    teamEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [teamMessages.length]);

  function personName(userId: string) {
    return data?.people?.find((person) => person.user_id === userId)?.profiles?.display_name || "Team Member";
  }

  function dmName(conversation: Conversation) {
    const otherId = conversation.messenger_participants?.find((participant) => participant.user_id !== data?.me)?.user_id;
    return otherId ? personName(otherId) : "Direct Message";
  }

  function dmForPerson(userId: string) {
    return dmConversations.find((conversation) =>
      conversation.messenger_participants?.some((participant) => participant.user_id === userId)
    );
  }

  function unreadCount(conversation: Conversation | undefined) {
    if (!conversation) return 0;
    const lastRead = conversation.messenger_participants?.find((participant) => participant.user_id === data?.me)?.last_read_at;
    const threshold = lastRead ? new Date(lastRead).getTime() : 0;
    return (data?.messages ?? []).filter((message) =>
      message.conversation_id === conversation.id
      && message.sender_id !== data?.me
      && !message.deleted_at
      && new Date(message.created_at).getTime() > threshold
    ).length;
  }

  function markRead(conversationId: string) {
    void call("/api/messenger", {
      method: "POST",
      body: JSON.stringify({ action: "mark-read", conversationId }),
    }).then(load).catch(() => {});
  }

  function openDm(conversationId: string) {
    setOpenDmIds((current) => current.includes(conversationId) ? current : [...current, conversationId]);
    setCollapsedDmIds((current) => current.filter((id) => id !== conversationId));
    markRead(conversationId);
  }

  async function send(conversationId: string, body: string, clear: () => void) {
    const message = body.trim();
    if (!message || sendingId) return;
    setSendingId(conversationId);
    try {
      await call("/api/messenger", {
        method: "POST",
        body: JSON.stringify({ action: "send", conversationId, body: message }),
      });
      clear();
      await load();
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "Could not send message.");
    } finally {
      setSendingId("");
    }
  }

  async function startDm(userId: string) {
    try {
      const result = await call("/api/messenger", {
        method: "POST",
        body: JSON.stringify({ action: "start-dm", userId }),
      });
      const conversationId = String(result.conversationId);
      openDm(conversationId);
      await load();
    } catch (startError) {
      setError(startError instanceof Error ? startError.message : "Could not open direct message.");
    }
  }

  function openPersonDm(userId: string) {
    const existing = dmForPerson(userId);
    if (existing) {
      openDm(existing.id);
      return;
    }
    void startDm(userId);
  }

  async function deleteMessage(messageId: string | number) {
    if (!window.confirm("Delete this message?")) return;
    try {
      await call("/api/messenger", {
        method: "POST",
        body: JSON.stringify({ action: "delete", messageId }),
      });
      await load();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Could not delete message.");
    }
  }

  function renderMessages(messages: Message[], compact = false) {
    if (messages.length === 0) return <p className={styles.empty}>No messages yet.</p>;
    return messages.map((message) => {
      const mine = message.sender_id === data?.me;
      return (
        <article key={message.id} className={`${styles.message} ${mine ? styles.mine : ""}`}>
          {!mine && <p className={styles.sender}>{message.profiles?.display_name || "Team Member"}</p>}
          <div className={styles.messageLine}>
            <p className={`${styles.bubble} ${compact ? styles.compactBubble : ""}`}>{message.body}</p>
            {mine && <button type="button" className={styles.deleteButton} onClick={() => void deleteMessage(message.id)} aria-label="Delete message">×</button>}
          </div>
          <time className={styles.time}>{formatTime(message.created_at)}</time>
        </article>
      );
    });
  }

  if (!data) return <div className={styles.loading}>{error || "Loading NXTDox Messenger..."}</div>;
  if (!data.membership?.chat_enabled) return <div className={styles.loading}>Messenger access is not enabled for this account.</div>;

  const organizationName = data.membership.organizations?.name || "Walker Automotive";

  return (
    <div className={styles.workspace}>
      <header className={styles.workspaceHeader}>
        <div>
          <p className={styles.eyebrow}>{organizationName}</p>
          <h1>Team Messenger</h1>
        </div>
        <span className={styles.online}>Online</span>
      </header>

      {error && <div className={styles.error}>{error}<button type="button" onClick={() => setError("")} aria-label="Dismiss error">×</button></div>}

      <div className={styles.workspaceBody}>
        <aside className={styles.peoplePanel}>
          <div className={styles.panelHeading}>
            <p>People</p>
            <span>{Math.max(0, (data.people?.length ?? 0) - 1)}</span>
          </div>
          <div className={styles.peopleList}>
            {(data.people ?? []).filter((person) => person.user_id !== data.me).map((person) => (
              <button key={person.user_id} type="button" className={styles.person} onClick={() => openPersonDm(person.user_id)} disabled={!data.membership?.can_dm}>
                <span className={styles.avatar}>{personName(person.user_id).charAt(0)}</span>
                <span>{personName(person.user_id)}</span>
                <span className={styles.openDm}>Message</span>
              </button>
            ))}
          </div>
        </aside>

        <section className={styles.teamRoom}>
          <header className={styles.roomHeader}>
            <div className={styles.roomMark}>#</div>
            <div><h2>{teamConversation?.title || "Team Chat"}</h2><p>Everyone at {organizationName}</p></div>
          </header>
          <div className={styles.teamMessages}>{renderMessages(teamMessages)}<div ref={teamEndRef} /></div>
          <form className={styles.composer} onSubmit={(event: FormEvent) => { event.preventDefault(); if (teamConversation) void send(teamConversation.id, teamDraft, () => setTeamDraft("")); }}>
            <input value={teamDraft} onChange={(event) => setTeamDraft(event.target.value)} placeholder="Message the team..." maxLength={4000} disabled={!teamConversation || !data.membership?.can_org_chat} />
            <button type="submit" disabled={!teamConversation || !teamDraft.trim() || sendingId === teamConversation.id} aria-label="Send team message">➤</button>
          </form>
        </section>
      </div>

      <div className={styles.dmDock} aria-label="Open direct messages">
        {openDmIds.map((conversationId) => {
          const conversation = dmConversations.find((item) => item.id === conversationId);
          if (!conversation) return null;
          const collapsed = collapsedDmIds.includes(conversationId);
          const messages = (data.messages ?? []).filter((message) => message.conversation_id === conversationId && !message.deleted_at);
          const name = dmName(conversation);
          return (
            <section key={conversationId} className={`${styles.dmWindow} ${collapsed ? styles.dmCollapsed : ""}`}>
              <header className={styles.dmHeader}>
                <button type="button" className={styles.dmTitle} onClick={() => {
                  setCollapsedDmIds((current) => current.includes(conversationId) ? current.filter((id) => id !== conversationId) : [...current, conversationId]);
                  if (collapsed) markRead(conversationId);
                }} aria-expanded={!collapsed}>
                  <span className={styles.dmStatus} /><span>{name}</span>
                </button>
                <button type="button" className={styles.dmClose} onClick={() => setOpenDmIds((current) => current.filter((id) => id !== conversationId))} aria-label={`Close chat with ${name}`}>×</button>
              </header>
              {!collapsed && <>
                <div className={styles.dmMessages}>{renderMessages(messages, true)}</div>
                <form className={styles.dmComposer} onSubmit={(event) => { event.preventDefault(); void send(conversationId, dmDrafts[conversationId] || "", () => setDmDrafts((current) => ({ ...current, [conversationId]: "" }))); }}>
                  <input value={dmDrafts[conversationId] || ""} onChange={(event) => setDmDrafts((current) => ({ ...current, [conversationId]: event.target.value }))} placeholder={`Message ${name}...`} maxLength={4000} />
                  <button type="submit" disabled={!dmDrafts[conversationId]?.trim() || sendingId === conversationId} aria-label={`Send message to ${name}`}>➤</button>
                </form>
              </>}
            </section>
          );
        })}
      </div>

      {data.membership.can_dm && <nav className={styles.dmTray} aria-label="Personal direct messages">
        {(data.people ?? []).filter((person) => person.user_id !== data.me).map((person) => {
          const conversation = dmForPerson(person.user_id);
          const unread = unreadCount(conversation);
          const name = personName(person.user_id);
          const open = Boolean(conversation && openDmIds.includes(conversation.id));
          return (
            <button
              key={person.user_id}
              type="button"
              className={`${styles.dmTab} ${open ? styles.dmTabOpen : ""} ${unread > 0 ? styles.dmTabUnread : ""}`}
              onClick={() => openPersonDm(person.user_id)}
              aria-label={`${name}${unread ? `, ${unread} unread messages` : ""}`}
            >
              <span className={styles.dmStatus} />
              <span className={styles.dmTabName}>{name}</span>
              {unread > 0 && <span className={styles.unreadCount}>{unread}</span>}
            </button>
          );
        })}
      </nav>}
    </div>
  );
}