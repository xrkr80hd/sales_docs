"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import styles from "./messenger-screen.module.css";

type Participant = {
  user_id: string;
  last_read_at: string;
};

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
  edited_at?: string | null;
  deleted_at?: string | null;
  profiles?: {
    display_name?: string;
  };
};

type MessengerPayload = {
  membership?: {
    organization_id: string;
    chat_enabled: boolean;
    can_dm: boolean;
    can_org_chat: boolean;
    organizations?: { name: string };
  };
  conversations?: Conversation[];
  people?: Array<{ user_id: string; profiles?: { display_name?: string } }>;
  messages?: Message[];
  me?: string;
};

async function call(path: string, init?: RequestInit) {
  let token = "local-dev-token";
  try {
    const { data } = await getSupabaseBrowserClient().auth.getSession();
    if (data?.session?.access_token) token = data.session.access_token;
  } catch {
    // offline or local dev
  }
  const res = await fetch(path, {
    ...init,
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      ...init?.headers,
    },
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "Request failed");
  return json;
}

function formatTime(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  } catch {
    return "";
  }
}

export function MessengerScreen() {
  const [data, setData] = useState<MessengerPayload | null>(null);
  const [selected, setSelected] = useState("");
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const d: MessengerPayload = await call("/api/messenger");
      setData(d);
      setSelected((curr) => curr || d.conversations?.[0]?.id || "");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load messenger");
    }
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(load, 4000);
    return () => clearInterval(timer);
  }, [load]);

  // Active conversation
  const activeConvo = useMemo(
    () => data?.conversations?.find((c) => c.id === selected),
    [data, selected]
  );

  // Filter messages for active conversation and not deleted
  const messages = useMemo(
    () => (data?.messages ?? []).filter((m) => m.conversation_id === selected && !m.deleted_at),
    [data, selected]
  );

  // Auto-scroll on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  // Mark active conversation as read
  useEffect(() => {
    if (!selected) return;
    call("/api/messenger", {
      method: "POST",
      body: JSON.stringify({ action: "mark-read", conversationId: selected }),
    }).catch(() => {});
  }, [selected, messages.length]);

  // Send message
  async function handleSend(e: FormEvent) {
    e.preventDefault();
    const msg = text.trim();
    if (!msg || !selected || sending) return;
    setSending(true);
    try {
      await call("/api/messenger", {
        method: "POST",
        body: JSON.stringify({ action: "send", conversationId: selected, body: msg }),
      });
      setText("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not send message");
    } finally {
      setSending(false);
    }
  }

  // Delete message (soft delete)
  async function handleDeleteMessage(msgId: string | number) {
    if (!window.confirm("Unsend / Delete this message?")) return;
    try {
      await call("/api/messenger", {
        method: "POST",
        body: JSON.stringify({ action: "delete", messageId: msgId }),
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete message");
    }
  }

  // Start direct message
  async function startDm(userId: string) {
    try {
      const res = await call("/api/messenger", {
        method: "POST",
        body: JSON.stringify({ action: "start-dm", userId }),
      });
      setSelected(res.conversationId);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start direct message");
    }
  }

  // Calculate read receipt status for a message
  const isMessageReadByOthers = (msg: Message) => {
    if (!activeConvo?.messenger_participants) return false;
    const msgTime = new Date(msg.created_at).getTime();
    return activeConvo.messenger_participants.some(
      (p) => p.user_id !== data?.me && new Date(p.last_read_at).getTime() >= msgTime
    );
  };

  if (!data) {
    return (
      <div className={styles.container} style={{ padding: "40px", textAlign: "center" }}>
        <p style={{ color: "#888" }}>Loading NXTDox Messenger…</p>
      </div>
    );
  }

  if (!data.membership?.chat_enabled) {
    return (
      <div className={styles.container} style={{ padding: "40px" }}>
        <h1 className={styles.title}>NXTDox Messenger</h1>
        <p style={{ color: "#888", marginTop: "12px" }}>
          Your administrator has not enabled messenger access for your account.
        </p>
      </div>
    );
  }

  const orgName = data.membership?.organizations?.name || "Walker Automotive";

  return (
    <div className={styles.container}>
      {/* Top Header */}
      <header className={styles.topBar}>
        <div>
          <p className={styles.orgBadge}>{orgName}</p>
          <h1 className={styles.title}>NXTDox Messenger</h1>
        </div>
        <div className={styles.statusIndicator}>
          <span className={styles.statusDot} />
          <span>Active</span>
        </div>
      </header>

      {/* Error Alert */}
      {error && (
        <div className={styles.errorBanner}>
          <span>{error}</span>
          <button
            type="button"
            onClick={() => setError("")}
            style={{ background: "none", border: "none", color: "#fff", cursor: "pointer" }}
          >
            ×
          </button>
        </div>
      )}

      <div className={styles.mainLayout}>
        {/* Sidebar */}
        <aside className={styles.sidebar}>
          <div className={styles.sidebarHeader}>Chats</div>
          <div className={styles.convoList}>
            {(data.conversations ?? []).map((convo) => {
              const isActive = selected === convo.id;
              const title = convo.kind === "organization" ? convo.title || "Team Chat" : "Direct Message";
              const initial = title.charAt(0).toUpperCase();

              return (
                <button
                  key={convo.id}
                  type="button"
                  onClick={() => setSelected(convo.id)}
                  className={`${styles.convoCard} ${isActive ? styles.convoCardActive : ""}`}
                >
                  <div className={styles.convoAvatar}>{initial}</div>
                  <div className={styles.convoInfo}>
                    <p className={styles.convoName}>{title}</p>
                    <p className={styles.convoPreview}>
                      {convo.kind === "organization" ? "Company Channel" : "Private Chat"}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>

          {/* New Direct Message Accordion */}
          {data.membership?.can_dm && (
            <details className={styles.dmAccordion}>
              <summary>+ New Direct Message</summary>
              <div className={styles.dmMemberList}>
                {(data.people ?? [])
                  .filter((p) => p.user_id !== data.me)
                  .map((p) => (
                    <button
                      key={p.user_id}
                      type="button"
                      onClick={() => startDm(p.user_id)}
                      className={styles.dmMemberBtn}
                    >
                      <span>💬</span>
                      <span>{p.profiles?.display_name || "Team Member"}</span>
                    </button>
                  ))}
              </div>
            </details>
          )}
        </aside>

        {/* Chat Window */}
        <section className={styles.chatWindow}>
          {/* Header */}
          <div className={styles.chatHeader}>
            <div className={styles.chatHeaderInfo}>
              <div className={styles.chatHeaderAvatar}>
                {activeConvo?.kind === "organization" ? "🏢" : "👤"}
              </div>
              <div>
                <h2 className={styles.chatHeaderTitle}>
                  {activeConvo?.kind === "organization" ? activeConvo.title || "Team Chat" : "Direct Message"}
                </h2>
                <p className={styles.chatHeaderSubtitle}>
                  {activeConvo?.kind === "organization" ? "Walker Automotive Public Channel" : "Encrypted Direct Chat"}
                </p>
              </div>
            </div>
          </div>

          {/* Messages Feed */}
          <div className={styles.messagesList}>
            {messages.length === 0 ? (
              <div className={styles.emptyState}>
                <p>No messages in this chat yet.</p>
                <p style={{ fontSize: "0.78rem" }}>Say hello to kick things off!</p>
              </div>
            ) : (
              messages.map((m) => {
                const isSelf = m.sender_id === data.me;
                const isRead = isMessageReadByOthers(m);

                return (
                  <div
                    key={m.id}
                    className={`${styles.messageRow} ${isSelf ? styles.messageRowSelf : styles.messageRowOther}`}
                  >
                    {!isSelf && (
                      <span className={styles.senderName}>
                        {m.profiles?.display_name || "NXTDox Member"}
                      </span>
                    )}

                    <div className={styles.bubbleContainer}>
                      {isSelf && (
                        <button
                          type="button"
                          className={styles.deleteBtn}
                          title="Unsend / Delete Message"
                          onClick={() => handleDeleteMessage(m.id)}
                        >
                          🗑
                        </button>
                      )}

                      <div className={`${styles.bubble} ${isSelf ? styles.bubbleSelf : styles.bubbleOther}`}>
                        {m.body}
                      </div>

                      {!isSelf && data.me === "local-xrkr80hd" && (
                        /* Admin unsend power */
                        <button
                          type="button"
                          className={styles.deleteBtn}
                          title="Admin Delete"
                          onClick={() => handleDeleteMessage(m.id)}
                        >
                          🗑
                        </button>
                      )}
                    </div>

                    {/* Metadata: Timestamp & Read Receipt */}
                    <div className={styles.metaRow}>
                      <span>{formatTime(m.created_at)}</span>
                      {isSelf && (
                        <span className={isRead ? styles.receiptIcon : styles.receiptUnread} title={isRead ? "Seen" : "Delivered"}>
                          {isRead ? "✓✓ Seen" : "✓ Sent"}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input & Send Form */}
          <form onSubmit={handleSend} className={styles.inputForm}>
            <input
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Type a message…"
              maxLength={4000}
              className={styles.inputField}
              autoFocus
            />
            <button
              type="submit"
              disabled={!text.trim() || sending}
              className={styles.sendBtn}
              title="Send Message"
            >
              <svg viewBox="0 0 24 24">
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
              </svg>
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
