"use client";

import { ChangeEvent, DragEvent, useEffect, useMemo, useRef, useState } from "react";
import styles from "./page.module.css";

type VehicleForm = {
  year: string; make: string; model: string; trim: string; vin: string;
  stock: string; mileage: string; price: string; walkerUrl: string; consultantUrl: string;
};

type CropPhoto = { id: string; file: File; url: string; zoom: number; x: number; y: number; };
type Slot = { x: number; y: number; w: number; h: number; };

const disclaimer = "This page is not a buy, sell, or trade platform. All vehicle availability, pricing, financing, trade evaluations, and transactions are handled exclusively through Walker Automotive. Information is subject to verification.";

const initialForm: VehicleForm = {
  year: "", make: "", model: "", trim: "", vin: "", stock: "", mileage: "", price: "", walkerUrl: "",
  consultantUrl: "https://walker-next-docs-git-feature-trav-dig-b5f2fe-xrkr80hds-projects.vercel.app/card/trav",
};

// The collage is always 16:9, but each photo has a locked source shape:
 // Photo 1 = 3:2 landscape. Photos 2-4 = 2:3 portrait.
const getSlots = (count: number): Slot[] => count === 1
  ? [{ x: 150, y: 40, w: 1620, h: 1080 }]
  : count === 2
    ? [{ x: 40, y: 140, w: 1200, h: 800 }, { x: 1347, y: 140, w: 533, h: 800 }]
    : count === 3
      ? [{ x: 40, y: 140, w: 1200, h: 800 }, { x: 1440, y: 40, w: 320, h: 480 }, { x: 1440, y: 560, w: 320, h: 480 }]
      : [{ x: 40, y: 140, w: 1200, h: 800 }, { x: 1320, y: 40, w: 320, h: 480 }, { x: 1640, y: 40, w: 240, h: 360 }, { x: 1480, y: 600, w: 280, h: 420 }];

const getPhotoRequirement = (index: number) => index === 0
  ? "3:2 landscape"
  : "2:3 portrait";

const drawCropped = (context: CanvasRenderingContext2D, image: HTMLImageElement, slot: Slot, photo: CropPhoto) => {
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

const renderCollage = async (canvas: HTMLCanvasElement, photos: CropPhoto[], selected = -1) => {
  canvas.width = 1920;
  canvas.height = 1080;
  const context = canvas.getContext("2d");
  if (!context) return;
  context.fillStyle = "#111317";
  context.fillRect(0, 0, canvas.width, canvas.height);
  const slots = getSlots(photos.length);

  await Promise.all(photos.map((photo, index) => new Promise<void>((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      drawCropped(context, image, slots[index], photo);
      context.strokeStyle = "#111317";
      context.lineWidth = 10;
      context.strokeRect(slots[index].x + 5, slots[index].y + 5, slots[index].w - 10, slots[index].h - 10);
      if (index === selected) {
        context.strokeStyle = "#ef3b3b";
        context.lineWidth = 12;
        context.strokeRect(slots[index].x + 8, slots[index].y + 8, slots[index].w - 16, slots[index].h - 16);
      }
      resolve();
    };
    image.onerror = reject;
    image.src = photo.url;
  })));
};

