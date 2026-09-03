"use client";

import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  createDefaultConsultant,
  createDefaultDealer,
  fetchServerSettings,
  getDealerFullAddress,
  loadConsultant,
  loadDealer,
  type ConsultantInfo,
  type DealerInfo,
} from "@/lib/dealer-consultant";
import { normalizeProfileContent } from "@/lib/consultant-profile";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import styles from "./page.module.css";

type VehicleForm = {
  year: string; make: string; model: string; trim: string; vin: string;
  stock: string; mileage: string; price: string; walkerUrl: string; consultantUrl: string;
};

type CropPhoto = { id: string; file?: File; url: string; zoom: number; x: number; y: number; ratio: number; };
type Slot = { x: number; y: number; w: number; h: number; };
type PhotoGuide = { shape: string; view: string; note: string; };

const disclaimer = "This page is not a buy, sell, or trade platform. All vehicle availability, pricing, financing, trade evaluations, and transactions are handled exclusively through Walker Automotive. Information is subject to verification.";

const initialForm: VehicleForm = {
  year: "", make: "", model: "", trim: "", vin: "", stock: "", mileage: "", price: "", walkerUrl: "",
  consultantUrl: "https://walker-next-docs-git-feature-trav-dig-b5f2fe-xrkr80hds-projects.vercel.app/card/trav",
};

const PHOTO_HEIGHT = 810;

const PHOTO_GUIDES: Record<number, PhotoGuide[]> = {
  1: [{ shape: "Wide landscape", view: "Three-quarter front view", note: "Keep the entire vehicle visible with room around it." }],
  2: [
    { shape: "Tall or square", view: "Three-quarter front view", note: "This fills the left half." },
    { shape: "Tall or square", view: "Three-quarter rear view", note: "This fills the right half." },
  ],
  3: [
    { shape: "Wide landscape", view: "Full side view", note: "This fills the upper-left frame." },
    { shape: "Wide landscape", view: "Three-quarter view", note: "This fills the lower-left frame." },
    { shape: "Portrait or square", view: "Straight front view", note: "This fills the entire right half." },
  ],
  4: [
    { shape: "Wide landscape", view: "Three-quarter front view", note: "Upper-left frame." },
    { shape: "Wide landscape", view: "Full side view", note: "Upper-right frame." },
    { shape: "Wide landscape", view: "Straight front view", note: "Lower-left frame." },
    { shape: "Wide landscape", view: "Three-quarter rear view", note: "Lower-right frame." },
  ],
  5: [
    { shape: "Wide landscape", view: "Top-left image", note: "Suggested: full side or wide three-quarter view." },
    { shape: "Wide landscape", view: "Top-right image", note: "Suggested: another wide vehicle view." },
    { shape: "Flexible", view: "Bottom-left card", note: "Use a vehicle photo, calling card, emblem, or eye-catcher." },
    { shape: "Flexible", view: "Bottom-center card", note: "Use a vehicle photo, calling card, emblem, or eye-catcher." },
    { shape: "Flexible", view: "Bottom-right card", note: "Use a vehicle photo, calling card, emblem, or eye-catcher." },
  ],
};

// Preview and download share these exact final frames.
const getSlots = (count: number): Slot[] => count === 1
  ? [{ x: 0, y: 0, w: 1920, h: PHOTO_HEIGHT }]
  : count === 2
    ? [{ x: 0, y: 0, w: 960, h: PHOTO_HEIGHT }, { x: 960, y: 0, w: 960, h: PHOTO_HEIGHT }]
    : count === 3
      ? [{ x: 0, y: 0, w: 960, h: 405 }, { x: 0, y: 405, w: 960, h: 405 }, { x: 960, y: 0, w: 960, h: PHOTO_HEIGHT }]
      : count === 4
        ? [{ x: 0, y: 0, w: 960, h: 405 }, { x: 960, y: 0, w: 960, h: 405 }, { x: 0, y: 405, w: 960, h: 405 }, { x: 960, y: 405, w: 960, h: 405 }]
        : [{ x: 0, y: 0, w: 960, h: 405 }, { x: 960, y: 0, w: 960, h: 405 }, { x: 0, y: 405, w: 640, h: 405 }, { x: 640, y: 405, w: 640, h: 405 }, { x: 1280, y: 405, w: 640, h: 405 }];

