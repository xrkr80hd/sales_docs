"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";

import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

import styles from "./messenger-workspace.module.css";

let audioContext: AudioContext | null = null;

function tone(frequency: number, start: number, duration: number, volume: number) {
  audioContext ??= new AudioContext();
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime + start);
  gain.gain.setValueAtTime(0.0001, audioContext.currentTime + start);
  gain.gain.exponentialRampToValueAtTime(volume, audioContext.currentTime + start + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + start + duration);
  oscillator.connect(gain);
  gain.connect(audioContext.destination);
  oscillator.start(audioContext.currentTime + start);
  oscillator.stop(audioContext.currentTime + start + duration);
}

function playSentSound() {
  tone(620, 0, 0.08, 0.035);
  tone(880, 0.06, 0.1, 0.025);
}

function playReceivedSound(customSoundUrl?: string) {
  if (customSoundUrl) {
    const audio = new Audio(customSoundUrl);
    audio.volume = 0.65;
    void audio.play().catch(() => {});
    return;
  }
  tone(880, 0, 0.1, 0.045);
  tone(660, 0.09, 0.13, 0.035);
}

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
  edited_at?: string | null;
  deleted_at?: string | null;
  profiles?: MessengerIdentity;
};
type MessengerIdentity = {
  display_name?: string;
  username?: string;
  nickname?: string;
  profile_image_url?: string;
};
type Person = { user_id: string; profiles?: MessengerIdentity };
type MessengerPayload = {
  membership?: {
    organization_id: string;
    chat_enabled: boolean;
    can_dm: boolean;
    can_org_chat: boolean;
    chat_nickname?: string | null;
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
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set());
  const [teamDraft, setTeamDraft] = useState("");
  const [dmDrafts, setDmDrafts] = useState<Record<string, string>>({});
  const [openDmIds, setOpenDmIds] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem("nxtdox.open-dms") || "[]"); } catch { return []; }
  });
  const [collapsedDmIds, setCollapsedDmIds] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem("nxtdox.collapsed-dms") || "[]"); } catch { return []; }
  });
  const [peopleOpen, setPeopleOpen] = useState(false);
  const [identityUserId, setIdentityUserId] = useState<string | null>(null);
  const [nicknameOpen, setNicknameOpen] = useState(false);
  const [nicknameDraft, setNicknameDraft] = useState("");
  const [editingMessageId, setEditingMessageId] = useState<string | number | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [customSoundUrl, setCustomSoundUrl] = useState(() => {
    try { return localStorage.getItem("nxtdox.received-sound") || ""; } catch { return ""; }
  });
  const [customSoundName, setCustomSoundName] = useState(() => {
    try { return localStorage.getItem("nxtdox.received-sound-name") || ""; } catch { return ""; }
  });
  const [sendingId, setSendingId] = useState("");
  const [error, setError] = useState("");
  const teamEndRef = useRef<HTMLDivElement>(null);
  const knownMessageIdsRef = useRef<Set<string>>(new Set());
  const loadedOnceRef = useRef(false);
  const lastPersonActivationRef = useRef<{ userId: string; at: number } | null>(null);

  const load = useCallback(async () => {
    try {
      const nextData: MessengerPayload = await call("/api/messenger");
      const nextMessages = nextData.messages ?? [];
      if (loadedOnceRef.current) {
        const received = nextMessages.some((message) =>
          message.sender_id !== nextData.me
          && !message.deleted_at
          && !knownMessageIdsRef.current.has(String(message.id))
        );
        if (received) playReceivedSound(customSoundUrl);
      }
      knownMessageIdsRef.current = new Set(nextMessages.map((message) => String(message.id)));
      loadedOnceRef.current = true;
      setData(nextData);
      setError("");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load Messenger.");
    }
  }, [customSoundUrl]);

  useEffect(() => {
    localStorage.setItem("nxtdox.open-dms", JSON.stringify(openDmIds));
  }, [openDmIds]);

  useEffect(() => {
    localStorage.setItem("nxtdox.collapsed-dms", JSON.stringify(collapsedDmIds));
  }, [collapsedDmIds]);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 4000);
    return () => window.clearInterval(timer);
  }, [load]);

  useEffect(() => {
    if (!data?.me || !data.membership?.organization_id) return;

    let supabase;
    try {
      supabase = getSupabaseBrowserClient();
    } catch {
      setOnlineUserIds(new Set([data.me]));
      return;
    }

    const channel = supabase.channel(`messenger-presence:${data.membership.organization_id}`, {
      config: { presence: { key: data.me } },
    });

    channel
      .on("presence", { event: "sync" }, () => {
        setOnlineUserIds(new Set(Object.keys(channel.presenceState())));
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({ user_id: data.me, online_at: new Date().toISOString() });
        }
      });

    return () => {
      void channel.untrack();
      void supabase.removeChannel(channel);
    };
  }, [data?.me, data?.membership?.organization_id]);

  const teamConversation = data?.conversations?.find((conversation) => conversation.kind === "organization");
  const teamMessages = (data?.messages ?? []).filter((message) => message.conversation_id === teamConversation?.id && !message.deleted_at);
  const dmConversations = (data?.conversations ?? []).filter((conversation) => conversation.kind === "dm");
  const currentUserId = data?.me;
  const teamConversationId = teamConversation?.id;
  const teamMessageCount = teamMessages.length;
  const people = (data?.people ?? [])
    .filter((person) => person.user_id !== currentUserId)
    .sort((a, b) => Number(onlineUserIds.has(b.user_id)) - Number(onlineUserIds.has(a.user_id)));
  const onlineCount = people.filter((person) => onlineUserIds.has(person.user_id)).length;

  useEffect(() => {
    teamEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [teamMessageCount]);

  useEffect(() => {
    if (!teamConversationId) return;
    void call("/api/messenger", {
      method: "POST",
      body: JSON.stringify({ action: "mark-read", conversationId: teamConversationId }),
    }).catch(() => {});
  }, [teamConversationId, teamMessageCount]);

  function personIdentity(userId: string) {
    return data?.people?.find((person) => person.user_id === userId)?.profiles;
  }

  function personName(userId: string) {
    const identity = personIdentity(userId);
    return identity?.nickname || identity?.display_name || "Team Member";
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

  const totalUnread = (data?.conversations ?? []).reduce((total, conversation) => total + unreadCount(conversation), 0);

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
    audioContext ??= new AudioContext();
    if (audioContext.state === "suspended") void audioContext.resume();
    setSendingId(conversationId);
    try {
      await call("/api/messenger", {
        method: "POST",
        body: JSON.stringify({ action: "send", conversationId, body: message }),
      });
      playSentSound();
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

  function activatePerson(userId: string) {
    const now = Date.now();
    const previous = lastPersonActivationRef.current;
    if (previous?.userId === userId && now - previous.at <= 450) {
      lastPersonActivationRef.current = null;
      setIdentityUserId(null);
      setPeopleOpen(false);
      openPersonDm(userId);
      return;
    }
    lastPersonActivationRef.current = { userId, at: now };
    setIdentityUserId(userId);
  }

  async function saveNickname(event: FormEvent) {
    event.preventDefault();
    const nickname = nicknameDraft.trim();
    if (!nickname) return;
    try {
      await call("/api/messenger", {
        method: "POST",
        body: JSON.stringify({ action: "update-nickname", nickname }),
      });
      setNicknameOpen(false);
      await load();
    } catch (nicknameError) {
      setError(nicknameError instanceof Error ? nicknameError.message : "Could not update your chat name.");
    }
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

  async function editMessage(messageId: string | number) {
    const body = editDraft.trim();
    if (!body) return;
    try {
      await call("/api/messenger", {
        method: "POST",
        body: JSON.stringify({ action: "edit", messageId, body }),
      });
      setEditingMessageId(null);
      setEditDraft("");
      await load();
    } catch (editError) {
      setError(editError instanceof Error ? editError.message : "Could not edit message.");
    }
  }

  async function clearMyMessages(conversationId: string) {
    if (!window.confirm("Clear all messages you sent in this conversation?")) return;
    try {
      await call("/api/messenger", {
        method: "POST",
        body: JSON.stringify({ action: "clear-mine", conversationId }),
      });
      await load();
    } catch (clearError) {
      setError(clearError instanceof Error ? clearError.message : "Could not clear messages.");
    }
  }

  function uploadSound(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("audio/")) {
      setError("Choose an audio file for the received-message sound.");
      return;
    }
    if (file.size > 1_500_000) {
      setError("Notification sounds must be 1.5 MB or smaller.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const value = String(reader.result || "");
      localStorage.setItem("nxtdox.received-sound", value);
      localStorage.setItem("nxtdox.received-sound-name", file.name);
      setCustomSoundUrl(value);
      setCustomSoundName(file.name);
      const audio = new Audio(value);
      audio.volume = 0.65;
      void audio.play().catch(() => {});
    };
    reader.readAsDataURL(file);
  }

  function renderMessages(messages: Message[], compact = false) {
    if (messages.length === 0) return <p className={styles.empty}>No messages yet.</p>;
    return messages.map((message) => {
      const mine = message.sender_id === data?.me;
      return (
        <article key={message.id} className={`${styles.message} ${mine ? styles.mine : ""}`}>
          {!mine && <div className={styles.sender}>{personName(message.sender_id)}</div>}
          <div className={styles.messageLine}>
            {editingMessageId === message.id ? (
              <form className={styles.editForm} onSubmit={(event) => { event.preventDefault(); void editMessage(message.id); }}>
                <input value={editDraft} onChange={(event) => setEditDraft(event.target.value)} maxLength={4000} autoFocus />
                <button type="submit">Save</button>
                <button type="button" onClick={() => setEditingMessageId(null)}>Cancel</button>
              </form>
            ) : <p className={`${styles.bubble} ${compact ? styles.compactBubble : ""}`}>{message.body}</p>}
            {mine && editingMessageId !== message.id && <div className={styles.messageActions}>
              <button type="button" onClick={() => { setEditingMessageId(message.id); setEditDraft(message.body); }}>Edit</button>
              <button type="button" onClick={() => void deleteMessage(message.id)} aria-label="Delete message">Delete</button>
            </div>}
          </div>
          <time className={styles.time}>{formatTime(message.created_at)}{message.edited_at ? " · Edited" : ""}</time>
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
          <h1>Team Messenger {totalUnread > 0 && <span className={styles.headerUnread}>{totalUnread}</span>}</h1>
        </div>
        <div className={styles.headerTools}>
          <button type="button" className={styles.nicknameButton} onClick={() => {
            setNicknameDraft(data.membership?.chat_nickname || "");
            setNicknameOpen((current) => !current);
          }}>Chat name</button>
          <label className={styles.soundUpload} title="Upload received-message sound">
            <input type="file" accept="audio/*" onChange={(event) => uploadSound(event.target.files?.[0])} />
            Sound{customSoundName ? `: ${customSoundName}` : ""}
          </label>
          <span className={styles.online}>Online</span>
        </div>
      </header>

      {nicknameOpen && <form className={styles.nicknameEditor} onSubmit={saveNickname}>
        <label>Chat nickname<input value={nicknameDraft} onChange={(event) => setNicknameDraft(event.target.value)} maxLength={32} autoFocus /></label>
        <button type="submit" disabled={!nicknameDraft.trim()}>Save</button>
        <button type="button" onClick={() => setNicknameOpen(false)}>Cancel</button>
      </form>}

      {error && <div className={styles.error}>{error}<button type="button" onClick={() => setError("")} aria-label="Dismiss error">×</button></div>}

      <div className={styles.workspaceBody}>
        <aside className={styles.peoplePanel}>
          <div className={styles.panelHeading}>
            <p>People</p>
            <span>{onlineCount} online · {people.length - onlineCount} offline</span>
          </div>
          <div className={styles.peopleList}>
            {people.map((person) => (
              <button key={person.user_id} type="button" className={styles.person} onClick={() => activatePerson(person.user_id)} disabled={!data.membership?.can_dm}>
                <span className={styles.avatar}>{person.profiles?.profile_image_url ? <img src={person.profiles.profile_image_url} alt="" /> : personName(person.user_id).charAt(0)}<span className={`${styles.presenceDot} ${onlineUserIds.has(person.user_id) ? styles.presenceOnline : styles.presenceOffline}`} /></span>
                <span>{personName(person.user_id)}</span>
                <span className={styles.openDm}>{onlineUserIds.has(person.user_id) ? "Online" : "Offline"} · Tap twice</span>
                {identityUserId === person.user_id && <span className={styles.peopleIdentity}><span className={styles.identityPhoto}>{person.profiles?.profile_image_url ? <img src={person.profiles.profile_image_url} alt="" /> : personName(person.user_id).charAt(0)}</span><strong>@{person.profiles?.username || "member"}</strong></span>}
              </button>
            ))}
          </div>
        </aside>

        <section className={styles.teamRoom}>
          <header className={styles.roomHeader}>
            <div className={styles.roomMark}>#</div>
            <div><h2>{teamConversation?.title || "Team Chat"}</h2><p>Everyone at {organizationName}</p></div>
            <button type="button" className={styles.clearButton} disabled={!teamConversation} onClick={() => teamConversation && void clearMyMessages(teamConversation.id)}>Clear mine</button>
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
          const otherUserId = conversation.messenger_participants?.find((participant) => participant.user_id !== data.me)?.user_id;
          if (!otherUserId) return null;
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
                  <span className={`${styles.dmStatus} ${onlineUserIds.has(otherUserId) ? styles.presenceOnline : styles.presenceOffline}`} /><span>{name}</span>
                </button>
                <button type="button" className={styles.dmClose} onClick={() => setOpenDmIds((current) => current.filter((id) => id !== conversationId))} aria-label={`Close chat with ${name}`}>×</button>
              </header>
              {!collapsed && <>
                <div className={styles.dmMessages}>
                  <button type="button" className={styles.dmClear} onClick={() => void clearMyMessages(conversationId)}>Clear my messages</button>
                  {renderMessages(messages, true)}
                </div>
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
        {people.map((person) => {
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
              <span className={`${styles.dmStatus} ${onlineUserIds.has(person.user_id) ? styles.presenceOnline : styles.presenceOffline}`} />
              <span className={styles.dmTabName}>{name}</span>
              {unread > 0 && <span className={styles.unreadCount}>{unread}</span>}
            </button>
          );
        })}
      </nav>}

      <button type="button" className={styles.peopleTab} onClick={() => setPeopleOpen(true)} aria-label={`Show members, ${onlineCount} online`}>
        People {onlineCount}/{people.length}{totalUnread > 0 ? ` · ${totalUnread}` : ""}
      </button>
      {peopleOpen && <div className={styles.mobilePeopleOverlay}>
        <button type="button" className={styles.mobilePeopleBackdrop} onClick={() => setPeopleOpen(false)} aria-label="Close online members" />
        <aside className={styles.mobilePeopleDrawer}>
          <header><div><strong>People</strong><span>{onlineCount} online · {people.length - onlineCount} offline</span></div><button type="button" onClick={() => setPeopleOpen(false)}>×</button></header>
          {people.map((person) => <button key={person.user_id} type="button" onClick={() => activatePerson(person.user_id)}><span className={styles.avatar}>{person.profiles?.profile_image_url ? <img src={person.profiles.profile_image_url} alt="" /> : personName(person.user_id).charAt(0)}<span className={`${styles.presenceDot} ${onlineUserIds.has(person.user_id) ? styles.presenceOnline : styles.presenceOffline}`} /></span><span>{personName(person.user_id)}</span><span className={styles.drawerPresence}>{onlineUserIds.has(person.user_id) ? "Online" : "Offline"}</span>{identityUserId === person.user_id && <span className={styles.drawerIdentity}><span className={styles.identityPhoto}>{person.profiles?.profile_image_url ? <img src={person.profiles.profile_image_url} alt="" /> : personName(person.user_id).charAt(0)}</span><strong>@{person.profiles?.username || "member"}</strong></span>}</button>)}
        </aside>
      </div>}
    </div>
  );
}
