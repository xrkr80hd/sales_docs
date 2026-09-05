"use client";

import { ChangeEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase-browser";
import {
  ConsultantProfileContent,
  newProfileItem,
  normalizeProfileContent,
  ProfileListItem,
} from "@/lib/consultant-profile";
import styles from "./profile-editor.module.css";

import { ImageCropperModal, type AspectRatioType } from "@/components/ui/image-cropper-modal";

type CollectionKey = "vehicles" | "reviews" | "soldGallery" | "videos" | "socialLinks";
type ProfileRow = {
  consultant_slug: string;
  is_published: boolean;
};

const limits: Record<CollectionKey, number | undefined> = {
  reviews: 10,
  videos: undefined,
  vehicles: 6,
  soldGallery: 12,
  socialLinks: 8,
};
const MAX_MEDIA_FILE_SIZE = 250 * 1024 * 1024;
const isUploadedVideoUrl = (value: string) => /\.(mp4|webm|mov)(\?|$)/i.test(value);

export function getSocialIcon(urlOrName: string) {
  const s = urlOrName.toLowerCase();
  if (s.includes("facebook") || s.includes("fb.com")) {
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="#1877F2">
        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
      </svg>
    );
  }
  if (s.includes("instagram") || s.includes("instagr.am")) {
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="#E4405F">
        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
      </svg>
    );
  }
  if (s.includes("tiktok")) {
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="#00F2FE">
        <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.24 1.07-.14 1.61.24 1.64 1.82 2.89 3.5 2.75 1.33-.03 2.54-.87 3.03-2.07.24-.55.33-1.16.33-1.76.03-4.78.01-9.56.02-14.34z"/>
      </svg>
    );
  }
  if (s.includes("youtube") || s.includes("youtu.be")) {
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="#FF0000">
        <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
      </svg>
    );
  }
  if (s.includes("linkedin")) {
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="#0A66C2">
        <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/>
      </svg>
    );
  }
  if (s.includes("twitter") || s.includes("x.com")) {
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="#FFFFFF">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
      </svg>
    );
  }
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="#888">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
    </svg>
  );
}