const drawCropped = (context: CanvasRenderingContext2D, image: HTMLImageElement, slot: Slot, photo: CropPhoto) => {
  const coverScale = Math.max(slot.w / image.width, slot.h / image.height);
  const backgroundScale = coverScale * 1.08;
  const backgroundWidth = image.width * backgroundScale;
  const backgroundHeight = image.height * backgroundScale;
  context.save();
  context.beginPath();
  context.rect(slot.x, slot.y, slot.w, slot.h);
  context.clip();
  context.filter = "blur(34px) brightness(0.72) saturate(0.9)";
  context.drawImage(
    image,
    slot.x + (slot.w - backgroundWidth) / 2,
    slot.y + (slot.h - backgroundHeight) / 2,
    backgroundWidth,
    backgroundHeight,
  );
  context.restore();

  const drawWidth = image.width * coverScale * photo.zoom;
  const drawHeight = image.height * coverScale * photo.zoom;
  const drawX = drawWidth >= slot.w
    ? slot.x - (drawWidth - slot.w) * (photo.x / 100)
    : slot.x + (slot.w - drawWidth) / 2;
  const drawY = drawHeight >= slot.h
    ? slot.y - (drawHeight - slot.h) * (photo.y / 100)
    : slot.y + (slot.h - drawHeight) / 2;
  context.save();
  context.beginPath();
  context.rect(slot.x, slot.y, slot.w, slot.h);
  context.clip();
  context.drawImage(image, drawX, drawY, drawWidth, drawHeight);
  context.restore();
};

const fitText = (context: CanvasRenderingContext2D, text: string, maxWidth: number, start: number, minimum: number) => {
  let size = start;
  while (size > minimum) {
    context.font = `900 ${size}px Arial, sans-serif`;
    if (context.measureText(text).width <= maxWidth) break;
    size -= 2;
  }
  return size;
};

