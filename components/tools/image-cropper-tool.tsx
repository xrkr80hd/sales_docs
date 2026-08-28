"use client";

import Link from "next/link";
import { PointerEvent, useCallback, useEffect, useRef, useState } from "react";

type CropPreset = {
  id: string;
  label: string;
  detail: string;
  width: number;
  height: number;
};

const PRESETS: CropPreset[] = [
  { id: "profile", label: "Profile", detail: "1:1 · 1080 × 1080", width: 1080, height: 1080 },
  { id: "vehicle", label: "Vehicle", detail: "3:2 · 1500 × 1000", width: 1500, height: 1000 },
  { id: "wide", label: "Wide Vehicle", detail: "16:9 · 1920 × 1080", width: 1920, height: 1080 },
  { id: "review", label: "Review Card", detail: "2:3 · 1000 × 1500", width: 1000, height: 1500 },
];

export function ImageCropperTool() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const dragRef = useRef({ active: false, x: 0, y: 0 });
  const objectUrlRef = useRef<string | null>(null);

  const [preset, setPreset] = useState(PRESETS[0]);
  const [fileName, setFileName] = useState("");
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState("Choose a photo to begin.");

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const image = imageRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const outputScale = 0.5;
    canvas.width = Math.round(preset.width * outputScale);
    canvas.height = Math.round(preset.height * outputScale);

    ctx.fillStyle = "#111214";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (!image) return;

    const baseScale = Math.max(canvas.width / image.naturalWidth, canvas.height / image.naturalHeight);
    const scale = baseScale * zoom;
    const dragScaleX = canvas.width / 340;
    const dragScaleY = canvas.height / (340 * preset.height / preset.width);

    ctx.save();
    ctx.translate(
      canvas.width / 2 + offset.x * dragScaleX,
      canvas.height / 2 + offset.y * dragScaleY,
    );
    ctx.scale(scale, scale);
    ctx.drawImage(image, -image.naturalWidth / 2, -image.naturalHeight / 2);
    ctx.restore();
  }, [offset, preset, zoom]);

  useEffect(() => {
    draw();
  }, [draw]);

  useEffect(() => {
    return () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    };
  }, []);

  function resetPosition() {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
    setStatus(ready ? "Crop reset." : "Choose a photo to begin.");
  }

  function selectPreset(next: CropPreset) {
    setPreset(next);
    setZoom(1);
    setOffset({ x: 0, y: 0 });
    setStatus(ready ? `${next.label} crop selected.` : "Choose a photo to begin.");
  }

  function loadFile(file?: File) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setStatus("Please choose an image file.");
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
      setStatus("Drag the image to position it, then zoom if needed.");
    };
    image.onerror = () => setStatus("This image could not be opened.");
    image.src = url;
  }

  function startDrag(event: PointerEvent<HTMLCanvasElement>) {
    if (!ready) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { active: true, x: event.clientX, y: event.clientY };
  }

  function drag(event: PointerEvent<HTMLCanvasElement>) {
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
    output.width = preset.width;
    output.height = preset.height;
    const ctx = output.getContext("2d");
    if (!ctx) return;

    ctx.fillStyle = "#111214";
    ctx.fillRect(0, 0, output.width, output.height);

    const baseScale = Math.max(output.width / image.naturalWidth, output.height / image.naturalHeight);
    const scale = baseScale * zoom;
    const dragScaleX = output.width / 340;
    const dragScaleY = output.height / (340 * preset.height / preset.width);

    ctx.save();
    ctx.translate(
      output.width / 2 + offset.x * dragScaleX,
      output.height / 2 + offset.y * dragScaleY,
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
      anchor.download = `${base}-${preset.id}-${preset.width}x${preset.height}.jpg`;
      anchor.click();
      URL.revokeObjectURL(url);
      setStatus("Cropped image downloaded.");
    }, "image/jpeg", 0.92);
  }

  const previewHeight = `min(68vh, calc((100vw - 2.5rem) * ${preset.height / preset.width}))`;

  return (
    <main className="min-h-full bg-[#0d0e10] px-4 py-5 text-white sm:px-6">
      <div className="mx-auto max-w-5xl">
        <header className="mb-5 flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--accent)]">NXTDOX Tools</p>
            <h1 className="mt-1 text-2xl font-extrabold">Image Cropper</h1>
            <p className="mt-1 text-sm text-white/55">Prepare clean, correctly sized images for your digital card.</p>
          </div>
          <Link href="/" className="shrink-0 border border-white/15 px-3 py-2 text-xs font-bold uppercase tracking-[0.08em] text-white/70">
            Back
          </Link>
        </header>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
          <section className="border border-white/10 bg-[#17181b] p-3 sm:p-4">
            <div
              className="relative mx-auto w-full max-w-[680px] overflow-hidden bg-[#111214]"
              style={{ aspectRatio: `${preset.width} / ${preset.height}`, maxHeight: previewHeight }}
            >
              <canvas
                ref={canvasRef}
                onPointerDown={startDrag}
                onPointerMove={drag}
                onPointerUp={stopDrag}
                onPointerCancel={stopDrag}
                className={`h-full w-full touch-none object-contain ${ready ? "cursor-grab active:cursor-grabbing" : ""}`}
                aria-label="Image crop preview"
              />
              {!ready && (
                <label className="absolute inset-0 flex cursor-pointer flex-col items-center justify-center gap-2 border-2 border-dashed border-white/15 text-center transition hover:border-[var(--accent)]">
                  <span className="text-4xl text-white/30">＋</span>
                  <span className="text-sm font-bold">Choose Photo</span>
                  <span className="text-xs text-white/45">JPG, PNG, WEBP · up to 20 MB</span>
                  <input type="file" accept="image/*" className="sr-only" onChange={(event) => loadFile(event.currentTarget.files?.[0])} />
                </label>
              )}
            </div>
          </section>

          <aside className="grid content-start gap-4 border border-white/10 bg-[#17181b] p-4">
            <div>
              <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-white/55">Image Type</h2>
              <div className="mt-2 grid grid-cols-2 gap-2 lg:grid-cols-1">
                {PRESETS.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => selectPreset(item)}
                    className={`border px-3 py-3 text-left transition ${preset.id === item.id ? "border-[var(--accent)] bg-[var(--accent)]/15" : "border-white/10 bg-white/[0.03] hover:bg-white/[0.07]"}`}
                  >
                    <span className="block text-sm font-bold">{item.label}</span>
                    <span className="mt-0.5 block text-[11px] text-white/45">{item.detail}</span>
                  </button>
                ))}
              </div>
            </div>

            <label className="grid gap-2">
              <span className="text-xs font-bold uppercase tracking-[0.14em] text-white/55">Zoom · {zoom.toFixed(2)}×</span>
              <input
                type="range"
                min="1"
                max="3"
                step="0.01"
                value={zoom}
                disabled={!ready}
                onChange={(event) => setZoom(Number(event.currentTarget.value))}
                className="w-full accent-[var(--accent)] disabled:opacity-30"
              />
            </label>

            <div className="grid grid-cols-2 gap-2">
              <label className="inline-flex min-h-11 cursor-pointer items-center justify-center border border-white/15 bg-white/5 px-3 text-xs font-bold uppercase tracking-[0.08em] transition hover:bg-white/10">
                Replace
                <input type="file" accept="image/*" className="sr-only" onChange={(event) => loadFile(event.currentTarget.files?.[0])} />
              </label>
              <button type="button" onClick={resetPosition} disabled={!ready} className="min-h-11 border border-white/15 bg-white/5 px-3 text-xs font-bold uppercase tracking-[0.08em] disabled:opacity-30">
                Reset
              </button>
            </div>

            <button
              type="button"
              onClick={downloadCrop}
              disabled={!ready}
              className="min-h-12 border-2 border-[var(--accent)] bg-[var(--accent)] px-4 text-sm font-extrabold uppercase tracking-[0.1em] transition hover:brightness-110 disabled:opacity-30"
            >
              Download Crop
            </button>

            <p role="status" className="min-h-10 border-t border-white/10 pt-3 text-xs leading-5 text-white/55">{status}</p>
          </aside>
        </div>
      </div>
    </main>
  );
}