export function ProfileEditor() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [draft, setDraft] = useState<ConsultantProfileContent | null>(null);
  const [savedDraft, setSavedDraft] = useState("");
  const [notice, setNotice] = useState("");
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [postedDialog, setPostedDialog] = useState(false);
  const [nfcLinkCopied, setNfcLinkCopied] = useState(false);
  const [cardOrigin, setCardOrigin] = useState("");

  // Active Cropper Modal State
  const [cropTarget, setCropTarget] = useState<{
    imageUrl: string;
    aspectRatio: AspectRatioType;
    title: string;
    onApply: (dataUrl: string) => void;
  } | null>(null);

  async function authFetch(url: string, init?: RequestInit) {
    if (process.env.NEXT_PUBLIC_DISABLE_AUTH === "1") {
      return fetch(url, { ...init, headers: { ...init?.headers, authorization: "Bearer local-dev-token" } });
    }
    const { data: { session } } = await getSupabaseBrowserClient().auth.getSession();
    if (!session) throw new Error("Please log in again.");
    return fetch(url, { ...init, headers: { ...init?.headers, authorization: `Bearer ${session.access_token}` } });
  }

  async function loadProfile() {
    const isLocalDev = process.env.NEXT_PUBLIC_DISABLE_AUTH === "1";
    if (!isSupabaseConfigured() && !isLocalDev) {
      setNotice("The profile database is not connected yet.");
      setLoading(false);
      return;
    }
    if (!isLocalDev) {
      const { data: { session } } = await getSupabaseBrowserClient().auth.getSession();
      if (!session) {
        setLoading(false);
        return;
      }
    }
    try {
      const response = await authFetch("/api/me/business-card");
      const result = await response.json();
      if (!response.ok || result.permitted === false) {
        setPermissionError(result.error || "Card permission has not been granted to your account. Please ask an administrator to enable your card.");
        setLoading(false);
        return;
      }
      const loadedDraft = normalizeProfileContent(result.card.draft, result.isAdmin);
      setProfile({ consultant_slug: result.card.slug, is_published: Boolean(result.card.publishedAt) });
      setDraft(loadedDraft);
      setSavedDraft(JSON.stringify(loadedDraft));
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Failed to load profile.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setCardOrigin(window.location.origin);
    void loadProfile();
  }, []);

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

  const updateIdentity = (field: keyof ConsultantProfileContent["identity"], value: string) => {
    setDraft((current) => current ? { ...current, identity: { ...current.identity, [field]: value } } : current);
  };
  const updateContent = (field: keyof ConsultantProfileContent["content"], value: string) => {
    setDraft((current) => current ? { ...current, content: { ...current.content, [field]: value } } : current);
  };
  const updateContact = (field: keyof ConsultantProfileContent["contact"], value: string) => {
    setDraft((current) => current ? { ...current, contact: { ...current.contact, [field]: value } } : current);
  };

  async function saveChanges() {
    if (!profile || !draft) return;
    setSaving(true);
    setNotice("");
    try {
      const response = await authFetch("/api/me/business-card", {
        method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "publish", draft }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || `Save failed (${response.status}).`);
      setProfile({ consultant_slug: result.card?.slug || profile.consultant_slug, is_published: true });
      setSavedDraft(JSON.stringify(draft));
      setPostedDialog(true);
      router.refresh();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Your changes could not be saved. Please try again.");
    } finally {
      setSaving(false);
    }
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

  async function copyNfcCardLink() {
    if (!profile) return;
    const cardUrl = `${window.location.origin}/card/${profile.consultant_slug}`;
    try {
      await navigator.clipboard.writeText(cardUrl);
      setNfcLinkCopied(true);
      window.setTimeout(() => setNfcLinkCopied(false), 2500);
    } catch {
      window.prompt("Copy this business-card link:", cardUrl);
    }
  }

  function cancelChanges() {
    if (!savedDraft) return;
    setDraft(JSON.parse(savedDraft) as ConsultantProfileContent);
    setNotice("Changes canceled.");
  }

  function changeItem(key: CollectionKey, index: number, field: keyof ProfileListItem, value: string) {
    setDraft((current) => {
      if (!current) return current;
      const list = current[key].map((entry, entryIndex) => entryIndex === index ? { ...entry, [field]: value } : entry);
      return { ...current, [key]: list };
    });
  }

  function addItem(key: CollectionKey) {
    const max = limits[key];
    setDraft((current) => {
      if (!current) return current;
      if (max && current[key].length >= max) return current;
      return { ...current, [key]: [...current[key], newProfileItem()] };
    });
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

  // Upload data URL or File
  async function uploadBlobOrFile(fileOrBlob: Blob, filename: string, category: string, onComplete: (url: string) => void) {
    if (fileOrBlob.size > MAX_MEDIA_FILE_SIZE) {
      setNotice("That file is over the 250 MB limit. Please choose a smaller video.");
      return;
    }
    if (process.env.NEXT_PUBLIC_DISABLE_AUTH !== "1" && isSupabaseConfigured()) {
      setNotice(`Preparing ${filename}…`);
      const signResponse = await authFetch("/api/me/business-card", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "create-upload", filename, category, contentType: fileOrBlob.type, size: fileOrBlob.size }),
      });
      const signed = await signResponse.json();
      if (!signResponse.ok) {
        setNotice(signed.error || "The upload could not be prepared.");
        return;
      }
      setNotice(`Uploading ${filename} directly to your media library…`);
      const { error } = await getSupabaseBrowserClient().storage.from(signed.bucket).uploadToSignedUrl(signed.path, signed.token, fileOrBlob, { contentType: fileOrBlob.type });
      if (error) {
        setNotice(error.message);
        return;
      }
      onComplete(signed.url);
      setNotice("Uploaded successfully. Press Save to place it on your card.");
      return;
    }

    setNotice(`Uploading ${filename}…`);
    const body = new FormData();
    body.append("file", fileOrBlob, filename);
    body.append("category", category);
    const response = await authFetch("/api/me/business-card", { method: "POST", body });
    const result = await response.json();
    if (!response.ok) {
      setNotice(result.error);
      return;
    }
    onComplete(result.url);
    setNotice("Uploaded successfully. Press Save to place it on your card.");
  }

  // File picker handler: opens crop modal if image
  function handleFileSelectedWithCrop(
    event: ChangeEvent<HTMLInputElement>,
    category: string,
    aspectRatio: AspectRatioType,
    title: string,
    onComplete: (url: string) => void,
  ) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = () => {
        const rawUrl = reader.result as string;
        setCropTarget({
          imageUrl: rawUrl,
          aspectRatio,
          title,
          onApply: async (croppedDataUrl: string) => {
            setCropTarget(null);
            // Convert data URL to blob
            const res = await fetch(croppedDataUrl);
            const blob = await res.blob();
            await uploadBlobOrFile(blob, file.name, category, onComplete);
          },
        });
      };
      reader.readAsDataURL(file);
    } else {
      // Non-image e.g. video
      void uploadBlobOrFile(file, file.name, category, onComplete);
    }
  }

  if (loading) return <main className={styles.page}><p>Loading your business card…</p></main>;

  if (permissionError) {
    return (
      <main className={styles.page}>
        <section className={styles.permissionDenied}>
          <span className={styles.permissionBadge}>Access Restricted</span>
          <h2>Business Card Permission Required</h2>
          <p>{permissionError}</p>
          <Link href="/dashboard" className={styles.backLink}>← Return to Dashboard</Link>
        </section>
      </main>
    );
  }

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

  const hasChanges = JSON.stringify(draft) !== savedDraft;
  const uploadedVideoCount = draft.videos.filter((video) => isUploadedVideoUrl(video.imageUrl)).length;

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <Link href="/dashboard" className={styles.backLink}>← Dashboard</Link>
          <h1>Business Card</h1>
          <span>Your public card: /card/{profile.consultant_slug}</span>
        </div>
        {profile.is_published && <a className={styles.viewCard} href={`/card/${profile.consultant_slug}`} target="_blank" rel="noopener noreferrer">View card</a>}
      </header>

      <section className={styles.statusBar}>
        <span className={profile.is_published ? styles.live : styles.draft}>{profile.is_published ? "Live" : "Not live"}</span>
        <div>
          {hasChanges && <button type="button" className={styles.publish} disabled={saving} onClick={saveChanges}>{saving ? "Saving…" : "Save"}</button>}
          {hasChanges && <button type="button" className={styles.secondary} disabled={saving} onClick={cancelChanges}>Cancel</button>}
          {profile.is_published && <button type="button" className={styles.danger} onClick={unpublish}>Remove from site</button>}
        </div>
      </section>

      <details className={styles.panel}>
        <summary>
          <span>NFC Card Link</span>
          <div className={styles.summaryRight}>
            <span className={styles.chevronArrow}>▼</span>
          </div>
        </summary>
        <div className={styles.nfcLinkPanel}>
          <p>Use this as the only website link written to your NFC tag. It opens the same public business card on iPhone and Android.</p>
          <div className={styles.nfcLinkRow}>
            <code>{cardOrigin ? `${cardOrigin}/card/${profile.consultant_slug}` : `/card/${profile.consultant_slug}`}</code>
            <button type="button" className={styles.publish} onClick={copyNfcCardLink}>
              {nfcLinkCopied ? "Link copied" : "Copy NFC link"}
            </button>
          </div>
          <small>In your NFC-writing app, choose Website or URL. Do not choose Phone, Contact, or Telephone.</small>
        </div>
      </details>

      <h2 className={styles.sectionHeader}>Business Card Basics</h2>
      <p className={styles.sectionIntro}>Headshot photo (1:1), Calling Card artwork (1:1), and contact details.</p>

      {/* ── Identity & Artwork ── */}
      <details className={styles.panel}>
        <summary>
          <span>1. Profile Photo (1:1) &amp; Calling Card (1:1)</span>
          <div className={styles.summaryRight}>
            <span className={styles.chevronArrow}>▼</span>
          </div>
        </summary>

        <div className={styles.uploadRow}>
          {/* 1:1 Profile Photo */}
          <div className={styles.uploadBox}>
            <label>Profile Headshot (1:1 Square)</label>
            <div className={styles.previewStage}>
              <div className={styles.profilePreviewThumb}>
                {draft.identity.profileImageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={draft.identity.profileImageUrl} alt="Profile photo preview" />
                ) : (
                  <span style={{ color: "#777", fontSize: "0.8rem", padding: "10px" }}>No photo uploaded</span>
                )}
              </div>
            </div>
            <label className={styles.actionCropBtn}>
              <span>📷 Crop &amp; Upload Photo</span>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => handleFileSelectedWithCrop(e, "profile", "1:1", "Crop Profile Headshot (1:1)", (url) => updateIdentity("profileImageUrl", url))}
              />
            </label>
          </div>

          {/* 1:1 Calling Card Artwork */}
          <div className={styles.uploadBox}>
            <label>Calling Card (1:1 Square)</label>
            <div className={styles.previewStage}>
              <div className={styles.callingCardPreviewThumb}>
                {draft.identity.callingCardImageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={draft.identity.callingCardImageUrl} alt="Calling card preview" />
                ) : (
                  <span style={{ color: "#777", fontSize: "0.8rem", padding: "10px" }}>No card uploaded</span>
                )}
              </div>
            </div>
            <label className={styles.actionCropBtn}>
              <span>💳 Crop &amp; Upload Card</span>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => handleFileSelectedWithCrop(e, "calling-card", "1:1", "Crop Calling Card (1:1)", (url) => updateIdentity("callingCardImageUrl", url))}
              />
            </label>
          </div>
        </div>

        <div className={styles.grid}>
          {([
            ["displayName", "Full name"], ["jobTitle", "Job title"], ["dealership", "Dealership"], ["location", "Location"],
            ["phone", "Phone"], ["email", "Email"], ["languageLabel", "Language label"],
          ] as Array<[keyof ConsultantProfileContent["identity"], string]>).map(([field, label]) => (
            <label key={field}>{label}<input value={draft.identity[field]} onChange={(event) => updateIdentity(field, event.target.value)} /></label>
          ))}
        </div>
      </details>

      {/* ── Bio, Phrases & Buttons ── */}
      <details className={styles.panel}>
        <summary>
          <span>2. Bio, Catchphrases &amp; Action Buttons</span>
          <div className={styles.summaryRight}>
            <span className={styles.chevronArrow}>▼</span>
          </div>
        </summary>
        <div className={styles.grid}>
          <label>Primary phrase<input value={draft.content.primaryPhrase} placeholder="#CallYourName" onChange={(event) => updateContent("primaryPhrase", event.target.value)} /></label>
          <label>Inventory button label<input value={draft.content.inventoryButtonLabel} onChange={(event) => updateContent("inventoryButtonLabel", event.target.value)} /></label>
          <label className={styles.wide}>Sales quote<textarea value={draft.content.salesQuote} onChange={(event) => updateContent("salesQuote", event.target.value)} /></label>
          <label className={styles.wide}>Bio<textarea value={draft.content.bio} onChange={(event) => updateContent("bio", event.target.value)} /></label>
          <label className={styles.wide}>Walker inventory website<input type="url" value={draft.content.inventoryUrl} onChange={(event) => updateContent("inventoryUrl", event.target.value)} /></label>
        </div>
      </details>

      <h2 className={styles.sectionHeader}>Customer Reviews &amp; Inventory Media Pools</h2>
      <p className={styles.sectionIntro}>Dedicated media pools for your five-star review screenshots, featured inventory carousel, and videos.</p>

      {/* ── 3. Five-Star Reviews Pool (Max 10) ── */}
      <details className={styles.panel}>
        <summary>
          <span>3. Five-Star Customer Reviews (Screenshot Pool)</span>
          <div className={styles.summaryRight}>
            <small>{draft.reviews.length} / 10</small>
            <span className={styles.chevronArrow}>▼</span>
          </div>
        </summary>
        <p className={styles.help}>
          Upload screenshot images of your 5-star Google, DealerRater, or Facebook reviews (up to 10). Tapping a review expands it with low-opacity navigation arrows.
        </p>
        <div className={styles.collection}>
          {draft.reviews.map((review, index) => (
            <details className={styles.reviewItem} key={review.id}>
              <summary className={styles.reviewItemSummary}>
                <strong>{review.title ? `Review from ${review.title}` : `Review #${index + 1}`}</strong>
                <span className={styles.reviewChevron}>▼</span>
              </summary>
              <div className={styles.reviewItemBody}>
                <div className={styles.reviewActions}>
                  <button type="button" disabled={index === 0} onClick={() => moveItem("reviews", index, -1)}>↑</button>
                  <button type="button" disabled={index === draft.reviews.length - 1} onClick={() => moveItem("reviews", index, 1)}>↓</button>
                  <button type="button" className={styles.delete} onClick={() => removeItem("reviews", index)}>Delete</button>
                </div>
                <div className={styles.reviewEditorGrid}>
                  <div className={styles.reviewThumbContainer}>
                    {review.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={review.imageUrl} alt={review.title || "Review screenshot"} className={styles.reviewThumbnail} />
                    ) : (
                      <div className={styles.reviewThumbPlaceholder}>No screenshot uploaded</div>
                    )}
                    <label className={styles.uploadReviewBtn}>
                      <span>📷 Crop &amp; Upload Screenshot</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleFileSelectedWithCrop(e, "reviews", "free", `Crop Review #${index + 1}`, (url) => changeItem("reviews", index, "imageUrl", url))}
                      />
                    </label>
                  </div>
                  <div className={styles.reviewDetails}>
                    <label>
                      Reviewer Name (Customer)
                      <input
                        placeholder="e.g. Edward Ramer"
                        value={review.title}
                        onChange={(e) => changeItem("reviews", index, "title", e.target.value)}
                      />
                    </label>
                  </div>
                </div>
              </div>
            </details>
          ))}
        </div>
        <button
          type="button"
          className={styles.add}
          disabled={draft.reviews.length >= 10}
          onClick={() => addItem("reviews")}
        >
          {draft.reviews.length >= 10 ? "Review Limit Reached (10/10)" : "+ Add Review Screenshot"}
        </button>
      </details>

      {/* ── 4. Featured Vehicles Pool ── */}
      <details className={styles.panel} open>
        <summary>
          <span>4. Vehicle Carousel</span>
          <div className={styles.summaryRight}>
            <small>{draft.vehicles.length} / 6</small>
            <span className={styles.chevronArrow}>▼</span>
          </div>
        </summary>
        <p className={styles.help}>
          Build the vehicle once, download its finished collage, and add that same collage to your swipeable business-card carousel.
        </p>
        <Link href="/vehicle-collage" className={styles.collageBuilderButton}>
          <span className={styles.collageBuilderIcon} aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none">
              <rect x="3" y="3" width="8" height="8" rx="1.5" />
              <rect x="13" y="3" width="8" height="8" rx="1.5" />
              <rect x="3" y="13" width="18" height="8" rx="1.5" />
            </svg>
          </span>
          <span>
            <strong>Build Vehicle Collage</strong>
            <small>Create, crop, and add a vehicle to your card</small>
          </span>
          <span className={styles.collageBuilderArrow} aria-hidden="true">→</span>
        </Link>
        <div className={styles.collection}>
          {draft.vehicles.map((v, index) => (
              <article className={styles.item} key={v.id}>
                <div className={styles.itemToolbar}>
                  <strong>{v.title || `Featured Vehicle #${index + 1}`}</strong>
                  <div>
                    <button type="button" disabled={index === 0} onClick={() => moveItem("vehicles", index, -1)}>↑</button>
                    <button type="button" disabled={index === draft.vehicles.length - 1} onClick={() => moveItem("vehicles", index, 1)}>↓</button>
                    <button type="button" className={styles.delete} onClick={() => removeItem("vehicles", index)}>Delete</button>
                  </div>
                </div>
                <div className={styles.vehicleEditorGrid}>
                  <div className={styles.vehicleThumbContainer}>
                    {v.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={v.imageUrl} alt={v.title || "Vehicle photo"} className={styles.vehicleThumbnail} />
                    ) : (
                      <div className={styles.vehicleThumbPlaceholder}>No photo uploaded</div>
                    )}
                  </div>
                  <div className={styles.vehicleDetails}>
                    <strong>{v.title}</strong>
                    {v.meta && <p className={styles.help}>{v.meta}</p>}
                    {v.secondaryUrl && <p className={styles.help}>VIN: {v.secondaryUrl}</p>}
                    {v.url && <a href={v.url} target="_blank" rel="noreferrer">View Walker listing</a>}
                    <Link className={styles.editVehicle} href={`/vehicle-collage?edit=${v.id}`}>Edit Vehicle</Link>
                  </div>
                </div>
              </article>
          ))}
        </div>
      </details>

      {/* ── 5. Videos ── */}
      <details className={styles.panel} open>
        <summary>
          <span>5. Videos</span>
          <div className={styles.summaryRight}>
            <small>{uploadedVideoCount} / 2 uploads</small>
            <span className={styles.chevronArrow}>▼</span>
          </div>
        </summary>
        <p className={styles.help}>
          Upload up to 2 video files, or add as many YouTube and TikTok links as you want. Everything appears in one video carousel.
        </p>
        <div className={styles.collection}>
          {draft.videos.map((vid, index) => (
            <details className={styles.videoEditorItem} key={vid.id}>
              <summary>
                <span>{vid.title || `Video #${index + 1}`}</span>
                <small>{isUploadedVideoUrl(vid.imageUrl) ? "Uploaded file" : vid.url ? "Linked video" : "Not added"}</small>
              </summary>
              <div className={styles.videoEditorBody}>
              {vid.imageUrl && (
                <div className={styles.videoPreview}>
                  <video src={vid.imageUrl} controls muted playsInline preload="metadata" />
                  <span>Uploaded successfully</span>
                </div>
              )}
              <div className={styles.itemToolbar}>
                <strong>Video controls</strong>
                <div>
                  <button type="button" disabled={index === 0} onClick={() => moveItem("videos", index, -1)}>↑</button>
                  <button type="button" disabled={index === draft.videos.length - 1} onClick={() => moveItem("videos", index, 1)}>↓</button>
                  <button type="button" className={styles.delete} onClick={() => { if (window.confirm("Delete this video from your card?")) removeItem("videos", index); }}>Delete</button>
                </div>
              </div>
              <div className={styles.grid}>
                <label className={styles.wide}>
                  Video Title
                  <input
                    placeholder="e.g. Funny dealership video or vehicle walkaround"
                    value={vid.title}
                    onChange={(e) => changeItem("videos", index, "title", e.target.value)}
                  />
                </label>
                <label className={styles.wide}>
                  Upload Video File (MP4, WebM, MOV · 250 MB max) — {uploadedVideoCount}/2 used
                  <input
                    type="file"
                    accept="video/mp4,video/webm,video/quicktime"
                    disabled={uploadedVideoCount >= 2 && !isUploadedVideoUrl(vid.imageUrl)}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) uploadBlobOrFile(file, file.name, "videos", (url) => {
                        changeItem("videos", index, "imageUrl", url);
                        setNotice(`${vid.title || `Video #${index + 1}`} uploaded successfully.`);
                      });
                    }}
                  />
                </label>
                {isUploadedVideoUrl(vid.imageUrl) && <p className={styles.help}>Video uploaded successfully.</p>}
                <label className={styles.wide}>
                  YouTube or TikTok Link
                  <input
                    type="url"
                    placeholder="Paste a YouTube or TikTok link"
                    value={vid.url}
                    onChange={(e) => changeItem("videos", index, "url", e.target.value)}
                  />
                </label>
                <label className={styles.wide}>
                  Video Description
                  <textarea
                    rows={2}
                    placeholder="Describe the video or add a short caption."
                    value={vid.description}
                    onChange={(e) => changeItem("videos", index, "description", e.target.value)}
                  />
                </label>
              </div>
              </div>
            </details>
          ))}
        </div>
        <button
          type="button"
          className={styles.add}
          onClick={() => addItem("videos")}
        >
          + Add Video
        </button>
        <button type="button" className={styles.videoSaveButton} disabled={saving || !hasChanges} onClick={saveChanges}>
          {saving ? "Saving Videos…" : "Save Videos"}
        </button>
      </details>

      {/* ── 6. Customer Delivery Gallery (Sold Pool) ── */}
      <details className={styles.panel}>
        <summary>
          <span>6. Customer Delivery Gallery</span>
          <div className={styles.summaryRight}>
            <small>{draft.soldGallery.length}</small>
            <span className={styles.chevronArrow}>▼</span>
          </div>
        </summary>
        <p className={styles.help}>Happy customer delivery photos at the dealership.</p>
        <div className={styles.collection}>
          {draft.soldGallery.map((sold, index) => (
            <article className={styles.item} key={sold.id}>
              <div className={styles.itemToolbar}>
                <strong>{sold.title || `Delivery Photo #${index + 1}`}</strong>
                <div>
                  <button type="button" className={styles.delete} onClick={() => removeItem("soldGallery", index)}>Delete</button>
                </div>
              </div>
              <div className={styles.grid}>
                <label>Customer Name / Caption<input placeholder="e.g. Congratulations to the Miller family!" value={sold.title} onChange={(e) => changeItem("soldGallery", index, "title", e.target.value)} /></label>
                <label>
                  Upload Delivery Photo
                  <input type="file" accept="image/*" onChange={(e) => handleFileSelectedWithCrop(e, "sold", "free", "Crop Delivery Photo", (url) => changeItem("soldGallery", index, "imageUrl", url))} />
                </label>
              </div>
            </article>
          ))}
        </div>
        <button type="button" className={styles.add} onClick={() => addItem("soldGallery")}>+ Add Delivery Photo</button>
      </details>

      {/* ── 7. Social Media Links ── */}
      <details className={styles.panel}>
        <summary>
          <span>7. Social Media Links &amp; Brand Logos</span>
          <div className={styles.summaryRight}>
            <small>{draft.socialLinks.length}</small>
            <span className={styles.chevronArrow}>▼</span>
          </div>
        </summary>
        <p className={styles.help}>Direct links to your Facebook, Instagram, TikTok, LinkedIn, YouTube, or Walker profile. Icons populate automatically.</p>
        <div className={styles.collection}>
          {draft.socialLinks.map((s, index) => (
            <article className={styles.item} key={s.id}>
              <div className={styles.itemToolbar}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  {getSocialIcon(s.url || s.title)}
                  <strong>{s.title || `Social Link #${index + 1}`}</strong>
                </div>
                <div>
                  <button type="button" className={styles.delete} onClick={() => removeItem("socialLinks", index)}>Delete</button>
                </div>
              </div>
              <div className={styles.grid}>
                <label>Platform Name<input placeholder="e.g. Facebook, Instagram, TikTok..." value={s.title} onChange={(e) => changeItem("socialLinks", index, "title", e.target.value)} /></label>
                <label>Social media page<input type="url" placeholder="Paste the page link here" value={s.url} onChange={(e) => changeItem("socialLinks", index, "url", e.target.value)} /></label>
              </div>
            </article>
          ))}
        </div>
        <button type="button" className={styles.add} onClick={() => addItem("socialLinks")}>+ Add Social Link</button>
      </details>

      {/* Cropper Modal Overlay */}
      {cropTarget && (
        <ImageCropperModal
          imageUrl={cropTarget.imageUrl}
          aspectRatio={cropTarget.aspectRatio}
          title={cropTarget.title}
          onCrop={cropTarget.onApply}
          onCancel={() => setCropTarget(null)}
        />
      )}

      {hasChanges && <section className={styles.bottomActions}>
        <button type="button" className={styles.publish} disabled={saving} onClick={saveChanges}>{saving ? "Saving…" : "Save"}</button>
        <button type="button" className={styles.secondary} disabled={saving} onClick={cancelChanges}>Cancel</button>
      </section>}
      {notice && <p className={styles.notice}>{notice}</p>}

      {postedDialog && (
        <div className={styles.dialogBackdrop} role="presentation">
          <section className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="posted-title">
            <span>✓</span>
            <h2 id="posted-title">Saved</h2>
            <p>Your changes are now live at /card/{profile.consultant_slug}.</p>
            <button type="button" onClick={() => setPostedDialog(false)}>Done</button>
          </section>
        </div>
      )}
    </main>
  );
}