const renderCollage = async (
  canvas: HTMLCanvasElement,
  photos: CropPhoto[],
  form: VehicleForm,
  dealer: DealerInfo,
  consultant: ConsultantInfo,
  selected = -1,
) => {
  canvas.width = 1920;
  canvas.height = 1080;
  const context = canvas.getContext("2d");
  if (!context) return;
  context.fillStyle = "#111317";
  context.fillRect(0, 0, canvas.width, canvas.height);
  const slots = getSlots(photos.length);

  await Promise.all(photos.map((photo, index) => new Promise<void>((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => {
      drawCropped(context, image, slots[index], photo);
      context.strokeStyle = "#0b0c0e";
      context.lineWidth = 8;
      context.strokeRect(slots[index].x + 4, slots[index].y + 4, slots[index].w - 8, slots[index].h - 8);
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

  const vehicle = [form.year, form.make, form.model, form.trim].filter(Boolean).join(" ") || "Vehicle details";
  const dealership = [dealer.dealershipName, getDealerFullAddress(dealer)].filter(Boolean).join("  •  ");
  const contact = [consultant.name, consultant.phone].filter(Boolean).join("  •  ");
  const identifiers = [form.stock && `Stock # ${form.stock}`, form.vin && `VIN ${form.vin}`].filter(Boolean).join("   •   ");

  context.fillStyle = "#111317";
  context.fillRect(0, PHOTO_HEIGHT, 1920, 270);
  context.fillStyle = "#c5161d";
  context.fillRect(0, PHOTO_HEIGHT, 16, 270);

  const titleSize = fitText(context, vehicle, 1160, 70, 38);
  context.font = `900 ${titleSize}px Arial, sans-serif`;
  context.fillStyle = "#fff";
  context.fillText(vehicle, 62, 895);
  context.font = "700 31px Arial, sans-serif";
  context.fillStyle = "#c9cbd0";
  context.fillText(identifiers || "Stock number and VIN", 64, 950);
  context.font = "600 25px Arial, sans-serif";
  context.fillStyle = "#9ea2a9";
  context.fillText(dealership || "Dealership information", 64, 1001);
  context.fillText(contact || "Consultant information", 64, 1041);

  const price = form.price.trim() || "Price available at dealership";
  const priceSize = fitText(context, price, 570, 66, 38);
  context.textAlign = "right";
  context.font = `900 ${priceSize}px Arial, sans-serif`;
  context.fillStyle = "#fff";
  context.fillText(price, 1854, 918);
  context.font = "700 25px Arial, sans-serif";
  context.fillStyle = "#ef6262";
  context.fillText("SEE LISTING FOR CURRENT DETAILS", 1854, 970);
  context.textAlign = "left";
};

const canvasToPngBlob = (canvas: HTMLCanvasElement) => new Promise<Blob>((resolve, reject) => {
  canvas.toBlob((blob) => {
    if (blob) resolve(blob);
    else reject(new Error("The collage could not be prepared for download."));
  }, "image/png");
});

export default function VehiclePostBuilder() {
  const [form, setForm] = useState(initialForm);
  const [photoCount, setPhotoCount] = useState<number | null>(null);
  const [photos, setPhotos] = useState<CropPhoto[]>([]);
  const [uploadSlot, setUploadSlot] = useState(0);
  const [selectedPhoto, setSelectedPhoto] = useState(0);
  const [selectedCaption, setSelectedCaption] = useState(0);
  const [editorOpen, setEditorOpen] = useState(false);
  const [savingCarousel, setSavingCarousel] = useState(false);
  const [editingVehicleId, setEditingVehicleId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [dealer, setDealer] = useState<DealerInfo>(createDefaultDealer);
  const [consultant, setConsultant] = useState<ConsultantInfo>(createDefaultConsultant);
  const inputRef = useRef<HTMLInputElement>(null);
  const previewRef = useRef<HTMLCanvasElement>(null);
  const dragRef = useRef<{ index: number; startX: number; startY: number; initialX: number; initialY: number } | null>(null);
  const didDragRef = useRef(false);
  const editorPointers = useRef(new Map<number, { x: number; y: number }>());
  const editorGesture = useRef<{ distance: number; zoom: number } | null>(null);

  useEffect(() => {
    if (!previewRef.current) return;
    void renderCollage(previewRef.current, photos, form, dealer, consultant, selectedPhoto);
  }, [photos, form, dealer, consultant, selectedPhoto]);

  useEffect(() => {
    void fetchServerSettings().then((saved) => {
      setDealer(saved?.dealer ?? loadDealer());
      setConsultant(saved?.consultant ?? loadConsultant());
    });
  }, []);

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

  const choosePhotoCount = (count: number) => {
    setPhotoCount(count);
    setPhotos((current) => {
      current.slice(count).forEach((photo) => URL.revokeObjectURL(photo.url));
      return current.slice(0, count);
    });
    setSelectedPhoto(0);
    setNotice(`${count}-photo layout selected. Follow the guide for each picture.`);
  };

  const acceptPhoto = async (file: File | undefined) => {
    if (!file || !file.type.startsWith("image/") || photoCount === null) return;
    const bitmap = await createImageBitmap(file);
    const ratio = bitmap.width / bitmap.height;
    bitmap.close();
    const nextPhoto = { id: `${file.name}-${file.lastModified}-${uploadSlot}`, file, url: URL.createObjectURL(file), zoom: 1, x: 50, y: 50, ratio };
    setPhotos((current) => {
      const next = [...current];
      if (next[uploadSlot]) URL.revokeObjectURL(next[uploadSlot].url);
      next[uploadSlot] = nextPhoto;
      return next.filter(Boolean).slice(0, photoCount);
    });
    setSelectedPhoto(uploadSlot);
    setNotice(`Photo ${uploadSlot + 1} added. Drag it in the final preview to fine-tune the crop.`);
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
    didDragRef.current = false;
    dragRef.current = { index, startX: event.clientX, startY: event.clientY, initialX: photo.x, initialY: photo.y };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const moveDrag = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const drag = dragRef.current;
    const canvas = previewRef.current;
    if (!drag || !canvas) return;
    if (Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) > 4) didDragRef.current = true;
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
      ? { ...photo, zoom: Math.max(0.5, Math.min(3, Number((photo.zoom + amount).toFixed(2)))) }
      : photo));
  };

  const openPhotoEditor = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (didDragRef.current) return;
    const index = chooseSlot(event.clientX, event.clientY);
    if (index < 0) return;
    setSelectedPhoto(index);
    setEditorOpen(true);
  };

  const updatePhotoPosition = (index: number, x: number, y: number) => {
    setPhotos((current) => current.map((photo, photoIndex) => photoIndex === index
      ? { ...photo, x: Math.max(0, Math.min(100, x)), y: Math.max(0, Math.min(100, y)) }
      : photo));
  };

  const editorPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    editorPointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    event.currentTarget.setPointerCapture(event.pointerId);
    if (editorPointers.current.size === 2) {
      const points = [...editorPointers.current.values()];
      editorGesture.current = { distance: Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y), zoom: photos[selectedPhoto].zoom };
    }
  };

  const editorPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const previous = editorPointers.current.get(event.pointerId);
    if (!previous) return;
    editorPointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (editorPointers.current.size === 2 && editorGesture.current) {
      const points = [...editorPointers.current.values()];
      const distance = Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
      const zoom = Math.max(0.5, Math.min(3, editorGesture.current.zoom * distance / editorGesture.current.distance));
      setPhotos((current) => current.map((photo, index) => index === selectedPhoto ? { ...photo, zoom } : photo));
      return;
    }
    if (editorPointers.current.size === 1) {
      const rect = event.currentTarget.getBoundingClientRect();
      const photo = photos[selectedPhoto];
      updatePhotoPosition(selectedPhoto, photo.x - ((event.clientX - previous.x) / rect.width) * 100, photo.y - ((event.clientY - previous.y) / rect.height) * 100);
    }
  };

  const editorPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    editorPointers.current.delete(event.pointerId);
    editorGesture.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };

  const removePhoto = (indexToRemove: number) => {
    setPhotos((current) => {
      URL.revokeObjectURL(current[indexToRemove].url);
      return current.filter((_, index) => index !== indexToRemove);
    });
    setSelectedPhoto((current) => Math.max(0, Math.min(current > indexToRemove ? current - 1 : current, photos.length - 2)));
    setNotice(`Photo ${indexToRemove + 1} removed. Remaining photos reflowed.`);
  };

  const createCollage = async () => {
    if (!photoCount || photos.length !== photoCount) {
      setNotice(`Add all ${photoCount ?? "required"} photos before downloading.`);
      return;
    }
    try {
      setNotice("Building the complete collage…");
      const canvas = document.createElement("canvas");
      await renderCollage(canvas, photos, form, dealer, consultant);
      const blob = await canvasToPngBlob(canvas);
      const downloadUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.download = `${[form.year, form.make, form.model].filter(Boolean).join("-") || "walker-vehicle"}-16x9-collage.png`;
      link.href = downloadUrl;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1_000);
      setNotice("The complete 1920 × 1080 collage downloaded as one PNG image.");
    } catch {
      setNotice("The collage did not download. Please try again after the photos finish loading.");
    }
  };

  const authFetch = async (url: string, init?: RequestInit) => {
    if (process.env.NEXT_PUBLIC_DISABLE_AUTH === "1") {
      return fetch(url, { ...init, headers: { ...init?.headers, authorization: "Bearer local-dev-token" } });
    }
    const { data: { session } } = await getSupabaseBrowserClient().auth.getSession();
    if (!session) throw new Error("Please log in again.");
    return fetch(url, { ...init, headers: { ...init?.headers, authorization: `Bearer ${session.access_token}` } });
  };

  useEffect(() => {
    const editId = new URLSearchParams(window.location.search).get("edit");
    if (!editId) return;
    void authFetch("/api/me/business-card").then(async (response) => {
      const result = await response.json();
      const draft = normalizeProfileContent(result.card?.draft, Boolean(result.isAdmin));
      const vehicle = draft.vehicles.find((item) => item.id === editId);
      if (!vehicle?.builderData) throw new Error("This older collage does not have editable source photos.");
      const project = vehicle.builderData;
      setEditingVehicleId(editId);
      setPhotoCount(project.photoCount);
      setForm((current) => ({ ...current, ...project.form }));
      setPhotos(project.photos.map((photo) => ({ id: crypto.randomUUID(), ...photo })));
      setNotice("Editable collage loaded. Update it, then save it back to your carousel draft.");
    }).catch((error) => setNotice(error instanceof Error ? error.message : "The collage could not be loaded."));
  }, []);

  const buildCollageBlob = async () => {
    const canvas = document.createElement("canvas");
    await renderCollage(canvas, photos, form, dealer, consultant);
    return canvasToPngBlob(canvas);
  };

  const addToCarousel = async () => {
    if (!photoCount || photos.length !== photoCount) {
      setNotice(`Add all ${photoCount ?? "required"} photos first.`);
      return;
    }
    const title = [form.year, form.make, form.model, form.trim].filter(Boolean).join(" ");
    if (!title || !form.walkerUrl.trim()) {
      setNotice("Enter the vehicle name and official Walker listing first.");
      return;
    }
    setSavingCarousel(true);
    setNotice("Adding the finished collage to your card draft…");
    try {
      const cardResponse = await authFetch("/api/me/business-card");
      const cardResult = await cardResponse.json();
      if (!cardResponse.ok || cardResult.permitted === false) throw new Error(cardResult.error || "Your business card could not be opened.");
      const draft = normalizeProfileContent(cardResult.card?.draft, Boolean(cardResult.isAdmin));
      const editingIndex = editingVehicleId ? draft.vehicles.findIndex((item) => item.id === editingVehicleId) : -1;
      if (editingIndex < 0 && draft.vehicles.length >= 6) throw new Error("Your carousel already has six vehicles. Delete one before adding another.");

      const sourcePhotos = await Promise.all(photos.map(async (photo, index) => {
        if (!photo.file) return { url: photo.url, zoom: photo.zoom, x: photo.x, y: photo.y, ratio: photo.ratio };
        const sourceBody = new FormData();
        sourceBody.append("file", photo.file, photo.file.name || `photo-${index + 1}.jpg`);
        sourceBody.append("category", "vehicles");
        const sourceResponse = await authFetch("/api/me/business-card", { method: "POST", body: sourceBody });
        const sourceResult = await sourceResponse.json();
        if (!sourceResponse.ok) throw new Error(sourceResult.error || `Photo ${index + 1} could not be saved.`);
        return { url: sourceResult.url, zoom: photo.zoom, x: photo.x, y: photo.y, ratio: photo.ratio };
      }));

      const blob = await buildCollageBlob();
      const uploadBody = new FormData();
      uploadBody.append("file", blob, `${[form.year, form.make, form.model].filter(Boolean).join("-") || "vehicle"}-collage.png`);
      uploadBody.append("category", "vehicles");
      const uploadResponse = await authFetch("/api/me/business-card", { method: "POST", body: uploadBody });
      const uploadResult = await uploadResponse.json();
      if (!uploadResponse.ok) throw new Error(uploadResult.error || "The collage could not be uploaded.");

      const vehicle = {
        id: editingVehicleId || crypto.randomUUID(),
        title,
        description: form.mileage ? `${form.mileage} miles` : "",
        url: form.walkerUrl.trim(),
        imageUrl: uploadResult.url,
        secondaryUrl: form.vin.trim(),
        meta: [form.price.trim(), form.stock.trim() ? `Stock ${form.stock.trim()}` : ""].filter(Boolean).join(" · "),
        builderData: { photoCount, form: { ...form }, photos: sourcePhotos },
      };
      const vehicles = editingIndex >= 0
        ? draft.vehicles.map((item, index) => index === editingIndex ? vehicle : item)
        : [...draft.vehicles, vehicle];
      const saveResponse = await authFetch("/api/me/business-card", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "draft", draft: { ...draft, vehicles } }),
      });
      const saveResult = await saveResponse.json();
      if (!saveResponse.ok) throw new Error(saveResult.error || "The carousel draft could not be saved.");
      setNotice(editingIndex >= 0 ? "Collage updated in your card draft. Press Publish when you are ready." : "Added to your carousel draft. Open Business Card and press Publish when you are ready.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "The collage could not be added to your carousel.");
    } finally {
      setSavingCarousel(false);
    }
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
  const editorSlot = active ? getSlots(photos.length)[selectedPhoto] : null;
  const editorFrameRatio = editorSlot ? editorSlot.w / editorSlot.h : 1;
  const editorBaseWidth = active && active.ratio > editorFrameRatio ? (active.ratio / editorFrameRatio) * 100 : 100;
  const editorBaseHeight = active && active.ratio > editorFrameRatio ? 100 : active ? (editorFrameRatio / active.ratio) * 100 : 100;
  const editorWidth = editorBaseWidth * (active?.zoom ?? 1);
  const editorHeight = editorBaseHeight * (active?.zoom ?? 1);
  const editorLeft = editorWidth >= 100 ? -(editorWidth - 100) * ((active?.x ?? 50) / 100) : (100 - editorWidth) / 2;
  const editorTop = editorHeight >= 100 ? -(editorHeight - 100) * ((active?.y ?? 50) / 100) : (100 - editorHeight) / 2;

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.header}>
          <p>Consultant backend</p>
          <h1>Vehicle Collage Builder</h1>
          <span>Build a true 1920 × 1080 collage. What you see is exactly what downloads.</span>
        </header>

        <details className={styles.panel} open>
          <summary><span>01</span> How many photos?</summary>
          <div className={styles.panelBody}>
            <p className={styles.helperText}>Choose a layout first. The builder will then tell you which vehicle views fit each space.</p>
            <div className={styles.layoutCatalog}>
              {[1, 2, 3, 4, 5].map((count) => (
                <button
                  key={count}
                  type="button"
                  className={photoCount === count ? styles.layoutActive : styles.layoutChoice}
                  onClick={() => choosePhotoCount(count)}
                  aria-pressed={photoCount === count}
                >
                  <span className={`${styles.layoutDiagram} ${styles[`layout${count}`]}`}>
                    {Array.from({ length: count }, (_, index) => <i key={index}>{index + 1}</i>)}
                  </span>
                  <strong>{count} photo{count > 1 ? "s" : ""}</strong>
                </button>
              ))}
            </div>
          </div>
        </details>

        <details className={styles.panel} open>
          <summary><span>02</span> Vehicle information</summary>
          <div className={styles.panelBody}>
            <div className={styles.grid}>
              <label>Year<input inputMode="numeric" value={form.year} onChange={update("year")} /></label>
              <label>Make<input value={form.make} onChange={update("make")} /></label>
              <label>Model<input value={form.model} onChange={update("model")} /></label>
              <label>Trim<input value={form.trim} onChange={update("trim")} /></label>
              <label>VIN<input value={form.vin} onChange={update("vin")} /></label>
              <label>Stock number<input value={form.stock} onChange={update("stock")} /></label>
              <label>Mileage<input inputMode="numeric" value={form.mileage} onChange={update("mileage")} /></label>
              <label>Price<input value={form.price} onChange={update("price")} placeholder="$00,000" /></label>
            </div>
            <label>Official Walker listing<input type="url" value={form.walkerUrl} onChange={update("walkerUrl")} /></label>
            <div className={styles.savedInfo}>
              <strong>Added from your saved settings</strong>
              <span>{consultant.name || "Consultant name not set"} · {consultant.phone || "Phone not set"}</span>
              <span>{dealer.dealershipName || "Dealership not set"}{getDealerFullAddress(dealer) ? ` · ${getDealerFullAddress(dealer)}` : ""}</span>
            </div>
          </div>
        </details>

        <details className={styles.panel} open>
          <summary><span>03</span> Add and position photos</summary>
          <div className={styles.panelBody}>
            {photoCount === null ? (
              <p className={styles.emptyGuide}>Choose the number of photos above to see the upload guide.</p>
            ) : (
              <div className={styles.photoQuestions}>
                {PHOTO_GUIDES[photoCount].map((guide, index) => {
                  const photo = photos[index];
                  const locked = index > photos.length;
                  return (
                    <button
                      key={`${photoCount}-${index}`}
                      type="button"
                      className={photo ? styles.photoQuestionReady : styles.photoQuestion}
                      disabled={locked}
                      onClick={() => { setUploadSlot(index); inputRef.current?.click(); }}
                    >
                      <span>Photo {index + 1}</span>
                      <strong>{guide.view}</strong>
                      <em>{guide.shape}</em>
                      <small>{photo ? "Photo added — tap to replace" : locked ? "Add the previous photo first" : guide.note}</small>
                    </button>
                  );
                })}
                <input ref={inputRef} hidden type="file" accept="image/*" onChange={(event) => { void acceptPhoto(event.target.files?.[0]); event.currentTarget.value = ""; }} />
              </div>
            )}

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
                    onClick={openPhotoEditor}
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
                  <span>Photo {selectedPhoto + 1} — drag the vehicle into place</span>
                  <div>
                    <button type="button" disabled={!active || active.zoom <= 0.5} onClick={() => adjustZoom(-0.1)} aria-label="Zoom selected photo out">−</button>
                    <strong>{active ? Math.round(active.zoom * 100) : 100}%</strong>
                    <button type="button" onClick={() => adjustZoom(0.1)} aria-label="Zoom selected photo in">+</button>
                  </div>
                </div>
              </section>
            )}
            <div className={styles.actions}>
              <button className={styles.primary} type="button" disabled={!photoCount || photos.length !== photoCount} onClick={createCollage}>Download collage</button>
              <button className={styles.secondary} type="button" disabled={savingCarousel || !photoCount || photos.length !== photoCount} onClick={addToCarousel}>{savingCarousel ? "Saving…" : editingVehicleId ? "Update Carousel Collage" : "Add to My Carousel"}</button>
            </div>
          </div>
        </details>

        <details className={styles.panel} open>
          <summary><span>04</span> Facebook-ready posts</summary>
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
          <summary><span>05</span> GPT post prompt</summary>
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

      {editorOpen && active && editorSlot && (
        <div className={styles.editorBackdrop} role="dialog" aria-modal="true" aria-label={`Edit photo ${selectedPhoto + 1}`}>
          <div className={styles.editorPanel}>
            <div className={styles.editorHeading}>
              <div><strong>Position photo {selectedPhoto + 1}</strong><span>Drag with one finger · pinch with two</span></div>
              <button type="button" onClick={() => setEditorOpen(false)} aria-label="Close photo editor">×</button>
            </div>
            <div
              className={styles.editorFrame}
              style={{ aspectRatio: `${editorSlot.w} / ${editorSlot.h}` }}
              onPointerDown={editorPointerDown}
              onPointerMove={editorPointerMove}
              onPointerUp={editorPointerUp}
              onPointerCancel={editorPointerUp}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className={styles.editorBackground} src={active.url} alt="" draggable={false} aria-hidden="true" />
              {/* A local object URL is required here for immediate canvas-matched cropping. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                className={styles.editorForeground}
                src={active.url}
                alt="Vehicle crop preview"
                draggable={false}
                style={{ width: `${editorWidth}%`, height: `${editorHeight}%`, left: `${editorLeft}%`, top: `${editorTop}%` }}
              />
            </div>
            <div className={styles.editorControls}>
              <button type="button" disabled={active.zoom <= 0.5} onClick={() => adjustZoom(-0.1)}>−</button>
              <span>{Math.round(active.zoom * 100)}%</span>
              <button type="button" disabled={active.zoom >= 3} onClick={() => adjustZoom(0.1)}>+</button>
            </div>
            <button className={styles.primary} type="button" onClick={() => setEditorOpen(false)}>Done</button>
          </div>
        </div>
      )}
    </main>
  );
}
