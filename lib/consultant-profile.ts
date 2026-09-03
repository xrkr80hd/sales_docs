export type ProfileIdentity = {
  displayName: string;
  jobTitle: string;
  dealership: string;
  location: string;
  phone: string;
  email: string;
  profileImageUrl: string;
  callingCardImageUrl: string;
  logoUrl: string;
  languageLabel: string;
};

export type ProfileListItem = {
  id: string;
  title: string;
  description: string;
  url: string;
  imageUrl: string;
  secondaryUrl?: string;
  meta?: string;
  builderData?: {
    photoCount: number;
    form: Record<string, string>;
    photos: Array<{ url: string; zoom: number; x: number; y: number; ratio: number }>;
  };
};

export type ConsultantProfileContent = {
  identity: ProfileIdentity;
  content: {
    primaryPhrase: string;
    salesQuote: string;
    bio: string;
    inventoryUrl: string;
    inventoryButtonLabel: string;
  };
  contact: { callLabel: string; textLabel: string; emailLabel: string };
  reviews: ProfileListItem[];
  vehicles: ProfileListItem[];
  soldGallery: ProfileListItem[];
  videos: ProfileListItem[];
  socialLinks: ProfileListItem[];
};

const item = (id: string, title: string, imageUrl: string, description = ""): ProfileListItem => ({
  id, title, description, imageUrl, url: "",
});

export const travDefaultContent: ConsultantProfileContent = {
  identity: {
    displayName: "Travis Wilkinson",
    jobTitle: "Sales Consultant",
    dealership: "Walker Automotive",
    location: "Alexandria, Louisiana",
    phone: "318-787-7887",
    email: "twilkinson@walkerautomotive.com",
    profileImageUrl: "/profiles/trav-walker.jpg",
    callingCardImageUrl: "/profiles/trav-call-card.jpg",
    logoUrl: "/branding/nxtdox-by-eben.png",
    languageLabel: "EN · ES",
  },
  content: {
    primaryPhrase: "#CallTrav",
    salesQuote: "I have full access to all seven Walker Automotive lots. If this isn’t it, we’ll find what you’re looking for.",
    bio: "",
    inventoryUrl: "https://www.walkerautomotive.com/",
    inventoryButtonLabel: "Browse Walker Inventory",
  },
  contact: { callLabel: "Call", textLabel: "Text", emailLabel: "Email" },
  reviews: [
    item("edward-ramer", "Edward Ramer", "/reviews/edward-ramer.jpg"),
    item("ciena-thompson", "Ciena Thompson", "/reviews/ciena-thompson.jpg"),
    item("sabrina-carter", "Sabrina Carter", "/reviews/sabrina-carter.jpg"),
    item("elise-leblanc", "Elise LeBlanc", "/reviews/elise-leblanc.jpg"),
    item("shonna-longino", "Shonna Longino", "/reviews/shonna-longino.jpg"),
    item("downing-glasscock", "Downing Glasscock", "/reviews/downing-glasscock.jpg"),
    item("angela-jeffress", "Angela Jeffress", "/reviews/angela-jeffress.jpg"),
    item("shane-pappas", "Shane Pappas", "/reviews/shane-pappas.jpg"),
    item("michael-christy", "Michael Christy", "/reviews/michael-christy.jpg"),
    item("christina-belvin", "Christina Belvin", "/reviews/christina-belvin.jpg"),
  ],
  vehicles: [
    { id: "ram-2500-laramie", title: "New 2026 RAM 2500 Laramie 4×4 Crew Cab", description: "6.4L V8 · 4WD · 8-speed automatic · Black interior", url: "https://www.walkercdjr.net/inventory/new-2026-ram-2500-laramie-4x4-crew-cab-3c6ur5fj8tg367952/", imageUrl: "https://vehicle-images.carscommerce.inc/e3a2-110005854/3C6UR5FJ8TG367952/64a7e95a66b6ac639f330cf1e34dc9fb.jpg", secondaryUrl: "3C6UR5FJ8TG367952", meta: "$67,598 · Stock TJ26336" },
    { id: "ram-1500-bighorn", title: "New 2026 RAM 1500 Big Horn/Lone Star 4×4 Crew Cab", description: "Granite Crystal Metallic · Black interior · 4×4 Crew Cab", url: "https://www.walkercdjr.net/inventory/new-2026-ram-1500-big-hornlone-star-4x4-crew-cab-1c6srfft4tn349096/", imageUrl: "https://vehicle-images.carscommerce.inc/4b21-11001967/1C6SRFFT4TN242517/0d926de4e644d17887ca9eaa2d802f2d.jpg", secondaryUrl: "1C6SRFFT4TN349096", meta: "$53,469 · Stock TJ26185" },
    { id: "ram-2500-black-express", title: "New 2026 RAM 2500 Black Express 4×4 Crew Cab", description: "Bright White Clearcoat · Black Express · 4×4 Crew Cab", url: "https://www.walkercdjr.net/inventory/new-2026-ram-2500-black-express-4x4-crew-cab-3c6ur5cj9tg367950/", imageUrl: "https://pictures.dealer.com/generic-stellantis-OEM_VIN_STOCK_PHOTOS/9ff8bd460de20858faddb4d37370e41d.jpg?impolicy=resize&w=1024", secondaryUrl: "3C6UR5CJ9TG367950", meta: "$61,795 · Stock TJ26335" },
  ],
  soldGallery: [],
  videos: [],
  socialLinks: [],
};

