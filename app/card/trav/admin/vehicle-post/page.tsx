"use client";

import { ChangeEvent, DragEvent, useMemo, useRef, useState } from "react";
import styles from "./page.module.css";

type VehicleForm = {
  year: string; make: string; model: string; trim: string; vin: string;
  stock: string; mileage: string; price: string; walkerUrl: string; consultantUrl: string;
};

type CropPhoto = {
  id: string;
  file: File;
  url: string;
  zoom: number;
  x: number;
  y: number;
};

const initialForm: VehicleForm = {
  year: "", make: "", model: "", trim: "", vin: "", stock: "", mileage: "", price: "", walkerUrl: "",
  consultantUrl: "https://walker-next-docs-git-feature-trav-dig-b5f2fe-xrkr80hds-projects.vercel.app/card/trav",
};

export default function VehiclePostBuilder() {
  const [form, setForm] = useState(initialForm);
  const [photos, setPhotos] = useState<CropPhoto[]>([]);
  const [notice, setNotice] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const prompt = useMemo(() => {
    const vehicle = [form.year, form.make, form.model, form.trim].filter(Boolean).join(" ");
    return `Create a polished Facebook vehicle post using the attached finished 3:2 collage.

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
4. Keep the supplied vehicle and its identifying details exact. Never change its color, trim, wheels, badges, body, equipment, or surroundings in a misleading way.
5. The finished design must fill a true 3:2 picture frame edge-to-edge with a professional composition. If background extension is required, extend only the surrounding background; never regenerate or modify the vehicle itself.
6. Do not add text over the vehicle unless specifically requested.
7. Write one concise, energetic Facebook caption with a strong opening and natural language.
8. Tell the reader to use the consultant-page link to call or text Travis.
9. Include the consultant-page link exactly as supplied.
10. If the official listing cannot be accessed, rely only on the verified information above.
11. Return the finished Facebook caption separately from any image output.`;
  }, [form]);

  const update = (key: keyof VehicleForm) => (event: ChangeEvent<HTMLInputElement>) => {
    setForm((current) => ({ ...current, [key]: event.target.value }));
  };

  const acceptFiles = (files: FileList | File[]) => {
    photos.forEach((photo) => URL.revokeObjectURL(photo.url));
    const incoming = Array.from(files).filter((file) => file.type.startsWith("image/")).slice(0, 4);
    setPhotos(incoming.map((file, index) => ({
      id: `${file.name}-${file.lastModified}-${index}`,
      file,
      url: URL.createObjectURL(file),
      zoom: 1,
      x: 50,
      y: 50,
    })));
    setNotice(incoming.length ? "Photos loaded. Crop each frame before downloading." : "Choose image files.");
  };

  const setCrop = (id: string, key: "zoom" | "x" | "y", value: number) => {
    setPhotos((current) => current.map((photo) => photo.id === id ? { ...photo, [key]: value } : photo));
  };

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    acceptFiles(event.dataTransfer.files);
  };

  const drawCropped = (
    context: CanvasRenderingContext2D,
    image: HTMLImageElement,
    slot: { x: number; y: number; w: number; h: number },
    photo: CropPhoto,
  ) => {
    const slotRatio = slot.w / slot.h;
    const imageRatio = image.width / image.height;
    let cropWidth = image.width;
    let cropHeight = image.height;

    if (imageRatio > slotRatio) cropWidth = image.height * slotRatio;
    else cropHeight = image.width / slotRatio;

    cropWidth /= photo.zoom;
    cropHeight /= photo.zoom;
    const sourceX = (image.width - cropWidth) * (photo.x / 100);
    const sourceY = (image.height - cropHeight) * (photo.y / 100);
    context.drawImage(image, sourceX, sourceY, cropWidth, cropHeight, slot.x, slot.y, slot.w, slot.h);
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

    await Promise.all(photos.map((photo, index) => new Promise<void>((resolve, reject) => {
      const image = new Image();
      image.onload = () => {
        drawCropped(context, image, slots[index], photo);
        context.strokeStyle = "#111317";
        context.lineWidth = 8;
        context.strokeRect(slots[index].x + 4, slots[index].y + 4, slots[index].w - 8, slots[index].h - 8);
        resolve();
      };
      image.onerror = reject;
      image.src = photo.url;
    })));

    const link = document.createElement("a");
    link.download = `${[form.year, form.make, form.model].filter(Boolean).join("-") || "walker-vehicle"}-collage.jpg`;
    link.href = canvas.toDataURL("image/jpeg", 0.95);
    link.click();
    setNotice("True 3:2 edge-to-edge collage downloaded.");
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
          <span>Crop real photos, build the collage, and prepare the post. Nothing is shared publicly here.</span>
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
          <summary><span>02</span> Upload and crop photos</summary>
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
              <input ref={inputRef} hidden type="file" accept="image/*" multiple onChange={(event) => event.target.files && acceptFiles(event.target.files)} />
            </div>

            {!!photos.length && (
              <div className={styles.cropList}>
                {photos.map((photo, index) => (
                  <article className={styles.cropCard} key={photo.id}>
                    <div className={styles.cropTitle}><strong>Photo {index + 1}</strong><span>3:2 preview</span></div>
                    <div className={styles.cropViewport}>
                      <img
                        src={photo.url}
                        alt={`Crop preview for ${photo.file.name}`}
                        style={{
                          width: `${photo.zoom * 100}%`,
                          height: `${photo.zoom * 100}%`,
                          objectFit: "cover",
                          objectPosition: `${photo.x}% ${photo.y}%`,
                        }}
                      />
                    </div>
                    <div className={styles.cropControls}>
                      <label>Zoom<input type="range" min="1" max="2.5" step=".01" value={photo.zoom} onChange={(event) => setCrop(photo.id, "zoom", Number(event.target.value))} /></label>
                      <label>Move left/right<input type="range" min="0" max="100" value={photo.x} onChange={(event) => setCrop(photo.id, "x", Number(event.target.value))} /></label>
                      <label>Move up/down<input type="range" min="0" max="100" value={photo.y} onChange={(event) => setCrop(photo.id, "y", Number(event.target.value))} /></label>
                    </div>
                  </article>
                ))}
              </div>
            )}
            <button className={styles.primary} type="button" onClick={createCollage}>Confirm crops and download 3:2 collage</button>
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
