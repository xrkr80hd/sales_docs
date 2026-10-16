"use client";
import styles from "./organization-messenger.module.css";

type Message = { id: number; body: string; created_at: string; edited_at?: string };
type Props = {
  message: Message; own: boolean; senderName: string; expanded: boolean;
  confirmingDelete: boolean; busy: boolean;
  onToggle: () => void; onEdit: () => void; onDelete: () => void;
  onConfirmDelete: () => void; onCancelDelete: () => void;
};
export function MessageBubble({ message, own, senderName, expanded, confirmingDelete, busy, onToggle, onEdit, onDelete, onConfirmDelete, onCancelDelete }: Props) {
  const time = new Date(message.created_at);
  return <article className={`${styles.message} ${own ? styles.mine : ""}`}>
    <div className={styles.messageStack}>
      {own ? <button type="button" className={styles.bubble} aria-label={`Your message: ${message.body}`} aria-expanded={expanded} aria-controls={`message-actions-${message.id}`} onClick={() => { if (!window.getSelection()?.toString()) onToggle(); }}><span className={styles.messageText}>{message.body}</span></button>
        : <div className={styles.bubble}><strong>{senderName}</strong><p className={styles.messageText}>{message.body}</p></div>}
      <time className={styles.messageTime} dateTime={message.created_at} title={time.toLocaleString()}>{time.toLocaleDateString(undefined, { month: "short", day: "numeric" })} · {time.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}{message.edited_at ? " · edited" : ""}</time>
      {own && <div id={`message-actions-${message.id}`} className={styles.messageActions} hidden={!expanded}><button type="button" disabled={busy} onClick={onEdit}>Edit</button><span aria-hidden="true">|</span><button type="button" disabled={busy} onClick={onDelete}>Delete</button></div>}
      {own && confirmingDelete && <div className={styles.confirm}><span>Delete this message?</span><button type="button" disabled={busy} onClick={onConfirmDelete}>Delete</button><button type="button" onClick={onCancelDelete}>Cancel</button></div>}
    </div>
  </article>;
}
