"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import { Camera, ChevronDown, UserRound, X } from "lucide-react";
import { fetchServerSettings, loadConsultant, loadDealer, saveConsultant, saveDealer, saveServerSettings, type ConsultantInfo, type DealerInfo } from "@/lib/dealer-consultant";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { useWorkspaceIdentity } from "@/components/command-center/workspace-context";
import { ROLE_LABELS, type WorkspaceRole } from "@/lib/workspace-roles";
import { LinksEditor } from "@/components/consultant-links/links-editor";
import styles from "./consultant-setup.module.css";

export function SettingsDrawer({ onClose }: { onClose: () => void }) {
  const identity = useWorkspaceIdentity();
  const [dealer, setDealer] = useState<DealerInfo>(() => loadDealer());
  const [consultant, setConsultant] = useState<ConsultantInfo>(() => loadConsultant());
  const [photo, setPhoto] = useState(identity?.profileImageUrl || "");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const dialogRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    let active = true;
    void fetchServerSettings().then((server) => {
      if (!active) return;
      if (server) {
        setDealer(server.dealer);
        setConsultant(server.consultant);
        saveDealer(server.dealer);
        saveConsultant(server.consultant);
      } else if (identity?.dealership) setDealer(current => ({ ...current, dealershipName: identity.dealership || "" }));
      setLoading(false);
    });
    closeRef.current?.focus();
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key !== "Tab") return;
      const controls = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), a[href], summary') || []).filter(element => element.getClientRects().length > 0);
      const first = controls[0], last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener("keydown", handleKey);
    return () => { active = false; document.removeEventListener("keydown", handleKey); };
  // Opening the drawer loads the current account settings once.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  async function save() {
    setSaving(true); setError(""); setStatus("");
    const ok = await saveServerSettings(dealer, consultant);
    if (ok) {
      saveDealer(dealer); saveConsultant(consultant);
      window.dispatchEvent(new Event("consultant-profile-updated"));
      setStatus("Consultant setup saved. Your documents will use these details.");
    } else if (process.env.NEXT_PUBLIC_DISABLE_AUTH === "1") {
      saveDealer(dealer); saveConsultant(consultant);
      setStatus("Saved for local verification only. No live account was changed.");
    } else setError("Could not save to your account. Your changes are still here; please try again.");
    setSaving(false);
  }
  async function uploadPhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; event.target.value = "";
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 3 * 1024 * 1024) { setError("Choose a JPG, PNG, or WebP photo up to 3 MB."); return; }
    setSaving(true); setError(""); setStatus("");
    try {
      const { data } = await getSupabaseBrowserClient().auth.getSession();
      if (!data.session) throw new Error("Sign in to save your profile photo.");
      const form = new FormData(); form.set("file", file);
      const response = await fetch("/api/me/photo", { method: "POST", headers: { Authorization: `Bearer ${data.session.access_token}` }, body: form });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not save your photo.");
      setPhoto(result.profileImageUrl);
      window.dispatchEvent(new Event("consultant-profile-updated"));
      setStatus("Profile photo saved.");
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Could not save your photo."); }
    finally { setSaving(false); }
  }
  return <div className={styles.overlay}>
    <button className={styles.backdrop} onClick={onClose} aria-label="Close consultant setup" tabIndex={-1} />
    <aside ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="setup-title" className={styles.drawer}>
      <header className={styles.header}><div><p>YOUR WORKSPACE</p><h2 id="setup-title">Consultant Setup</h2></div><button ref={closeRef} onClick={onClose} aria-label="Close consultant setup"><X /></button></header>
      <div className={styles.content}>
        <section className={styles.photoSection}>
          <div className={styles.photo}>{photo ? <Image src={photo} alt="Your profile photo" width={84} height={84} unoptimized /> : <UserRound size={36} />}</div>
          <div><h3>Organization profile</h3><p>{identity?.displayName || "Your name"}</p><p>{ROLE_LABELS[(identity?.workspaceRole || identity?.role || "user") as WorkspaceRole]} · {identity?.dealership || "Unassigned"}</p><p>Internal staff photo. Separate from your public business card.</p><label className={styles.upload}><Camera size={16} />Upload photo<input type="file" accept="image/jpeg,image/png,image/webp" aria-label="Upload profile picture" onChange={uploadPhoto} disabled={saving || loading} /></label><small>JPG, PNG or WebP · up to 3 MB</small></div>
        </section>
        {status && <p className={styles.status} role="status">{status}</p>}{error && <p className={styles.error} role="alert">{error}</p>}
        <Link href="/business-card" onClick={onClose} className={styles.adminLink}>Edit public business card separately</Link>
        <LinksEditor />
        <form onSubmit={event => { event.preventDefault(); void save(); }}>
          <fieldset disabled={saving || loading}>
            <details className={styles.section} open><summary><div><h3>Consultant information</h3><p>Your contact details for documents and tools</p></div><ChevronDown size={18} /></summary><div className={styles.fields}>
              {([["name", "Name", "text"], ["phone", "Phone number", "tel"], ["email", "Email address", "email"], ["salespersonNumber", "Salesperson #", "text"]] as const).map(([field,label,type]) => <label key={field}>{label}<input type={type} value={consultant[field]} onChange={event => setConsultant(current => ({ ...current, [field]: event.target.value }))} autoComplete={field === "name" ? "name" : field === "phone" ? "tel" : field === "email" ? "email" : "off"} /></label>)}
            </div></details>
            <details className={styles.section}><summary><div><h3>Dealership</h3><p>{identity?.dealership ? `Organization: ${identity.dealership}` : "Your dealership information"}</p></div><ChevronDown size={18} /></summary><div className={styles.fields}>
              {([["dealershipName", "Dealership name"], ["street", "Street address"], ["city", "City"], ["state", "State"], ["zip", "ZIP"]] as const).map(([field,label]) => <label key={field}>{label}<input value={dealer[field]} readOnly={Boolean(identity?.organizationId)} onChange={event => setDealer(current => ({ ...current, [field]: event.target.value }))} /></label>)}
              {identity?.organizationId && <p className={styles.help}>This address is managed in Organization settings and automatically used on warranty forms.</p>}
            </div></details>
            <p className={styles.help}>These internal details populate your documents and vehicle tools. Your public business card has its own name, photo, and contact details.</p>
            <button type="submit" className={styles.save}>{loading ? "Loading account…" : saving ? "Saving…" : "Save consultant setup"}</button>
          </fieldset>
        </form>
        {(identity?.role === "admin" || identity?.email === "xrkr80hd@gmail.com") && <Link href="/admin" onClick={onClose} className={styles.adminLink}>Team Management</Link>}
      </div>
    </aside>
  </div>;
}
