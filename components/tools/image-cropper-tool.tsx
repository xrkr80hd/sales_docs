"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { PointerEvent } from "react";

type CropSlot = {
  id: number;
  title: string;
  instruction: string;
  orientation: "Landscape" | "Portrait";
  width: number;
  height: number;
};

const SLOTS: CropSlot[] = [
  { id: 1, title: "Main Image", instruction: "This is the wide lead image.", orientation: "Landscape", width: 1500, height: 1000 },
  { id: 2, title: "Image 2", instruction: "Use a vertical photo.", orientation: "Portrait", width: 1000, height: 1500 },
  { id: 3, title: "Image 3", instruction: "Use a vertical photo.", orientation: "Portrait", width: 1000, height: 1500 },
  { id: 4, title: "Image 4", instruction: "Use a vertical photo.", orientation: "Portrait", width: 1000, height: 1500 },
  { id: 5, title: "Image 5", instruction: "Use a vertical photo.", orientation: "Portrait", width: 1000, height: 1500 },
  { id: 6, title: "Image 6", instruction: "Use a vertical photo.", orientation: "Portrait", width: 1000, height: 1500 },
];

export function ImageCropperTool() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const dragRef = useRef({ active: false, x: 0, y: 0 });

  const [slotIndex, setSlotIndex] = useState(0);
  const [fileName, setFileName] = useState("");
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState("Load the photo required for Image 1.");
  const slot = SLOTS[slotIndex];

  const clearActiveImage = useCallback((message?: string) => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
    imageRef.current = null;
    setFileName("");
    setZoom(1);
    setOffset({ x: 0, y: 0 });
    setReady(false);
    setStatus(message ?? `Load the photo required for Image ${slot.id}.`);
  }, [slot.id]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const previewWidth = slot.orientation === "Landscape" ? 750 : 500;
    const previewHeight = Math.round(previewWidth * slot.height / slot.width);
    canvas.width = previewWidth;
    canvas.height = previewHeight;
    ctx.fillStyle = "#101114";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const image = imageRef.current;
    if (!image) return;

    const baseScale = Math.max(canvas.width / image.naturalWidth, canvas.height / image.naturalHeight);
    const scale = baseScale * zoom;
    const dragReference = 340;

    ctx.save();
    ctx.translate(
      canvas.width / 2 + offset.x * (canvas.width / dragReference),
      canvas.height / 2 + offset.y * (canvas.width / dragReference),
    );
    ctx.scale(scale, scale);
    ctx.drawImage(image, -image.naturalWidth / 2, -image.naturalHeight / 2);
    ctx.restore();
  }, [offset, slot, zoom]);

  useEffect(() => {
    draw();
  }, [draw]);

  useEffect(() => () => {
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
  }, []);

  function changeSlot(index: number) {
    setSlotIndex(index);
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
    imageRef.current = null;
    setFileName("");
    setZoom(1);
    setOffset({ x: 0, y: 0 });
    setReady(false);
    setStatus(`Image ${SLOTS[index].id} requires a ${SLOTS[index].orientation.toLowerCase()} photo.`);
  }

  function loadFile(file?: File) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setStatus("Please choose a JPG, PNG, or WEBP image.");
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      setStatus("That image is larger than 20 MB.");
      return;
    }

    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    const url = URL.createObjectURL(file);
    objectUrlRef.current = url;

    const image = new Image();
    image.onload = () => {
      imageRef.current = image;
      setFileName(file.name);
      setZoom(1);
      setOffset({ x: 0, y: 0 });
      setReady(true);
      const sourceIsLandscape = image.naturalWidth >= image.naturalHeight;
      const expectedLandscape = slot.orientation === "Landscape";
      setStatus(sourceIsLandscape === expectedLandscape
        ? "Photo loaded. Drag to position it and zoom if needed."
        : `This slot needs a ${slot.orientation.toLowerCase()} photo. It will still crop, but another photo may fit better.`);
    };
    image.onerror = () => setStatus("This image could not be opened.");
    image.src = url;
  }

  function startDrag(event: PointerEvent<HTMLCanvasElement>) {
    if (!ready) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { active: true, x: event.clientX, y: event.clientY };
  }

  function moveDrag(event: PointerEvent<HTMLCanvasElement>) {
    if (!dragRef.current.active) return;
    const dx = event.clientX - dragRef.current.x;
    const dy = event.clientY - dragRef.current.y;
    dragRef.current = { active: true, x: event.clientX, y: event.clientY };
    setOffset((current) => ({ x: current.x + dx, y: current.y + dy }));
  }

  function stopDrag() {
    dragRef.current.active = false;
  }

  function downloadCrop() {
    const image = imageRef.current;
    if (!image) return;

    const output = document.createElement("canvas");
    output.width = slot.width;
    output.height = slot.height;
    const ctx = output.getContext("2d");
    if (!ctx) return;

    ctx.fillStyle = "#101114";
    ctx.fillRect(0, 0, output.width, output.height);
    const baseScale = Math.max(output.width / image.naturalWidth, output.height / image.naturalHeight);
    const scale = baseScale * zoom;

    ctx.save();
    ctx.translate(
      output.width / 2 + offset.x * (output.width / 340),
      output.height / 2 + offset.y * (output.width / 340),
    );
    ctx.scale(scale, scale);
    ctx.drawImage(image, -image.naturalWidth / 2, -image.naturalHeight / 2);
    ctx.restore();

    output.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      const base = fileName.replace(/\.[^/.]+$/, "") || "nextdocs-image";
      anchor.href = url;
      anchor.download = `image-${slot.id}-${slot.orientation.toLowerCase()}-${base}.jpg`;
      anchor.click();
      URL.revokeObjectURL(url);

      if (slotIndex < SLOTS.length - 1) {
        changeSlot(slotIndex + 1);
        setStatus(`Image ${slot.id} downloaded. Now load the portrait photo for Image ${slot.id + 1}.`);
      } else {
        clearActiveImage("All six image positions are complete.");
      }
    }, "image/jpeg", 0.92);
  }

  return (
    <main className="min-h-full bg-[#0d0e10] px-4 py-5 text-white sm:px-6">
      <div className="mx-auto max-w-5xl">
        <header className="mb-5 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--accent)]">NXTDOX Digital Card</p>
            <h1 className="mt-1 text-2xl font-extrabold">Guided Image Cropper</h1>
            <p className="mt-1 text-sm text-white/55">Each position is locked to the correct shape. Finish one image at a time.</p>
          </div>
          <Link href="/" className="shrink-0 border border-white/15 px-3 py-2 text-xs font-bold uppercase tracking-[0.08em] text-white/70">Back</Link>
        </header>

        <div className="mb-4 grid grid-cols-3 gap-2 sm:grid-cols-6">
          {SLOTS.map((item, index) => (
            <button
              key={item.id}
              type="button"
              onClick={() => changeSlot(index)}
              className={`border px-2 py-2 text-center transition ${index === slotIndex ? "border-[var(--accent)] bg-[var(--accent)]/15 text-white" : "border-white/10 bg-white/[0.03] text-white/45"}`}
            >
              <span className="block text-xs font-extrabold">Image {item.id}</span>
              <span className="mt-0.5 block text-[10px]">{item.orientation}</span>
            </button>
          ))}
        </div>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
          <section className="border border-white/10 bg-[#17181b] p-3 sm:p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h2 className="font-extrabold">{slot.title}</h2>
                <p className="text-xs text-white/50">{slot.instruction}</p>
              </div>
              <div className="shrink-0 border border-[var(--accent)] bg-[var(--accent)]/10 px-3 py-2 text-right">
                <span className="block text-xs font-extrabold uppercase">{slot.orientation}</span>
                <span className="block text-[10px] text-white/55">{slot.width} × {slot.height} · {slot.width / slot.height === 1.5 ? "3:2" : "2:3"}</span>
              </div>
            </div>

            <div className="relative mx-auto max-h-[68vh] w-full max-w-[750px] overflow-hidden bg-[#101114]" style={{ aspectRatio: `${slot.width} / ${slot.height}` }}>
              <canvas
                ref={canvasRef}
                onPointerDown={startDrag}
                onPointerMove={moveDrag}
                onPointerUp={stopDrag}
                onPointerCancel={stopDrag}
                className={`h-full w-full touch-none ${ready ? "cursor-grab active:cursor-grabbing" : ""}`}
                aria-label={`Image ${slot.id} crop preview`}
              />
              {!ready && (
                <label className="absolute inset-0 flex cursor-pointer flex-col items-center justify-center gap-2 border-2 border-dashed border-white/15 text-center hover:border-[var(--accent)]">
                  <span className="text-4xl text-white/30">＋</span>
                  <span className="text-sm font-extrabold">Load {slot.orientation} Photo</span>
                  <span className="text-xs text-white/45">Image {slot.id} · {slot.width} × {slot.height}</span>
                  <input type="file" accept="image/*" className="sr-only" onChange={(event) => loadFile(event.currentTarget.files?.[0])} />
                </label>
              )}
            </div>
          </section>

          <aside className="grid content-start gap-4 border border-white/10 bg-[#17181b] p-4">
            <div className="border border-white/10 bg-white/[0.03] p-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/45">Required Here</p>
              <p className="mt-1 text-lg font-extrabold">{slot.orientation}</p>
              <p className="text-xs text-white/55">{slot.width} × {slot.height} pixels</p>
            </div>

            <label className="grid gap-2">
              <span className="text-xs font-bold uppercase tracking-[0.14em] text-white/55">Zoom · {zoom.toFixed(2)}×</span>
              <input type="range" min="1" max="3" step="0.01" value={zoom} disabled={!ready} onChange={(event) => setZoom(Number(event.currentTarget.value))} className="w-full accent-[var(--accent)] disabled:opacity-30" />
            </label>

            <div className="grid grid-cols-2 gap-2">
              <label className="inline-flex min-h-11 cursor-pointer items-center justify-center border border-white/15 bg-white/5 px-3 text-xs font-bold uppercase tracking-[0.08em]">
                Replace
                <input type="file" accept="image/*" className="sr-only" onChange={(event) => loadFile(event.currentTarget.files?.[0])} />
              </label>
              <button type="button" onClick={() => clearActiveImage("Crop reset. Load this position again.")} className="min-h-11 border border-white/15 bg-white/5 px-3 text-xs font-bold uppercase tracking-[0.08em]">
                Reset
              </button>
            </div>

            <button type="button" onClick={downloadCrop} disabled={!ready} className="min-h-12 border-2 border-[var(--accent)] bg-[var(--accent)] px-4 text-sm font-extrabold uppercase tracking-[0.1em] disabled:opacity-30">
              Save Image {slot.id}
            </button>
            <p role="status" className="min-h-10 border-t border-white/10 pt-3 text-xs leading-5 text-white/60">{status}</p>
          </aside>
        </div>
      </div>
    </main>
  );
}
