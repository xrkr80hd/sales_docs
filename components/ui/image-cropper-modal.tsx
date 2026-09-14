"use client";

import { useEffect, useRef, useState, type PointerEvent, type TouchEvent } from "react";

export type AspectRatioType = "1:1" | "2:3" | "3:2" | "16:9" | "free";

const MIN_SCALE = 0.1;
const MAX_SCALE = 3;

export type ImageCropperModalProps = {
  imageUrl: string;
  aspectRatio: AspectRatioType;
  title: string;
  onCrop: (croppedDataUrl: string) => void;
  onCancel: () => void;
};

export function ImageCropperModal({
  imageUrl,
  aspectRatio,
  title,
  onCrop,
  onCancel,
}: ImageCropperModalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);

  // Zoom & Pan state
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0, offsetX: 0, offsetY: 0 });
  const pinchStartDistRef = useRef<number | null>(null);
  const initialScaleRef = useRef(1);

  // Load Image
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      imageRef.current = img;
      render();
    };
    img.src = imageUrl;
  }, [imageUrl]);

  // Target aspect ratio calculation
  const getTargetRatio = (): number => {
    if (aspectRatio === "1:1") return 1;
    if (aspectRatio === "2:3") return 2 / 3;
    if (aspectRatio === "3:2") return 3 / 2;
    if (aspectRatio === "16:9") return 16 / 9;
    return 1; // Default
  };

  // Render to canvas
  const render = () => {
    const canvas = canvasRef.current;
    const img = imageRef.current;
    if (!canvas || !img) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    ctx.clearRect(0, 0, width, height);

    // Fill background
    ctx.fillStyle = "#0c0d0f";
    ctx.fillRect(0, 0, width, height);

    // Draw a soft extension behind the photo so zooming out never creates harsh gaps.
    const backgroundAspect = img.width / img.height;
    let backgroundW = width;
    let backgroundH = width / backgroundAspect;
    if (backgroundH < height) {
      backgroundH = height;
      backgroundW = height * backgroundAspect;
    }
    ctx.save();
    ctx.filter = "blur(22px) brightness(0.5)";
    ctx.translate(width / 2, height / 2);
    ctx.scale(1.1, 1.1);
    ctx.drawImage(img, -backgroundW / 2, -backgroundH / 2, backgroundW, backgroundH);
    ctx.restore();

    // Draw the adjustable foreground image.
    ctx.save();

    // Center and scale
    ctx.translate(width / 2 + offset.x, height / 2 + offset.y);
    ctx.scale(scale, scale);

    // Draw image centered
    const imgAspect = img.width / img.height;
    let drawW = width;
    let drawH = width / imgAspect;

    if (drawH < height) {
      drawH = height;
      drawW = height * imgAspect;
    }

    ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
    ctx.restore();

    // Draw dark overlay outside crop box
    ctx.fillStyle = "rgba(0, 0, 0, 0.65)";

    const cropBox = getCropBox(width, height);
    // Outer boundary
    ctx.beginPath();
    ctx.rect(0, 0, width, height);
    // Inner cutout
    if (aspectRatio === "1:1") {
      ctx.arc(width / 2, height / 2, cropBox.w / 2, 0, Math.PI * 2, true);
    } else {
      ctx.rect(cropBox.x + cropBox.w, cropBox.y, -cropBox.w, cropBox.h);
    }
    ctx.fill();

    // Draw crop border
    ctx.strokeStyle = "#be1717";
    ctx.lineWidth = 3;
    if (aspectRatio === "1:1") {
      ctx.beginPath();
      ctx.arc(width / 2, height / 2, cropBox.w / 2, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      ctx.strokeRect(cropBox.x, cropBox.y, cropBox.w, cropBox.h);
    }
  };

  const getCropBox = (canvasW: number, canvasH: number) => {
    const pad = 24;
    const maxW = canvasW - pad * 2;
    const maxH = canvasH - pad * 2;
    const targetRatio = getTargetRatio();

    let w = maxW;
    let h = w / targetRatio;

    if (h > maxH) {
      h = maxH;
      w = h * targetRatio;
    }

    return {
      x: (canvasW - w) / 2,
      y: (canvasH - h) / 2,
      w,
      h,
    };
  };

  useEffect(() => {
    render();
  }, [scale, offset]);

  // Touch / Pointer controls for Pan & Pinch-Zoom
  const handlePointerDown = (e: PointerEvent<HTMLCanvasElement>) => {
    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      offsetX: offset.x,
      offsetY: offset.y,
    };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: PointerEvent<HTMLCanvasElement>) => {
    if (!isDragging) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    setOffset({
      x: dragStartRef.current.offsetX + dx,
      y: dragStartRef.current.offsetY + dy,
    });
  };

  const handlePointerUp = (e: PointerEvent<HTMLCanvasElement>) => {
    setIsDragging(false);
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // Ignored
    }
  };

  // Pinch-to-zoom for mobile 2-finger expand
  const handleTouchStart = (e: TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length === 2) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY,
      );
      pinchStartDistRef.current = dist;
      initialScaleRef.current = scale;
    }
  };

  const handleTouchMove = (e: TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length === 2 && pinchStartDistRef.current !== null) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY,
      );
      const ratio = dist / pinchStartDistRef.current;
      const nextScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, initialScaleRef.current * ratio));
      setScale(nextScale);
    }
  };

  const handleTouchEnd = (e: TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length < 2) {
      pinchStartDistRef.current = null;
    }
  };

  // Perform Final Crop Export
  const handleDone = () => {
    const img = imageRef.current;
    const canvas = canvasRef.current;
    if (!img || !canvas) return;

    const cropBox = getCropBox(canvas.width, canvas.height);
    const outW = Math.round(cropBox.w * 2);
    const outH = Math.round(cropBox.h * 2);
    const outCanvas = document.createElement("canvas");
    outCanvas.width = outW;
    outCanvas.height = outH;
    const outCtx = outCanvas.getContext("2d");
    if (!outCtx) return;

    // Blurred edge extension prevents empty bars when the foreground is zoomed out.
    const imgAspect = img.width / img.height;
    let backgroundW = outW;
    let backgroundH = outW / imgAspect;
    if (backgroundH < outH) {
      backgroundH = outH;
      backgroundW = outH * imgAspect;
    }
    outCtx.save();
    outCtx.filter = "blur(36px) brightness(0.5)";
    outCtx.translate(outW / 2, outH / 2);
    outCtx.scale(1.1, 1.1);
    outCtx.drawImage(img, -backgroundW / 2, -backgroundH / 2, backgroundW, backgroundH);
    outCtx.restore();

    // Map the exact visible crop rectangle into the export canvas.
    let drawW = canvas.width;
    let drawH = canvas.width / imgAspect;
    if (drawH < canvas.height) {
      drawH = canvas.height;
      drawW = canvas.height * imgAspect;
    }
    const outputScale = outW / cropBox.w;
    const previewX = canvas.width / 2 + offset.x - (drawW * scale) / 2;
    const previewY = canvas.height / 2 + offset.y - (drawH * scale) / 2;
    outCtx.drawImage(
      img,
      (previewX - cropBox.x) * outputScale,
      (previewY - cropBox.y) * outputScale,
      drawW * scale * outputScale,
      drawH * scale * outputScale,
    );

    onCrop(outCanvas.toDataURL("image/jpeg", 0.92));
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "rgba(0, 0, 0, 0.88)",
        backdropFilter: "blur(8px)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
      }}
      role="dialog"
      aria-modal="true"
    >
      <div
        ref={containerRef}
        style={{
          width: "100%",
          maxWidth: "480px",
          background: "#16181d",
          border: "1px solid #31353e",
          borderRadius: "20px",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 25px 60px rgba(0,0,0,0.8)",
        }}
      >
        <header
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid #2a2e37",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div>
            <h3 style={{ margin: 0, color: "#fff", fontSize: "1.05rem", fontWeight: 800 }}>{title}</h3>
            <p style={{ margin: "2px 0 0", color: "#8a909b", fontSize: "0.75rem" }}>
              Pinch with two fingers or use slider to zoom. Drag to reposition.
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            style={{
              background: "transparent",
              border: "none",
              color: "#888",
              fontSize: "1.5rem",
              cursor: "pointer",
              padding: "4px 8px",
            }}
          >
            ×
          </button>
        </header>

        <div
          style={{
            position: "relative",
            width: "100%",
            aspectRatio: "1 / 1",
            background: "#0c0d0f",
            touchAction: "none",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <canvas
            ref={canvasRef}
            width={400}
            height={400}
            style={{ width: "100%", height: "100%", cursor: isDragging ? "grabbing" : "grab" }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          />
        </div>

        <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: "12px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <span style={{ minWidth: "70px", fontSize: "0.8rem", color: "#aaa" }}>Zoom {Math.round(((scale - MIN_SCALE) / (MAX_SCALE - MIN_SCALE)) * 100)}%</span>
            <input
              type="range"
              min={MIN_SCALE}
              max={MAX_SCALE}
              step="0.02"
              value={scale}
              onChange={(e) => setScale(parseFloat(e.target.value))}
              style={{ flex: 1, accentColor: "#be1717" }}
            />
            <button
              type="button"
              onClick={() => { setScale(1); setOffset({ x: 0, y: 0 }); }}
              style={{
                background: "#22262d",
                border: "1px solid #363b46",
                color: "#ccc",
                borderRadius: "6px",
                padding: "4px 8px",
                fontSize: "0.72rem",
                cursor: "pointer",
              }}
            >
              Reset
            </button>
          </div>

          <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end", marginTop: "4px" }}>
            <button
              type="button"
              onClick={onCancel}
              style={{
                padding: "10px 18px",
                borderRadius: "10px",
                background: "#22262d",
                border: "1px solid #363b46",
                color: "#ccc",
                fontWeight: 700,
                fontSize: "0.85rem",
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDone}
              style={{
                padding: "10px 24px",
                borderRadius: "10px",
                background: "#be1717",
                border: "none",
                color: "#fff",
                fontWeight: 800,
                fontSize: "0.85rem",
                cursor: "pointer",
              }}
            >
              Crop &amp; Apply
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
