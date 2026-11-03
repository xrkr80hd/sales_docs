"use client";
import { useEffect, useState, type ChangeEvent } from "react";
import { ChevronDown, ImagePlus, X } from "lucide-react";
import { useSession } from "@/components/auth/supabase-session-gate";
import { notifySave } from "@/components/ui/save-toast-host";
import { addWhyPhoto, cachedWhy, loadWhy, removeWhyPhoto, saveWhy } from "@/lib/why-client";
import { ImageCropperModal } from "@/components/ui/image-cropper-modal";
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
  // Photos waiting to be cropped, one at a time, before they upload.
  const [queue, setQueue] = useState<{ name: string; url: string }[]>([]);

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

  // Pick photos → crop each to the Home slideshow's 16:9 shape → upload the crop.
  function pick(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files || []); event.target.value = "";
    if (!files.length) return;
    setError(""); setMessage("");
    const room = Math.max(0, MAX_PHOTOS - photos.length);
    if (files.length > room) setError(`Your album holds up to ${MAX_PHOTOS} photos.`);
    for (const file of files.slice(0, room)) {
      if (!file.type.startsWith("image/")) { setError(`${file.name} is not a photo.`); continue; }
      if (file.size > 25 * 1024 * 1024) { setError(`${file.name} is larger than 25 MB.`); continue; }
      const reader = new FileReader();
      reader.onload = () => setQueue(current => [...current, { name: file.name, url: String(reader.result) }]);
      reader.readAsDataURL(file);
    }
  }

  async function upload(croppedDataUrl: string) {
    const current = queue[0];
    setQueue(rest => rest.slice(1));
    if (!current) return;
    setBusy(true); setError("");
    try {
      const blob = await (await fetch(croppedDataUrl)).blob();
      const file = new File([blob], current.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" });
      if (file.size > 8 * 1024 * 1024) throw new Error("That crop is too large. Zoom in a little and try again.");
      const value = await addWhyPhoto(token, file);
      setPhotos(value.photos);
      setMessage("Photo added to your album.");
    } catch (failure) { setError(failure instanceof Error ? failure.message : "The photo could not be added."); }
    finally { setBusy(false); }
  }

  async function remove(url: string) {
    setBusy(true); setError(""); setMessage("");
    try { const value = await removeWhyPhoto(token, url); setPhotos(value.photos); setMessage("Photo removed."); }
    catch (failure) { setError(failure instanceof Error ? failure.message : "The photo could not be removed."); }
    finally { setBusy(false); }
  }

  return <><details className={styles.section} open>
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
            <input type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={busy} onChange={pick} aria-label="Add photos to your why album" />
          </label>}
        </div>
        <small className={styles.whyHint}>Family, goals, places you&apos;re working toward. Each photo is cropped to widescreen (16:9) for your Home slideshow. Best size: 1920 × 1080 or larger.</small>
      </div>
      {message && <p className={styles.status} role="status">{message}</p>}
      {error && <p className={styles.error} role="alert">{error}</p>}
    </div>
  </details>
    {queue[0] && <ImageCropperModal key={queue[0].url.slice(-40) + queue.length} imageUrl={queue[0].url} aspectRatio="16:9" title={queue.length > 1 ? `Crop for your Home slideshow (${queue.length} left)` : "Crop for your Home slideshow"} onCrop={croppedDataUrl => void upload(croppedDataUrl)} onCancel={() => setQueue(rest => rest.slice(1))} />}
  </>;
}
