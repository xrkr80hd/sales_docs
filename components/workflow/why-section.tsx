"use client";
import { useEffect, useState, type ChangeEvent } from "react";
import { ChevronDown, ImagePlus, X } from "lucide-react";
import { useSession } from "@/components/auth/supabase-session-gate";
import { notifySave } from "@/components/ui/save-toast-host";
import { addWhyPhoto, cachedWhy, loadWhy, removeWhyPhoto, saveWhy } from "@/lib/why-client";
import styles from "./consultant-setup.module.css";

const MAX_PHOTOS = 12;

/** Consultant Set Up → "Your Why": the statement and photo album shown on the Home page. */
export function WhySection() {
  const { accessToken } = useSession();
  const token = accessToken || "";
  const [why, setWhy] = useState(() => cachedWhy(token)?.why ?? "");
  const [saved, setSaved] = useState(() => cachedWhy(token)?.why ?? "");
  const [photos, setPhotos] = useState<string[]>(() => cachedWhy(token)?.photos ?? []);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) return;
    let alive = true;
    loadWhy(token).then(value => { if (!alive) return; setWhy(value.why); setSaved(value.why); setPhotos(value.photos); })
      .catch(failure => { if (alive) setError(failure instanceof Error ? failure.message : "Your why could not load."); });
    return () => { alive = false; };
  }, [token]);

  async function save() {
    setBusy(true); setError(""); setMessage(""); notifySave("saving", "Saving your why…");
    try { const value = await saveWhy(token, why); setSaved(value.why); setWhy(value.why); setMessage("Your why is saved. It shows on your Home page."); notifySave("success", "Your why is saved."); }
    catch (failure) { const text = failure instanceof Error ? failure.message : "Could not save. Your words are still here."; setError(text); notifySave("error", text); }
    finally { setBusy(false); }
  }

  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files || []); event.target.value = "";
    if (!files.length) return;
    setBusy(true); setError(""); setMessage("");
    let added = 0;
    try {
      for (const file of files.slice(0, Math.max(0, MAX_PHOTOS - photos.length))) {
        if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) throw new Error(`${file.name}: choose JPG, PNG, or WebP photos.`);
        if (file.size > 8 * 1024 * 1024) throw new Error(`${file.name} is larger than 8 MB.`);
        const value = await addWhyPhoto(token, file);
        setPhotos(value.photos); added++;
      }
      if (files.length > MAX_PHOTOS - photos.length) setError(`Your album holds up to ${MAX_PHOTOS} photos.`);
      if (added) setMessage(added === 1 ? "Photo added to your album." : `${added} photos added to your album.`);
    } catch (failure) { setError(failure instanceof Error ? failure.message : "A photo could not be added."); }
    finally { setBusy(false); }
  }

  async function remove(url: string) {
    setBusy(true); setError(""); setMessage("");
    try { const value = await removeWhyPhoto(token, url); setPhotos(value.photos); setMessage("Photo removed."); }
    catch (failure) { setError(failure instanceof Error ? failure.message : "The photo could not be removed."); }
    finally { setBusy(false); }
  }

  return <details className={styles.section} open>
    <summary><div><h3>Your Why</h3><p>Write it out or list it, one reason per line. Add photos too. Both show on your Home page.</p></div><ChevronDown size={18} /></summary>
    <div className={styles.fields}>
      <label>Your why
        <textarea className={styles.whyText} value={why} maxLength={800} rows={5} disabled={busy} placeholder={"One reason per line, or write it out:\nMy kids' college fund\nA house with a yard\nTaking my mom on the trip she's always wanted"} onChange={event => setWhy(event.target.value)} />
      </label>
      <div className={styles.whyActions}>
        <button type="button" className={styles.whySave} disabled={busy || why === saved} onClick={() => void save()}>{busy ? "Saving…" : why === saved ? "Saved" : "Save my why"}</button>
        <small>{why.length}/800</small>
      </div>
      <div>
        <p className={styles.whyLabel}>Photo album · {photos.length}/{MAX_PHOTOS}</p>
        <div className={styles.album}>
          {photos.map(url => <figure key={url}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt="A photo from your why album" loading="lazy" />
            <button type="button" aria-label="Remove this photo" disabled={busy} onClick={() => void remove(url)}><X size={14} /></button>
          </figure>)}
          {photos.length < MAX_PHOTOS && <label className={styles.albumAdd}><ImagePlus size={22} /><span>Add photos</span>
            <input type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={busy} onChange={upload} aria-label="Add photos to your why album" />
          </label>}
        </div>
        <small className={styles.whyHint}>Family, goals, places you&apos;re working toward. JPG, PNG or WebP · up to 8 MB each.</small>
      </div>
      {message && <p className={styles.status} role="status">{message}</p>}
      {error && <p className={styles.error} role="alert">{error}</p>}
    </div>
  </details>;
}