export const emptyConsultantContent = (seed?: Partial<ProfileIdentity>): ConsultantProfileContent => ({
  identity: {
    displayName: seed?.displayName || "",
    jobTitle: seed?.jobTitle || "Sales Consultant",
    dealership: seed?.dealership || "Walker Automotive",
    location: seed?.location || "Alexandria, Louisiana",
    phone: seed?.phone || "",
    email: seed?.email || "",
    profileImageUrl: seed?.profileImageUrl || "",
    callingCardImageUrl: seed?.callingCardImageUrl || "",
    logoUrl: seed?.logoUrl || "",
    languageLabel: seed?.languageLabel || "EN · ES",
  },
  content: {
    primaryPhrase: "",
    salesQuote: "",
    bio: "",
    inventoryUrl: "https://www.walkerautomotive.com/",
    inventoryButtonLabel: "Browse Walker Inventory",
  },
  contact: { callLabel: "Call", textLabel: "Text", emailLabel: "Email" },
  reviews: [],
  vehicles: [],
  soldGallery: [],
  videos: [],
  socialLinks: [],
});

export function normalizeProfileContent(value: unknown, isTrav = false): ConsultantProfileContent {
  const fallback = isTrav ? structuredClone(travDefaultContent) : emptyConsultantContent();
  if (!value || typeof value !== "object") return fallback;
  const candidate = value as Partial<ConsultantProfileContent>;
  return {
    identity: { ...fallback.identity, ...(candidate.identity ?? {}) },
    content: { ...fallback.content, ...(candidate.content ?? {}) },
    contact: { ...fallback.contact, ...(candidate.contact ?? {}) },
    reviews: Array.isArray(candidate.reviews) ? candidate.reviews : fallback.reviews,
    vehicles: Array.isArray(candidate.vehicles) ? candidate.vehicles : fallback.vehicles,
    soldGallery: Array.isArray(candidate.soldGallery) ? candidate.soldGallery : [],
    videos: Array.isArray(candidate.videos) ? candidate.videos : [],
    socialLinks: Array.isArray(candidate.socialLinks) ? candidate.socialLinks : [],
  };
}

export const newProfileItem = (): ProfileListItem => ({
  id: crypto.randomUUID(), title: "", description: "", url: "", imageUrl: "", secondaryUrl: "", meta: "",
});
