"use client";

import { ChangeEvent, DragEvent, useMemo, useRef, useState } from "react";
import styles from "./page.module.css";

type VehicleForm = {
  year: string;
  make: string;
  model: string;
  trim: string;
  vin: string;
  stock: string;
  mileage: string;
  price: string;
  walkerUrl: string;
  consultantUrl: string;
};

const initialForm: VehicleForm = {
  year: "",
  make: "",
  model: "",
  trim: "",
  vin: "",
  stock: "",
  mileage: "",
  price: "",
  walkerUrl: "",
  consultantUrl: "https://walker-next-docs-git-feature-trav-dig-b5f2fe-xrkr80hds-projects.vercel.app/card/trav",
};

export default function VehiclePostBuilder() {
  const [form, setForm] = useState(initialForm);
  const [photos, setPhotos] = useState<File[]>([]);
  const [notice, setNotice] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const prompt = useMemo(() => {
    const vehicle = [form.year, form.make, form.model, form.trim].filter(Boolean).join(" ");
    return `Create a polished Facebook vehicle post using the attached finished collage.

VERIFIED VEHICLE INFORMATION
Vehicle: ${vehicle || "[not entered]"}
VIN: ${form.vin || "[not entered]"}
Stock number: ${form.stock || "[not entered]"}
Mileage: ${form.mileage || "[not entered]"}
Price: ${form.price || "[not entered]"}
Official Walker listing: ${form.walkerUrl || "[not entered]"}
Consultant page: ${form.consultantUrl}

CONSULTANT
Travis Wilkinson
Walker Automotive
Call or text: 318-787-7887
Email: twilkinson@walkerautomotive.com

INSTRUCTIONS
1. Inspect the official Walker listing when browsing is available.
2. Use only facts verified by the listing or the information above.
3. Never invent equipment, incentives, discounts, availability, warranty coverage, financing terms, or payments.
4. Do not alter, redraw, replace, enhance, or regenerate the attached vehicle collage.
5. Write one concise, energetic Facebook caption with a strong opening and natural language.
6. Tell the reader to use the consultant-page link to call or text Travis.
7. Include the consultant-page link exactly as supplied.
8. If the official listing cannot be accessed, clearly rely only on the verified information above.
9. Return only the finished Facebook caption.`;
  }, [form]);

  const update = (key: keyof VehicleForm) => (event: ChangeEvent<HTMLInputElement>) => {
    setForm((current) => ({ ...current, [key]: event.target.value }));
  };

  const acceptFiles = (files: FileList | File[]) => {
    const incoming = Array.from(files).filter((file) => file.type.startsWith("image/")).slice(0, 4);
    setPhotos(incoming);
    setNotice(incoming.length ? `${incoming.length} photo${incoming.length === 1 ? "" : "s"} ready.` : "Choose image files.");
  };

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    acceptFiles(event.dataTransfer.files);
  };

  const createCollage = async () => {
    if (!photos.length) {
      setNotice("Add at least one vehicle photo first.");
      return;
    }

    const canvas = document.createElement("canvas");
    canvas.width = 1500;
    canvas.height = 1000;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.fillStyle = "#111317";
    context.fillRect(0, 0, canvas.width, canvas.height);

    const slots = photos.length === 1
      ? [{ x: 0, y: 0, w: 1500, h: 1000 }]
      : photos.length === 2
        ? [{ x: 0, y: 0, w: 750, h: 1000 }, { x: 750, y: 0, w: 750, h: 1000 }]
        : photos.length === 3
          ? [{ x: 0, y: 0, w: 1000, h: 1000 }, { x: 1000, y: 0, w: 500, h: 500 }, { x: 1000, y: 500, w: 500, h: 500 }]
          : [{ x: 0, y: 0, w: 750, h: 500 }, { x: 750, y: 0, w: 750, h: 500 }, { x: 0, y: 500, w: 750, h: 500 }, { x: 750, y: 500, w: 750, h: 500 }];

    await Promise.all(photos.map((file, index) => new Promise<void>((resolve, reject) => {
      const image = new Image();
      image.onload = () => {
        const slot = slots[index];
        const scale = Math.min((slot.w - 12) / image.width, (slot.h - 12) / image.height);
        const width = image.width * scale;
        const height = image.height * scale;
        const x = slot.x + (slot.w - width) / 2;
        const y = slot.y + (slot.h - height) / 2;
        context.drawImage(image, x, y, width, height);
        context.strokeStyle = "#2f333a";
        context.lineWidth = 6;
        context.strokeRect(slot.x + 3, slot.y + 3, slot.w - 6, slot.h - 6);
        URL.revokeObjectURL(image.src);
        resolve();
      };
      image.onerror = reject;
      image.src = URL.createObjectURL(file);
    })));

    const link = document.createElement("a");
    link.download = `${[form.year, form.make, form.model].filter(Boolean).join("-") || "walker-vehicle"}-collage.jpg`;
    link.href = canvas.toDataURL("image/jpeg", 0.94);
    link.click();
    setNotice("3:2 collage downloaded. No vehicle photo was regenerated.");
  };

  const copyPrompt = async () => {
    await navigator.clipboard.writeText(prompt);
    setNotice("GPT prompt copied.");
  };

  const downloadPrompt = () => {
    const blob = new Blob([prompt], { type: "text/plain;charset=utf-8" });
    const link = document.createElement("a");
    link.download = `${[form.year, form.make, form.model].filter(Boolean).join("-") || "walker-vehicle"}-gpt-prompt.txt`;
    link.href = URL.createObjectURL(blob);
    link.click();
    URL.revokeObjectURL(link.href);
    setNotice("GPT prompt downloaded.");
  };

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.header}>
          <p>Consultant backend</p>
          <h1>Vehicle Post Builder</h1>
          <span>Build assets here. Nothing is shared from the public profile.</span>
        </header>

        <details className={styles.panel} open>
          <summary><span>01</span> Vehicle information</summary>
          <div className={styles.panelBody}>
            <div className={styles.grid}>
              <label>Year<input inputMode="numeric" value={form.year} onChange={update("year")} /></label>
              <label>Make<input value={form.make} onChange={update("make")} /></label>
              <label>Model<input value={form.model} onChange={update("model")} /></label>
              <label>Trim<input value={form.trim} onChange={update("trim")} /></label>
              <label>VIN<input value={form.vin} onChange={update("vin")} /></label>
              <label>Stock number<input value={form.stock} onChange={update("stock")} /></label>
              <label>Mileage<input inputMode="numeric" value={form.mileage} onChange={update("mileage")} /></label>
              <label>Price<input value={form.price} onChange={update("price")} /></label>
            </div>
            <label>Official Walker listing<input type="url" value={form.walkerUrl} onChange={update("walkerUrl")} /></label>
            <label>Consultant page<input type="url" value={form.consultantUrl} onChange={update("consultantUrl")} /></label>
          </div>
        </details>

        <details className={styles.panel} open>
          <summary><span>02</span> Vehicle photos</summary>
          <div className={styles.panelBody}>
            <div
              className={styles.dropzone}
              onDragOver={(event) => event.preventDefault()}
              onDrop={onDrop}
              onClick={() => inputRef.current?.click()}
              role="button"
              tabIndex={0}
              onKeyDown={(event) => { if (event.key === "Enter") inputRef.current?.click(); }}
            >
              <strong>Drag and drop up to four photos</strong>
              <span>or tap to browse</span>
              <input
                ref={inputRef}
                hidden
                type="file"
                accept="image/*"
                multiple
                onChange={(event) => event.target.files && acceptFiles(event.target.files)}
              />
            </div>
            {!!photos.length && (
              <div className={styles.fileList}>
                {photos.map((photo) => <span key={photo.name}>{photo.name}</span>)}
              </div>
            )}
            <button className={styles.primary} type="button" onClick={createCollage}>Confirm and download 3:2 collage</button>
          </div>
        </details>

        <details className={styles.panel}>
          <summary><span>03</span> GPT post prompt</summary>
          <div className={styles.panelBody}>
            <textarea className={styles.prompt} value={prompt} readOnly aria-label="Generated GPT vehicle-post prompt" />
            <div className={styles.actions}>
              <button className={styles.primary} type="button" onClick={copyPrompt}>Copy prompt</button>
              <button className={styles.secondary} type="button" onClick={downloadPrompt}>Download prompt</button>
            </div>
          </div>
        </details>

        <p className={styles.notice} aria-live="polite">{notice || "Enter verified information, then create the assets."}</p>
      </div>
    </main>
  );
}