export default function VehiclePostBuilder() {
  const [form, setForm] = useState(initialForm);
  const [photos, setPhotos] = useState<CropPhoto[]>([]);
  const [selectedPhoto, setSelectedPhoto] = useState(0);
  const [selectedCaption, setSelectedCaption] = useState(0);
  const [notice, setNotice] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const previewRef = useRef<HTMLCanvasElement>(null);
  const dragRef = useRef<{ index: number; startX: number; startY: number; initialX: number; initialY: number } | null>(null);

  useEffect(() => {
    if (!previewRef.current) return;
    void renderCollage(previewRef.current, photos, selectedPhoto);
  }, [photos, selectedPhoto]);

  const prompt = useMemo(() => {
    const vehicle = [form.year, form.make, form.model, form.trim].filter(Boolean).join(" ");
    return `Create a polished Facebook vehicle post using the attached finished 16:9 collage.

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
4. Keep the supplied vehicle exact. Never change its color, trim, wheels, badges, body, equipment, or surroundings in a misleading way.
5. The finished design must fill a true 16:9 frame edge-to-edge. If background extension is required, extend only the surrounding background; never regenerate or modify the vehicle.
6. Do not add text over the vehicle unless specifically requested.
7. Write one concise, energetic Facebook caption with a strong opening and natural language.
8. Tell the reader to use the consultant-page link to call or text Travis.
9. Include the consultant-page link exactly as supplied.
10. If the official listing cannot be accessed, rely only on the verified information above.
11. Return the Facebook caption separately from any image output.`;
  }, [form]);

  const captions = useMemo(() => {
    const vehicle = [form.year, form.make, form.model, form.trim].filter(Boolean).join(" ") || "this vehicle";
    const details = [
      form.price && `Price: ${form.price}`,
      form.mileage && `Mileage: ${form.mileage}`,
      form.stock && `Stock #${form.stock}`,
      form.vin && `VIN: ${form.vin}`,
    ].filter(Boolean).join(" · ");
    const link = form.walkerUrl || form.consultantUrl;
    const finish = `\n\nView the official Walker listing and contact Travis: ${link}\n\n${disclaimer}`;

    return [
      { title: "Just arrived", text: `Just arrived at Walker Automotive: ${vehicle}. ${details || "Message me for verified vehicle details."}${finish}` },
      { title: "Straight to the details", text: `${vehicle}\n${details || "Contact me for current price, mileage, and availability."}\n\nTake a closer look and let me know what questions you have.${finish}` },
      { title: "Weekend spotlight", text: `Weekend vehicle spotlight: ${vehicle}. ${details || "Check the official listing for complete details."}\n\nWould you put this one in your driveway?${finish}` },
      { title: "Feature-focused", text: `Take a closer look at this ${vehicle}. Browse the photos, review the verified equipment on the official Walker listing, and contact me when you are ready to see it in person. ${details}${finish}` },
      { title: "Question opener", text: `What is the first thing you would check out on this ${vehicle}? ${details || "The official listing has the current vehicle information."}\n\nSee the full listing and photos below.${finish}` },
      { title: "Simple and clean", text: `${vehicle} available through Walker Automotive. ${details || "Current details are available on the official listing."}\n\nCall or text Travis with questions or to schedule a visit.${finish}` },
      { title: "Photo carousel", text: `Swipe through for a complete look at this ${vehicle}. ${details || "Use the link for verified details and availability."}\n\nSee something you like? Reach out to Travis at Walker Automotive.${finish}` },
      { title: "Value spotlight", text: `Looking for your next vehicle? Start with this ${vehicle}. ${details || "Review the official listing for current pricing and vehicle information."}\n\nI can help you confirm the details and arrange a visit at Walker Automotive.${finish}` },
      { title: "Direct call to action", text: `Interested in this ${vehicle}? ${details || "Check the official Walker listing for current details."}\n\nOpen the listing, review the photos, then call or text Travis to take the next step.${finish}` },
      { title: "Conversation starter", text: `Could this ${vehicle} be the right fit for you? ${details || "All current information is available through Walker Automotive."}\n\nTake a look through the photos and tell me what you want to know.${finish}` },
    ];
  }, [form]);

  const update = (key: keyof VehicleForm) => (event: ChangeEvent<HTMLInputElement>) => {
    setForm((current) => ({ ...current, [key]: event.target.value }));
  };

  const acceptFiles = (files: FileList | File[]) => {
    photos.forEach((photo) => URL.revokeObjectURL(photo.url));
    const incoming = Array.from(files).filter((file) => file.type.startsWith("image/")).slice(0, 4);
    setPhotos(incoming.map((file, index) => ({
      id: `${file.name}-${file.lastModified}-${index}`, file, url: URL.createObjectURL(file), zoom: 1, x: 50, y: 50,
    })));
    setSelectedPhoto(0);
    setNotice(incoming.length
      ? "Fresh crop loaded. Photo 1 is landscape; every remaining photo is portrait."
      : "Choose image files.");
  };

  const chooseSlot = (clientX: number, clientY: number) => {
    const canvas = previewRef.current;
    if (!canvas) return -1;
    const rect = canvas.getBoundingClientRect();
    const x = (clientX - rect.left) * (1920 / rect.width);
    const y = (clientY - rect.top) * (1080 / rect.height);
    const slots = getSlots(photos.length);
    for (let index = slots.length - 1; index >= 0; index -= 1) {
      const slot = slots[index];
      if (x >= slot.x && x <= slot.x + slot.w && y >= slot.y && y <= slot.y + slot.h) return index;
    }
    return -1;
  };

  const startDrag = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const index = chooseSlot(event.clientX, event.clientY);
    if (index < 0) return;
    setSelectedPhoto(index);
    const photo = photos[index];
    dragRef.current = { index, startX: event.clientX, startY: event.clientY, initialX: photo.x, initialY: photo.y };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const moveDrag = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const drag = dragRef.current;
    const canvas = previewRef.current;
    if (!drag || !canvas) return;
    const rect = canvas.getBoundingClientRect();
    const slot = getSlots(photos.length)[drag.index];
    const slotWidth = rect.width * (slot.w / 1920);
    const slotHeight = rect.height * (slot.h / 1080);
    const nextX = Math.max(0, Math.min(100, drag.initialX - ((event.clientX - drag.startX) / slotWidth) * 100));
    const nextY = Math.max(0, Math.min(100, drag.initialY - ((event.clientY - drag.startY) / slotHeight) * 100));
    setPhotos((current) => current.map((photo, index) => index === drag.index ? { ...photo, x: nextX, y: nextY } : photo));
  };

  const stopDrag = (event: React.PointerEvent<HTMLCanvasElement>) => {
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };

  const adjustZoom = (amount: number) => {
    setPhotos((current) => current.map((photo, index) => index === selectedPhoto
      ? { ...photo, zoom: Math.max(1, Math.min(2.5, Number((photo.zoom + amount).toFixed(2)))) }
      : photo));
  };

  const removePhoto = (indexToRemove: number) => {
    setPhotos((current) => {
      URL.revokeObjectURL(current[indexToRemove].url);
      return current.filter((_, index) => index !== indexToRemove);
    });
    setSelectedPhoto((current) => Math.max(0, Math.min(current > indexToRemove ? current - 1 : current, photos.length - 2)));
    setNotice(`Photo ${indexToRemove + 1} removed. Remaining photos reflowed.`);
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
    await renderCollage(canvas, photos);
    const link = document.createElement("a");
    link.download = `${[form.year, form.make, form.model].filter(Boolean).join("-") || "walker-vehicle"}-16x9-collage.jpg`;
    link.href = canvas.toDataURL("image/jpeg", 0.95);
    link.click();
    setNotice("Downloaded exactly as shown in the final 16:9 preview.");
  };

  const copyCaption = async () => {
    await navigator.clipboard.writeText(captions[selectedCaption].text);
    setNotice(`${captions[selectedCaption].title} post copied.`);
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

  const active = photos[selectedPhoto];

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.header}>
          <p>Consultant backend</p>
          <h1>Vehicle Post Builder</h1>
          <span>Build a true 1920 × 1080 collage. What you see is exactly what downloads.</span>
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
            <div className={styles.dropzone} onDragOver={(event) => event.preventDefault()} onDrop={onDrop} onClick={() => inputRef.current?.click()} role="button" tabIndex={0} onKeyDown={(event) => { if (event.key === "Enter") inputRef.current?.click(); }}>
              <strong>Drag and drop up to four photos</strong>
              <span>Photo 1: 3:2 landscape · Photos 2–4: 2:3 portrait</span>
              <span>or tap to browse</span>
              <input ref={inputRef} hidden type="file" accept="image/*" multiple onChange={(event) => event.target.files && acceptFiles(event.target.files)} />
            </div>

            <div className={styles.slotGuide} aria-label="Required collage photo shapes">
              <div><strong>Photo 1</strong><span>3:2 Landscape</span></div>
              <div><strong>Photo 2</strong><span>2:3 Portrait</span></div>
              <div><strong>Photo 3</strong><span>2:3 Portrait</span></div>
              <div><strong>Photo 4</strong><span>2:3 Portrait</span></div>
            </div>

            {!!photos.length && (
              <section className={styles.finalCrop}>
                <div className={styles.finalCropHeading}><strong>Final 16:9 collage preview</strong><span>1920 × 1080</span></div>
                <div className={styles.previewStage}>
                  <canvas
                    ref={previewRef}
                    className={styles.collageCanvas}
                    aria-label="Final vehicle collage preview. Select and drag a photo to reposition it."
                    onPointerDown={startDrag}
                    onPointerMove={moveDrag}
                    onPointerUp={stopDrag}
                    onPointerCancel={stopDrag}
                  />
                  {getSlots(photos.length).map((slot, index) => (
                    <button
                      key={photos[index].id}
                      className={styles.removePhoto}
                      type="button"
                      aria-label={`Remove photo ${index + 1}`}
                      title={`Remove photo ${index + 1}`}
                      style={{ left: `${((slot.x + 18) / 1920) * 100}%`, top: `${((slot.y + 18) / 1080) * 100}%` }}
                      onClick={() => removePhoto(index)}
                    >
                      ×
                    </button>
                  ))}
                </div>
                <div className={styles.cropToolbar}>
                  <span>Photo {selectedPhoto + 1} · {getPhotoRequirement(selectedPhoto)} — drag to reposition</span>
                  <div>
                    <button type="button" disabled={!active || active.zoom <= 1} onClick={() => adjustZoom(-0.1)} aria-label="Zoom selected photo out">−</button>
                    <strong>{active ? Math.round(active.zoom * 100) : 100}%</strong>
                    <button type="button" onClick={() => adjustZoom(0.1)} aria-label="Zoom selected photo in">+</button>
                  </div>
                </div>
              </section>
            )}
            <button className={styles.primary} type="button" onClick={createCollage}>Confirm 16:9 preview and download</button>
          </div>
        </details>

        <details className={styles.panel} open>
          <summary><span>03</span> Facebook-ready posts</summary>
          <div className={styles.panelBody}>
            <p className={styles.helperText}>Choose a post style. Vehicle details and the Walker disclaimer are added automatically.</p>
            <div className={styles.captionChoices}>
              {captions.map((caption, index) => (
                <button
                  key={caption.title}
                  type="button"
                  className={index === selectedCaption ? styles.captionActive : styles.captionChoice}
                  onClick={() => setSelectedCaption(index)}
                >
                  {caption.title}
                </button>
              ))}
            </div>
            <textarea className={styles.captionPreview} value={captions[selectedCaption].text} readOnly aria-label="Selected Facebook post" />
            <button className={styles.primary} type="button" onClick={copyCaption}>Copy Facebook post</button>
          </div>
        </details>

        <details className={styles.panel}>
          <summary><span>04</span> GPT post prompt</summary>
          <div className={styles.panelBody}>
            <textarea className={styles.prompt} value={prompt} readOnly aria-label="Generated GPT vehicle-post prompt" />
            <div className={styles.actions}>
              <button className={styles.primary} type="button" onClick={copyPrompt}>Copy prompt</button>
              <button className={styles.secondary} type="button" onClick={downloadPrompt}>Download prompt</button>
            </div>
          </div>
        </details>

        <p className={styles.notice} aria-live="polite">{notice || "Enter verified information, then create the assets."}</p>
        <footer className={styles.disclaimer}>{disclaimer}</footer>
      </div>
    </main>
  );
}
