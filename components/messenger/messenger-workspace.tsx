"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";

import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

import { ChatProvider, ChatMessages, ChatComposer } from "./chatcn/chat";
import { organizationThemeStyle } from "@/lib/organization-theme";
import { maskChatText, maskCompletedChatWords } from "@/lib/chat-moderation";
import type { ChatMessageData } from "./chatcn/types";

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
type Person = { user_id: string; organization_id?: string; profiles?: MessengerIdentity & {can_dm?:boolean} };
type Organization = { id: string; name: string };
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
  organizations?: Organization[];
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
  const [openDmIds, setOpenDmIds] = useState<string[]>(() => {
    try { const stored = JSON.parse(localStorage.getItem("nxtdox.open-dms") || "[]"); return Array.isArray(stored) ? stored.filter((id): id is string => typeof id === "string").slice(-1) : []; } catch { return []; }
  });
  const [collapsedDmIds, setCollapsedDmIds] = useState<string[]>(() => {
    try { const stored = JSON.parse(localStorage.getItem("nxtdox.collapsed-dms") || "[]"); return Array.isArray(stored) ? stored.filter((id): id is string => typeof id === "string") : []; } catch { return []; }
  });
  const [peopleOpen, setPeopleOpen] = useState(false);
  const [expandedOrganizationId, setExpandedOrganizationId] = useState<string | null>(null);
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
    if (!openDmIds.length) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpenDmIds([]);
        setCollapsedDmIds([]);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [openDmIds.length]);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => { if(document.visibilityState==="visible") void load(); }, 15000);
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

    const channel = supabase.channel(`messenger-presence:walker`, {
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

  const conversationKey = (data?.conversations || []).map(item => item.id).sort().join(",");
  useEffect(() => {
    if (!conversationKey) return;
    let client;
    try { client = getSupabaseBrowserClient(); } catch { return; }
    let refreshTimer: number | undefined;
    const channel = client.channel(`messenger-messages:${data?.me}`);
    for (const id of conversationKey.split(",")) channel.on("postgres_changes", { event: "*", schema: "public", table: "messenger_messages", filter: `conversation_id=eq.${id}` }, () => {
      window.clearTimeout(refreshTimer);
      refreshTimer = window.setTimeout(() => void load(), 150);
    });
    channel.subscribe();
    return () => { window.clearTimeout(refreshTimer); void client.removeChannel(channel); };
  }, [conversationKey, data?.me, load]);

  const teamConversation = data?.conversations?.find((conversation) => conversation.kind === "organization");
  const teamMessages = (data?.messages ?? []).filter((message) => message.conversation_id === teamConversation?.id && !message.deleted_at);
  const dmConversations = (data?.conversations ?? []).filter((conversation) => conversation.kind === "dm");
  const currentUserId = data?.me;
  const teamConversationId = teamConversation?.id;
  const teamMessageCount = teamMessages.length;
  const allPeople = (data?.people ?? []).filter(person => person.user_id !== currentUserId).sort((a, b) => Number(onlineUserIds.has(b.user_id)) - Number(onlineUserIds.has(a.user_id)) || personName(a.user_id).localeCompare(personName(b.user_id)));
  const onlinePeople = allPeople.filter(person => onlineUserIds.has(person.user_id));
  const organizationDirectory = (data?.organizations ?? []).filter(org => org.name && org.id);
  const peopleForOrganization = (organizationId: string) => allPeople.filter(person => person.organization_id === organizationId);


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

  function closeDm(conversationId: string) {
    // Closing the window only changes local presentation state; server messages remain untouched.
    setOpenDmIds((current) => current.filter((id) => id !== conversationId));
    setCollapsedDmIds((current) => current.filter((id) => id !== conversationId));
  }

  function openDm(conversationId: string) {
    setOpenDmIds([conversationId]);
    setPeopleOpen(false);
    setCollapsedDmIds((current) => current.filter((id) => id !== conversationId));
    markRead(conversationId);
  }

  async function send(conversationId: string, body: string, clear: () => void) {
    const message = maskChatText(body.trim());
    if (!message || sendingId) return false;
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
      return true;
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "Could not send message.");
      return false;
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

  function renderIdentityControl(userId: string) {
    const identity = personIdentity(userId);
    const nickname = identity?.nickname || identity?.display_name || "Team Member";
    const username = identity?.username || "member";
    const imageUrl = identity?.profile_image_url;
    const open = identityUserId === userId;
    return (
      <span className={`${styles.identityControl} ${open ? styles.identityOpen : ""}`}>
        <button
          type="button"
          className={styles.identityButton}
          onClick={() => activatePerson(userId)}
          aria-label={`${nickname}. Click once to view identity, twice to send a direct message.`}
        >
          <span className={styles.miniAvatar}>
            {imageUrl ? <img src={imageUrl} alt="" /> : nickname.charAt(0)}
          </span>
          <span>{nickname}</span>
        </button>
        <span className={styles.identityPopover} role="status">
          <span className={styles.identityPhoto}>
            {imageUrl ? <img src={imageUrl} alt={`${username} profile`} /> : nickname.charAt(0)}
          </span>
          <strong>@{username}</strong>
        </span>
      </span>
    );
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

  function chatMessages(messages: Message[]): ChatMessageData[] {
    return messages.map(message => ({ id: String(message.id), senderId: message.sender_id, senderName: message.profiles?.nickname || message.profiles?.display_name || personName(message.sender_id), senderAvatar: message.profiles?.profile_image_url, text: maskChatText(message.body), timestamp: new Date(message.created_at), isEdited: Boolean(message.edited_at) }));
  }
  function renderRoom(messages: Message[], conversationId: string | undefined, placeholder: string, allowed: boolean) {
    const edited = messages.find(message => String(message.id) === String(editingMessageId));
    return <ChatProvider currentUser={{ id: data?.me || "", name: personName(data?.me || "") }} theme="midnight" className="nxt-chat" onEdit={message => { setEditingMessageId(message.id); setEditDraft(message.text || ""); }} onDelete={id => void deleteMessage(id)}>
      {messages.length === 0 && <p className={styles.empty}>No messages yet. Start the conversation.</p>}
      <ChatMessages messages={chatMessages(messages)} />
      {edited && <form className={styles.editForm} onSubmit={event => { event.preventDefault(); void editMessage(edited.id); }}><input aria-label="Edit message" value={editDraft} onBlur={() => setEditDraft(maskChatText(editDraft))} onChange={event => setEditDraft(maskCompletedChatWords(event.target.value))} maxLength={4000} /><button type="submit">Save</button><button type="button" onClick={() => setEditingMessageId(null)}>Cancel</button></form>}
      <ChatComposer key={conversationId} placeholder={placeholder} transformInput={maskCompletedChatWords} finalizeInput={maskChatText} disabled={!conversationId || !allowed || Boolean(sendingId)} onSend={body => conversationId ? send(conversationId, body, () => {}) : false} />
    </ChatProvider>;
  }

  if (!data) return <div className={styles.loading}>{error || "Loading NXTDOX Messenger..."}</div>;
  if (!data.membership?.chat_enabled) return <div className={styles.loading}>Messenger access is not enabled for this account.</div>;

  const organizationName = data.membership.organizations?.name || "Walker Automotive";

  return (
    <div style={organizationThemeStyle("Walker CDJR")} data-fixed-chat-theme="walker" className={styles.workspace}>
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
          <span className={styles.online}>{onlineUserIds.has(data.me || "") ? "Online" : "Connecting"}</span>
        </div>
      </header>

      {nicknameOpen && <form className={styles.nicknameEditor} onSubmit={saveNickname}>
        <label>Chat nickname<input value={nicknameDraft} onChange={(event) => setNicknameDraft(event.target.value)} maxLength={32} /></label>
        <button type="submit" disabled={!nicknameDraft.trim()}>Save</button>
        <button type="button" onClick={() => setNicknameOpen(false)}>Cancel</button>
      </form>}

      {error && <div className={styles.error}>{error}<button type="button" onClick={() => setError("")} aria-label="Dismiss error">×</button></div>}

      <div className={styles.workspaceBody}>
        <aside className={styles.peoplePanel}>
          <div className={styles.panelHeading}>
            <p>Organizations</p>
            <span>{onlinePeople.length} online</span>
          </div>
          <div className={styles.organizationList} aria-label="Organization directory">
            {organizationDirectory.map((organization) => {
              const members = peopleForOrganization(organization.id);
              const expanded = expandedOrganizationId === organization.id;
              return <div key={organization.id} className={styles.organizationGroup}>
                <button type="button" className={styles.organizationToggle} aria-expanded={expanded} onClick={() => setExpandedOrganizationId(expanded ? null : organization.id)}>
                  <span className={styles.organizationChevron}>{expanded ? "▾" : "▸"}</span>
                  <span className={styles.organizationTitle}>{organization.name}</span>
                  <span className={styles.organizationCount}>{members.length}</span>
                </button>
                {expanded && <div className={styles.organizationMembers}>
                  {organization.id === data.membership?.organization_id && <div className={styles.organizationHint}>Your dealership team</div>}
                  {members.length === 0 && <p className={styles.organizationEmpty}>No chat-enabled members</p>}
                  {members.map(person => {
                    const name = personName(person.user_id);
                    const canMessage = Boolean(data.membership?.can_dm && person.profiles?.can_dm !== false);
                    return <button key={person.user_id} type="button" className={styles.organizationPerson} disabled={!canMessage} onClick={() => openPersonDm(person.user_id)}>
                      <span className={styles.avatar}>{person.profiles?.profile_image_url ? <img src={person.profiles.profile_image_url} alt="" /> : name.charAt(0)}</span>
                      <span className={styles.organizationPersonName}>{name}</span>
                      <span className={`${styles.dmStatus} ${onlineUserIds.has(person.user_id) ? "" : styles.offline}`} />
                    </button>;
                  })}
                </div>}
              </div>;
            })}
          </div>
        </aside>

        <section className={styles.teamRoom}>
          <header className={styles.roomHeader}>
            <div className={styles.roomMark}>#</div>
            <div><h2>{teamConversation?.title || "Team Chat"}</h2><p>Everyone at {organizationName}</p></div>
            <button type="button" className={styles.clearButton} disabled={!teamConversation} onClick={() => teamConversation && void clearMyMessages(teamConversation.id)}>Clear mine</button>
          </header>
          {renderRoom(teamMessages, teamConversation?.id, "Message the team…", Boolean(data.membership?.can_org_chat))}
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
                  <span className={`${styles.dmStatus} ${onlineUserIds.has(otherUserId || "") ? "" : styles.offline}`}  /><span>{name}</span>
                </button>
                <button type="button" className={styles.dmClose} onClick={() => closeDm(conversationId)} aria-label={`Close chat with ${name} without deleting messages`} title="Close conversation (messages are saved)">×</button>
              </header>
              {!collapsed && <>
                <button type="button" className={styles.dmClear} onClick={() => void clearMyMessages(conversationId)}>Clear my messages</button>
                {renderRoom(messages, conversationId, `Message ${name}…`, Boolean(data.membership?.can_dm))}
              </>}
            </section>
          );
        })}
      </div>

      {data.membership.can_dm && <nav className={styles.dmTray} aria-label="Personal direct messages">
        {allPeople.map((person) => {
          const conversation = dmForPerson(person.user_id);
          const unread = unreadCount(conversation);
          const name = personName(person.user_id);
          const open = Boolean(conversation && openDmIds.includes(conversation.id) && !collapsedDmIds.includes(conversation.id));
          return (
            <button
              key={person.user_id}
              type="button"
              className={`${styles.dmTab} ${open ? styles.dmTabOpen : ""} ${unread > 0 ? styles.dmTabUnread : ""}`}
              onClick={() => {
                if (conversation && openDmIds.includes(conversation.id) && !collapsedDmIds.includes(conversation.id)) {
                  setCollapsedDmIds([conversation.id]);
                } else openPersonDm(person.user_id);
              }}
              aria-label={`${name}${unread ? `, ${unread} unread messages` : ""}`}
            >
              <span className={`${styles.dmStatus} ${onlineUserIds.has(person.user_id) ? "" : styles.offline}`} />
              <span className={styles.dmTabName}>{name}</span>
              {unread > 0 && <span className={styles.unreadCount}>{unread}</span>}
            </button>
          );
        })}
      </nav>}

      <button type="button" className={styles.peopleTab} onClick={() => setPeopleOpen(true)} aria-label={`Show organizations, ${organizationDirectory.length} organizations`}>
        Organizations {organizationDirectory.length}{totalUnread > 0 ? ` · ${totalUnread}` : ""}
      </button>
      {peopleOpen && <div className={styles.mobilePeopleOverlay}>
        <button type="button" className={styles.mobilePeopleBackdrop} onClick={() => setPeopleOpen(false)} aria-label="Close members" />
        <aside className={styles.mobilePeopleDrawer}>
          <header><div><strong>Organizations</strong><span>{organizationDirectory.length} dealerships</span></div><button type="button" onClick={() => setPeopleOpen(false)}>×</button></header>
          {organizationDirectory.map(org => <div key={org.id} className={styles.organizationGroup}><button type="button" className={styles.organizationToggle} aria-expanded={expandedOrganizationId === org.id} onClick={() => setExpandedOrganizationId(expandedOrganizationId === org.id ? null : org.id)}><span>{expandedOrganizationId === org.id ? "▾" : "▸"}</span><span className={styles.organizationTitle}>{org.name}</span><span>{peopleForOrganization(org.id).length}</span></button>{expandedOrganizationId === org.id && peopleForOrganization(org.id).map(person => <button key={person.user_id} type="button" className={styles.organizationPerson} disabled={!data.membership?.can_dm || person.profiles?.can_dm === false} onClick={() => openPersonDm(person.user_id)}><span className={styles.avatar}>{person.profiles?.profile_image_url ? <img src={person.profiles.profile_image_url} alt="" /> : personName(person.user_id).charAt(0)}</span><span className={styles.organizationPersonName}>{personName(person.user_id)}</span><span className={`${styles.dmStatus} ${onlineUserIds.has(person.user_id) ? "" : styles.offline}`} /></button>)}</div>)}
        </aside>
      </div>}
    </div>
  );
}
