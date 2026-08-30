"use client";

import { ChangeEvent, useEffect, useState } from "react";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase-browser";
import {
  ConsultantProfileContent,
  newProfileItem,
  normalizeProfileContent,
  ProfileListItem,
} from "@/lib/consultant-profile";
import styles from "./profile-editor.module.css";

type CollectionKey = "vehicles" | "reviews" | "soldGallery" | "videos" | "socialLinks";
type ProfileRow = {
  consultant_slug: string;
  is_published: boolean;
};

const collections: Array<{ key: CollectionKey; title: string; addLabel: string; help: string }> = [
  { key: "vehicles", title: "Vehicle posts", addLabel: "Add vehicle", help: "Vehicle title, details, collage/photo and official listing." },
  { key: "reviews", title: "Reviews", addLabel: "Add review", help: "Upload the original review screenshot and identify the reviewer." },
  { key: "soldGallery", title: "Sold-customer gallery", addLabel: "Add sold photo", help: "Customer delivery photos, captions and optional links." },
  { key: "videos", title: "Videos", addLabel: "Add video", help: "Upload an MP4 or paste a YouTube, Facebook or other video link." },
  { key: "socialLinks", title: "Social links", addLabel: "Add social link", help: "Add the network name and the exact profile URL." },
];

export function ProfileEditor() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [draft, setDraft] = useState<ConsultantProfileContent | null>(null);
  const [notice, setNotice] = useState("");
  const [postedDialog, setPostedDialog] = useState(false);

  async function authFetch(url: string, init?: RequestInit) {
    const { data: { session } } = await getSupabaseBrowserClient().auth.getSession();
    if (!session) throw new Error("Please log in again.");
    return fetch(url, { ...init, headers: { ...init?.headers, authorization: `Bearer ${session.access_token}` } });
  }

  async function loadProfile() {
    if (!isSupabaseConfigured()) {
      setNotice("The profile database is not connected yet.");
      setLoading(false);
      return;
    }
    const { data: { session } } = await getSupabaseBrowserClient().auth.getSession();
    if (!session) {
      setLoading(false);
      return;
    }
    const response = await authFetch("/api/me/business-card");
    const result = await response.json();
    if (!response.ok) {
      setNotice(result.error || "Your business card could not be loaded.");
      setLoading(false);
      return;
    }
    setProfile({ consultant_slug: result.card.slug, is_published: Boolean(result.card.publishedAt) });
    setDraft(normalizeProfileContent(result.card.draft));
    setLoading(false);
  }

  useEffect(() => { void loadProfile(); }, []);

  async function signIn() {
    setLoading(true);
    setNotice("");
    const { error } = await getSupabaseBrowserClient().auth.signInWithPassword({ email, password });
    if (error) {
      setNotice(error.message);
      setLoading(false);
      return;
    }
    await loadProfile();
  }

  async function signOut() {
    await getSupabaseBrowserClient().auth.signOut();
    setProfile(null);
    setDraft(null);
  }

  const updateIdentity = (field: keyof ConsultantProfileContent["identity"], value: string) => {
    setDraft((current) => current ? { ...current, identity: { ...current.identity, [field]: value } } : current);
  };
  const updateContent = (field: keyof ConsultantProfileContent["content"], value: string) => {
    setDraft((current) => current ? { ...current, content: { ...current.content, [field]: value } } : current);
  };
  const updateContact = (field: keyof ConsultantProfileContent["contact"], value: string) => {
    setDraft((current) => current ? { ...current, contact: { ...current.contact, [field]: value } } : current);
  };

  async function saveDraft() {
    if (!profile || !draft) return;
    setSaving(true);
    const response = await authFetch("/api/me/business-card", {
      method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "draft", draft }),
    });
    const result = await response.json();
    setSaving(false);
    setNotice(response.ok ? "Draft saved. Your public site has not changed." : result.error);
  }

  async function publish() {
    if (!profile || !draft) return;
    setSaving(true);
    const response = await authFetch("/api/me/business-card", {
      method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "publish", draft }),
    });
    const result = await response.json();
    setSaving(false);
    if (!response.ok) {
      setNotice(result.error);
      return;
    }
    setProfile({ ...profile, is_published: true });
    setPostedDialog(true);
  }

  async function unpublish() {
    if (!profile || !window.confirm("Remove this business card from the public site? Your draft will remain saved.")) return;
    const response = await authFetch("/api/me/business-card", {
      method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "unpublish", draft }),
    });
    const result = await response.json();
    if (response.ok) setProfile({ ...profile, is_published: false });
    setNotice(response.ok ? "Business card removed from the public site." : result.error);
  }

  function changeItem(key: CollectionKey, index: number, field: keyof ProfileListItem, value: string) {
    setDraft((current) => {
      if (!current) return current;
      const list = current[key].map((entry, entryIndex) => entryIndex === index ? { ...entry, [field]: value } : entry);
      return { ...current, [key]: list };
    });
  }

  function addItem(key: CollectionKey) {
    setDraft((current) => current ? { ...current, [key]: [...current[key], newProfileItem()] } : current);
  }

  function removeItem(key: CollectionKey, index: number) {
    setDraft((current) => current ? { ...current, [key]: current[key].filter((_, i) => i !== index) } : current);
  }

  function moveItem(key: CollectionKey, index: number, direction: -1 | 1) {
    setDraft((current) => {
      if (!current) return current;
      const next = [...current[key]];
      const target = index + direction;
      if (target < 0 || target >= next.length) return current;
      [next[index], next[target]] = [next[target], next[index]];
      return { ...current, [key]: next };
    });
  }

  async function uploadMedia(event: ChangeEvent<HTMLInputElement>, onComplete: (url: string) => void) {
    const file = event.target.files?.[0];
    if (!file) return;
    setNotice(`Uploading ${file.name}…`);
    const body = new FormData();
    body.append("file", file);
    const response = await authFetch("/api/me/business-card", { method: "POST", body });
    const result = await response.json();
    if (!response.ok) {
      setNotice(result.error);
      return;
    }
    onComplete(result.url);
    setNotice("Upload complete. Save the draft when ready.");
  }

  if (loading) return <main className={styles.page}><p>Loading your business card…</p></main>;

  if (!profile || !draft) {
    return (
      <main className={styles.page}>
        <section className={styles.login}>
          <p>Private consultant backend</p>
          <h1>Business Card Login</h1>
          <label>Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label>
          <label>Password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} /></label>
          <button type="button" onClick={signIn}>Log in with NXTDox</button>
          {notice && <p className={styles.notice}>{notice}</p>}
        </section>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div><p>Private consultant backend</p><h1>Edit My Business Card</h1><span>Public link: /card/{profile.consultant_slug}</span></div>
        <button type="button" className={styles.quiet} onClick={signOut}>Log out</button>
      </header>

      <section className={styles.statusBar}>
        <span className={profile.is_published ? styles.live : styles.draft}>{profile.is_published ? "Live" : "Draft only"}</span>
        <div>
          <button type="button" className={styles.secondary} disabled={saving} onClick={saveDraft}>Save draft</button>
          <button type="button" className={styles.publish} disabled={saving} onClick={publish}>Publish</button>
          {profile.is_published && <button type="button" className={styles.danger} onClick={unpublish}>Unpublish</button>}
        </div>
      </section>

      <details className={styles.panel} open>
        <summary>Profile and contact information</summary>
        <div className={styles.grid}>
          {([
            ["displayName", "Full name"], ["jobTitle", "Job title"], ["dealership", "Dealership"], ["location", "Location"],
            ["phone", "Phone"], ["email", "Email"], ["languageLabel", "Language label"], ["logoUrl", "Logo URL"],
            ["profileImageUrl", "Profile photo URL"], ["callingCardImageUrl", "Calling-card image URL"],
          ] as Array<[keyof ConsultantProfileContent["identity"], string]>).map(([field, label]) => (
            <label key={field}>{label}<input value={draft.identity[field]} onChange={(event) => updateIdentity(field, event.target.value)} /></label>
          ))}
        </div>
        <div className={styles.uploadRow}>
          <label>Upload profile photo<input type="file" accept="image/*" onChange={(event) => uploadMedia(event, (url) => updateIdentity("profileImageUrl", url))} /></label>
          <label>Upload calling card<input type="file" accept="image/*" onChange={(event) => uploadMedia(event, (url) => updateIdentity("callingCardImageUrl", url))} /></label>
          <label>Upload logo<input type="file" accept="image/*" onChange={(event) => uploadMedia(event, (url) => updateIdentity("logoUrl", url))} /></label>
        </div>
      </details>

      <details className={styles.panel} open>
        <summary>Bio, catchphrases and buttons</summary>
        <div className={styles.grid}>
          <label>Primary phrase<input value={draft.content.primaryPhrase} onChange={(event) => updateContent("primaryPhrase", event.target.value)} /></label>
          <label>Inventory button label<input value={draft.content.inventoryButtonLabel} onChange={(event) => updateContent("inventoryButtonLabel", event.target.value)} /></label>
          <label className={styles.wide}>Sales quote<textarea value={draft.content.salesQuote} onChange={(event) => updateContent("salesQuote", event.target.value)} /></label>
          <label className={styles.wide}>Bio<textarea value={draft.content.bio} onChange={(event) => updateContent("bio", event.target.value)} /></label>
          <label className={styles.wide}>Inventory link<input type="url" value={draft.content.inventoryUrl} onChange={(event) => updateContent("inventoryUrl", event.target.value)} /></label>
          <label>Call button label<input value={draft.contact.callLabel} onChange={(event) => updateContact("callLabel", event.target.value)} /></label>
          <label>Text button label<input value={draft.contact.textLabel} onChange={(event) => updateContact("textLabel", event.target.value)} /></label>
          <label>Email button label<input value={draft.contact.emailLabel} onChange={(event) => updateContact("emailLabel", event.target.value)} /></label>
        </div>
      </details>

      {collections.map(({ key, title, addLabel, help }) => (
        <details className={styles.panel} key={key} open={key === "vehicles"}>
          <summary>{title} <small>{draft[key].length}</small></summary>
          <p className={styles.help}>{help}</p>
          <div className={styles.collection}>
            {draft[key].map((entry, index) => (
              <article className={styles.item} key={entry.id}>
                <div className={styles.itemToolbar}>
                  <strong>{entry.title || `${title} item ${index + 1}`}</strong>
                  <div>
                    <button type="button" disabled={index === 0} onClick={() => moveItem(key, index, -1)}>↑</button>
                    <button type="button" disabled={index === draft[key].length - 1} onClick={() => moveItem(key, index, 1)}>↓</button>
                    <button type="button" className={styles.delete} onClick={() => removeItem(key, index)}>Delete</button>
                  </div>
                </div>
                <div className={styles.grid}>
                  <label>Title or name<input value={entry.title} onChange={(event) => changeItem(key, index, "title", event.target.value)} /></label>
                  <label>Link<input type="url" value={entry.url} onChange={(event) => changeItem(key, index, "url", event.target.value)} /></label>
                  <label className={styles.wide}>Description or caption<textarea value={entry.description} onChange={(event) => changeItem(key, index, "description", event.target.value)} /></label>
                  <label className={styles.wide}>Image, thumbnail or uploaded-video URL<input value={entry.imageUrl} onChange={(event) => changeItem(key, index, "imageUrl", event.target.value)} /></label>
                  <label>Upload media<input type="file" accept="image/*,video/mp4,video/webm,video/quicktime" onChange={(event) => uploadMedia(event, (url) => changeItem(key, index, "imageUrl", url))} /></label>
                  <label>Extra details<input value={entry.meta ?? ""} onChange={(event) => changeItem(key, index, "meta", event.target.value)} /></label>
                </div>
              </article>
            ))}
          </div>
          <button type="button" className={styles.add} onClick={() => addItem(key)}>+ {addLabel}</button>
        </details>
      ))}

      <section className={styles.bottomActions}>
        <button type="button" className={styles.secondary} disabled={saving} onClick={saveDraft}>Save draft</button>
        <button type="button" className={styles.publish} disabled={saving} onClick={publish}>Publish</button>
      </section>
      {notice && <p className={styles.notice}>{notice}</p>}

      {postedDialog && (
        <div className={styles.dialogBackdrop} role="presentation">
          <section className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="posted-title">
            <span>✓</span>
            <h2 id="posted-title">Posted to site</h2>
            <p>Your published business card is now live.</p>
            <button type="button" onClick={() => setPostedDialog(false)}>Done</button>
          </section>
        </div>
      )}
    </main>
  );
}
