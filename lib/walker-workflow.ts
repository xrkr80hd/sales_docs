export const WORKFLOW_STORAGE_KEY = "walker.walkthrough.workflow.v1";
export const SIGNATURE_STORAGE_KEY = "walker.signature.v1";
export const DELIVERY_CHECKLIST_NOTES_STORAGE_KEY =
  "walker.document.deliveryChecklist.v1";
export const WORKFLOW_SESSION_CHANNEL_NAME = "walker.workflow.session.v1";
export const WORKFLOW_SESSION_CLEAR_EVENT = "workflow-session-cleared";
const WORKFLOW_CREATED_AT_KEY = "walker.workflow.created-at.v1";
const WORKFLOW_MAX_AGE_MS = 24 * 60 * 60 * 1000;

export const CHECKLIST_ITEMS = [
  { key: "validDriversLicense", label: "Valid Driver's License" },
  { key: "proofOfInsurance", label: "Proof of Insurance" },
  { key: "weOweUpfit", label: "We Owe/ Up-fit" },
  { key: "gmsSupplierMilitaryId", label: "GMS/Supplier/Military ID" },
  { key: "vinIncentiveLookup", label: "VIN Incentive Lookup" },
  { key: "inServiceDate", label: "In Service Date" },
  { key: "miles", label: "Miles" },
  { key: "carfaxUsed", label: "Carfax (used)" },
  { key: "etchNumbers", label: "Etch #'s" },
] as const;

export const REQUIRED_DOCS_SECTIONS = [
  {
    key: "identification",
    title: "Identification",
    description: "Customer must present one valid form of ID",
    items: [
      "Valid driver\u2019s license (not expired)",
      "State-issued photo ID",
      "U.S. military ID (active duty)",
      "Passport or passport card",
    ],
  },
  {
    key: "insurance",
    title: "Proof of Insurance",
    description: "Must cover the vehicle being purchased",
    items: [
      "Current insurance card (physical or app)",
      "Insurance declaration page / printout",
      "Binder letter from agent (if purchasing same-day coverage)",
    ],
  },
  {
    key: "creditFinance",
    title: "Credit / Finance Docs",
    description: "Required if the customer is financing",
    items: [
      "Signed credit application with references",
      "Authorization to submit credit",
      "Proof of income \u2014 pay stubs, tax returns (if lender requires)",
      "Proof of residence \u2014 utility bill, bank statement (if lender requires)",
    ],
  },
  {
    key: "tradeInDocs",
    title: "Trade-In Documents",
    description: "Required if customer has a trade",
    items: [
      "Vehicle title (or payoff authorization letter)",
      "Current registration",
      "All keys, remotes, and fobs",
    ],
  },
  {
    key: "delivery",
    title: "At Delivery",
    description: "Verify before customer drives off",
    items: [
      "Signed buyer\u2019s agreement",
      "Factory invoice / Federal Buyer\u2019s Guide (used vehicles)",
      "We Owe / Up-fit agreement (if applicable)",
      "Temp tag displayed",
    ],
  },
] as const;

export type RequiredDocsSectionKey = (typeof REQUIRED_DOCS_SECTIONS)[number]["key"];

export const DELIVERY_CHECKLIST_ENTRY_FIELDS = [
  { id: "bmwKeyRead", label: "BMW Key Read" },
  { id: "taxWatch", label: "Tax Watch" },
  { id: "gcwr", label: "# (lbs)GCWR" },
  { id: "signedBuyerAgreement", label: "Signed Buyer's Agreement" },
  {
    id: "signedCreditAppReferences",
    label: "Signed Credit App. W/ References",
  },
  {
    id: "authorizationToSubmitCredit",
    label: "Authorization To Submit Credit",
  },
  {
    id: "factoryInvFederalBuyerGuide",
    label: "Factory Inv./Fed. Buyer's Guide",
  },
  { id: "asIsCertifiedPacket", label: "As Is/Certified/CPO Packet" },
  { id: "firstServiceVisit", label: "First Service Visit" },
  { id: "deliveryChecklistNew", label: "Delivery Check List (new)" },
] as const;

export const ACCOUNTING_LEFT_FIELDS = [
  "downPaymentPostedInAccounting",
  "afterMarketProducts",
  "payoffCheckCut",
  "trackingNumberForPayoffCheck",
  "cancellations",
  "fundingSent",
  "finalizedDealInAccounting",
] as const;

export const ACCOUNTING_RIGHT_FIELDS = [
  "titleWorksheet",
  "receivedTradeTitle",
  "tradeTitlePaperworkSent",
  "receivedPlateRegistration",
  "loggedInSpreadsheet",
] as const;

export const DOCUMENT_LIBRARY = [
  {
    slug: "spaced",
    title: "SPACED Sheet",
    description:
      "Standalone sales tool — priority selling points and customer concerns.",
    href: "/documents/spaced",
    printHref: "/print/spaced",
    stage: "Deal Form",
    ready: true,
  },
  {
    slug: "payoff-form",
    title: "Trade Info",
    description:
      "Trade-in vehicle details, lienholder, payoff, and signatures.",
    href: "/documents/payoff-form",
    printHref: "/print/payoff-form",
    stage: "Deal Form",
    ready: true,
  },
  {
    slug: "address-information",
    title: "Address Information Sheet",
    description:
      "Physical and mailing address details.",
    href: "/documents/address-information",
    printHref: "/print/address-information",
    stage: "Deal Form",
    ready: true,
  },
  {
    slug: "vin-verification",
    title: "VIN Verification",
    description:
      "VIN confirmation and salesperson signature.",
    href: "/documents/vin-verification",
    printHref: "/print/vin-verification",
    stage: "Deal Form",
    ready: true,
  },
  {
    slug: "buyers-guide",
    title: "Buyers Guide",
    description:
      "Federal warranty disclosure and dealer contact (2 pages).",
    href: "/documents/buyers-guide",
    printHref: "/print/buyers-guide",
    stage: "Deal Form",
    ready: true,
  },
  {
    slug: "delivery-checklist",
    title: "Review Delivery Checklist",
    description:
      "Customer info, checklist items, and accounting fields.",
    href: "/documents/delivery-checklist",
    printHref: "/print/delivery-checklist",
    stage: "Deal Form",
    ready: true,
  },
] as const;

export type ChecklistKey = (typeof CHECKLIST_ITEMS)[number]["key"];
export type DeliveryChecklistNoteKey =
  | (typeof DELIVERY_CHECKLIST_ENTRY_FIELDS)[number]["id"]
  | (typeof ACCOUNTING_LEFT_FIELDS)[number]
  | (typeof ACCOUNTING_RIGHT_FIELDS)[number]
  | "titleToTrade"
  | "currentRegistration"
  | "acvAppraisalForm"
  | "lienholder"
  | "physicalAddressLine1"
  | "physicalAddressLine2"
  | "accountNumber"
  | "payoffAmount"
  | "goodUntil"
  | "spokeTo"
  | "dateReceivedInOffice";

export type WorkflowData = {
  customerName: string;
  coCustomerName: string;
  dealDate: string;
  email: string;
  cellPhone: string;
  homeAddressCategory: string;
  mailingAddressCategory: string;
  homeAddress: string;
  homeCity: string;
  homeState: string;
  homeZip: string;
  mailingDifferent: boolean;
  mailingAddress: string;
  mailingCity: string;
  mailingState: string;
  mailingZip: string;
  address: string;
  salespersonName: string;
  salespersonNumber: string;
  dealNumber: string;
  stockNumber: string;
  stockNumberLetter: string;
  customerSource: string;
  vehicleYear: string;
  vehicleMake: string;
  vehicleModel: string;
  mileage: string;
  etchNumbers: string;
  taxPercent: string;
  vin: string;
  hasCoOwner: boolean;
  payoffVerified: boolean;
  deliveryEnabled: boolean;
  deliveryChecklist: Record<ChecklistKey, boolean>;
  tradeIn: "" | "yes" | "no";
  approxBalance: string;
  currentPayment: string;
  lienholderName: string;
  lienholderPhone: string;
  lienholderAddress: string;
  payoff15Day: string;
  goodUntilDate: string;
  payoffToday: string;
  accountNumber: string;
  perDiem: string;
  socialSecurityNumber: string;
  representativeName: string;
  repDate: string;
  verifiedBy: string;
  newBudget: string;
  prioritySafety: string;
  priorityPerformance: string;
  priorityAppearance: string;
  priorityComfort: string;
  priorityEconomy: string;
  priorityDependability: string;
  priorityOther: string;
  spacedConfirmed: boolean;
  vehicleOfInterest: string;
  tradeYear: string;
  tradeMake: string;
  tradeModel: string;
  tradeVin: string;
  tradeColor: string;
  tradeMileage: string;
  specialtyPlate: "" | "yes" | "no";
  dealType: "" | "new" | "used";
  signedBuyerAgreement: boolean;
  factoryInvBuyerGuide: boolean;
  firstServiceVisitDate: string;
  sectionComplete: Record<string, boolean>;
};

export type DeliveryChecklistNotes = Partial<
  Record<DeliveryChecklistNoteKey, string>
>;

export type SignatureStore = Record<string, string>;

function isBrowser() {
  return typeof window !== "undefined";
}

function getBrowserStorage() {
  if (!isBrowser()) {
    return null;
  }

  return window.sessionStorage;
}

function clearExpiredWorkflowSession(storage: Storage) {
  const createdAt = Number(storage.getItem(WORKFLOW_CREATED_AT_KEY));
  if (!createdAt || Date.now() - createdAt < WORKFLOW_MAX_AGE_MS) return false;

  storage.removeItem(WORKFLOW_STORAGE_KEY);
  storage.removeItem(SIGNATURE_STORAGE_KEY);
  storage.removeItem(DELIVERY_CHECKLIST_NOTES_STORAGE_KEY);
  storage.removeItem(WORKFLOW_CREATED_AT_KEY);
  storage.removeItem("walker.deal.id.v1");
  storage.removeItem("walker.workflow.view.v1");
  return true;
}

function ensureWorkflowCreatedAt(storage: Storage) {
  clearExpiredWorkflowSession(storage);
  if (!storage.getItem(WORKFLOW_CREATED_AT_KEY)) {
    storage.setItem(WORKFLOW_CREATED_AT_KEY, String(Date.now()));
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function safeTrim(value: unknown) {
  return String(value ?? "").trim();
}

export function cleanSingleLine(value: unknown) {
  return safeTrim(value).replace(/[\r\n]+/g, " ");
}

export function normalizeVin(value: unknown) {
  return safeTrim(value).toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 17);
}

export function formatDate(value: string) {
  if (!value) {
    return "";
  }

  const [year, month, day] = String(value).split("-");
  if (!year || !month || !day) {
    return value;
  }

  return `${month}/${day}/${year}`;
}

export function getLast8(vin: string) {
  const normalized = normalizeVin(vin);
  return normalized.length >= 8 ? normalized.slice(-8) : normalized;
}

export function getYearMakeModel(
  data: Pick<WorkflowData, "vehicleYear" | "vehicleMake" | "vehicleModel">,
) {
  return [
    safeTrim(data.vehicleYear),
    safeTrim(data.vehicleMake),
    safeTrim(data.vehicleModel),
  ]
    .filter(Boolean)
    .join(" ");
}

export function getFullStockNumber(
  data: Pick<WorkflowData, "stockNumber" | "stockNumberLetter">,
) {
  return `${safeTrim(data.stockNumber)}${safeTrim(data.stockNumberLetter)}`;
}

export function getDefaultDate() {
  return new Date().toISOString().slice(0, 10);
}

export function createEmptyChecklist() {
  return CHECKLIST_ITEMS.reduce(
    (result, item) => {
      result[item.key] = false;
      return result;
    },
    {} as Record<ChecklistKey, boolean>,
  );
}

export function createDefaultWorkflowData(): WorkflowData {
  return {
    customerName: "",
    coCustomerName: "",
    dealDate: getDefaultDate(),
    email: "",
    cellPhone: "",
    homeAddressCategory: "Home Address",
    mailingAddressCategory: "Mailing Address",
    homeAddress: "",
    homeCity: "",
    homeState: "",
    homeZip: "",
    mailingDifferent: false,
    mailingAddress: "",
    mailingCity: "",
    mailingState: "",
    mailingZip: "",
    address: "",
    salespersonName: "",
    salespersonNumber: "",
    dealNumber: "",
    stockNumber: "",
    stockNumberLetter: "",
    customerSource: "",
    vehicleYear: "",
    vehicleMake: "",
    vehicleModel: "",
    mileage: "",
    etchNumbers: "",
    taxPercent: "",
    vin: "",
    hasCoOwner: false,
    payoffVerified: false,
    deliveryEnabled: true,
    deliveryChecklist: createEmptyChecklist(),
    tradeIn: "",
    approxBalance: "",
    currentPayment: "",
    lienholderName: "",
    lienholderPhone: "",
    lienholderAddress: "",
    payoff15Day: "",
    goodUntilDate: "",
    payoffToday: "",
    accountNumber: "",
    perDiem: "",
    socialSecurityNumber: "",
    representativeName: "",
    repDate: "",
    verifiedBy: "",
    newBudget: "",
    prioritySafety: "",
    priorityPerformance: "",
    priorityAppearance: "",
    priorityComfort: "",
    priorityEconomy: "",
    priorityDependability: "",
    priorityOther: "",
    spacedConfirmed: false,
    vehicleOfInterest: "",
    tradeYear: "",
    tradeMake: "",
    tradeModel: "",
    tradeVin: "",
    tradeColor: "",
    tradeMileage: "",
    specialtyPlate: "",
    dealType: "",
    signedBuyerAgreement: false,
    factoryInvBuyerGuide: false,
    firstServiceVisitDate: "",
    sectionComplete: {},
  };
}

export function normalizeWorkflowData(value: unknown): WorkflowData {
  const base = createDefaultWorkflowData();
  if (!isRecord(value)) {
    return base;
  }

  const deliveryChecklist = isRecord(value.deliveryChecklist)
    ? value.deliveryChecklist
    : {};

  const nextChecklist = { ...createEmptyChecklist() };
  for (const item of CHECKLIST_ITEMS) {
    nextChecklist[item.key] = Boolean(deliveryChecklist[item.key]);
  }

  const homeAddress = safeTrim(value.homeAddress ?? value.address);

  return {
    customerName: safeTrim(value.customerName),
    coCustomerName: safeTrim(value.coCustomerName),
    dealDate: safeTrim(value.dealDate) || base.dealDate,
    email: safeTrim(value.email),
    cellPhone: safeTrim(value.cellPhone),
    homeAddressCategory:
      safeTrim(value.homeAddressCategory) || base.homeAddressCategory,
    mailingAddressCategory:
      safeTrim(value.mailingAddressCategory) || base.mailingAddressCategory,
    homeAddress,
    homeCity: safeTrim(value.homeCity),
    homeState: safeTrim(value.homeState),
    homeZip: safeTrim(value.homeZip),
    mailingDifferent: Boolean(value.mailingDifferent),
    mailingAddress: safeTrim(value.mailingAddress),
    mailingCity: safeTrim(value.mailingCity),
    mailingState: safeTrim(value.mailingState),
    mailingZip: safeTrim(value.mailingZip),
    address: homeAddress,
    salespersonName: safeTrim(value.salespersonName),
    salespersonNumber: safeTrim(value.salespersonNumber),
    dealNumber: safeTrim(value.dealNumber),
    stockNumber: safeTrim(value.stockNumber),
    stockNumberLetter: safeTrim(value.stockNumberLetter),
    customerSource: safeTrim(value.customerSource),
    vehicleYear: safeTrim(value.vehicleYear),
    vehicleMake: safeTrim(value.vehicleMake),
    vehicleModel: safeTrim(value.vehicleModel),
    mileage: safeTrim(value.mileage),
    etchNumbers: safeTrim(value.etchNumbers),
    taxPercent: safeTrim(value.taxPercent),
    vin: normalizeVin(value.vin),
    hasCoOwner:
      typeof value.hasCoOwner === "boolean" ? value.hasCoOwner : false,
    payoffVerified:
      typeof value.payoffVerified === "boolean" ? value.payoffVerified : false,
    deliveryEnabled:
      typeof value.deliveryEnabled === "boolean" ? value.deliveryEnabled : true,
    deliveryChecklist: nextChecklist,
    tradeIn: safeTrim(value.tradeIn) === "yes" ? "yes" : safeTrim(value.tradeIn) === "no" ? "no" : "",
    approxBalance: safeTrim(value.approxBalance),
    currentPayment: safeTrim(value.currentPayment),
    lienholderName: safeTrim(value.lienholderName),
    lienholderPhone: safeTrim(value.lienholderPhone),
    lienholderAddress: safeTrim(value.lienholderAddress),
    payoff15Day: safeTrim(value.payoff15Day),
    goodUntilDate: safeTrim(value.goodUntilDate),
    payoffToday: safeTrim(value.payoffToday),
    accountNumber: safeTrim(value.accountNumber),
    perDiem: safeTrim(value.perDiem),
    socialSecurityNumber: safeTrim(value.socialSecurityNumber),
    representativeName: safeTrim(value.representativeName),
    repDate: safeTrim(value.repDate),
    verifiedBy: safeTrim(value.verifiedBy),
    newBudget: safeTrim(value.newBudget),
    prioritySafety: safeTrim(value.prioritySafety),
    priorityPerformance: safeTrim(value.priorityPerformance),
    priorityAppearance: safeTrim(value.priorityAppearance),
    priorityComfort: safeTrim(value.priorityComfort),
    priorityEconomy: safeTrim(value.priorityEconomy),
    priorityDependability: safeTrim(value.priorityDependability),
    priorityOther: safeTrim(value.priorityOther),
    spacedConfirmed: typeof value.spacedConfirmed === "boolean" ? value.spacedConfirmed : false,
    vehicleOfInterest: safeTrim(value.vehicleOfInterest),
    tradeYear: safeTrim(value.tradeYear),
    tradeMake: safeTrim(value.tradeMake),
    tradeModel: safeTrim(value.tradeModel),
    tradeVin: safeTrim(value.tradeVin),
    tradeColor: safeTrim(value.tradeColor),
    tradeMileage: safeTrim(value.tradeMileage),
    specialtyPlate: safeTrim(value.specialtyPlate) === "yes" ? "yes" : safeTrim(value.specialtyPlate) === "no" ? "no" : "",
    dealType: safeTrim(value.dealType) === "new" ? "new" : safeTrim(value.dealType) === "used" ? "used" : "",
    signedBuyerAgreement:
      typeof value.signedBuyerAgreement === "boolean" ? value.signedBuyerAgreement : false,
    factoryInvBuyerGuide:
      typeof value.factoryInvBuyerGuide === "boolean" ? value.factoryInvBuyerGuide : false,
    firstServiceVisitDate: safeTrim(value.firstServiceVisitDate),
    sectionComplete: isRecord(value.sectionComplete)
      ? Object.fromEntries(
        Object.entries(value.sectionComplete).map(([k, v]) => [k, Boolean(v)]),
      )
      : {},
  };
}

export function getCustomerDisplayName(
  data: Pick<WorkflowData, "customerName" | "coCustomerName">,
) {
  return [safeTrim(data.customerName), safeTrim(data.coCustomerName)]
    .filter(Boolean)
    .join(" / ");
}

function broadcastWorkflowSessionCleared() {
  if (!isBrowser() || typeof BroadcastChannel === "undefined") {
    return;
  }

  const channel = new BroadcastChannel(WORKFLOW_SESSION_CHANNEL_NAME);
  channel.postMessage({ type: WORKFLOW_SESSION_CLEAR_EVENT });
  channel.close();
}

export function clearWorkflowSession(options: { broadcast?: boolean } = {}) {
  const storage = getBrowserStorage();

  storage?.removeItem(WORKFLOW_STORAGE_KEY);
  storage?.removeItem(SIGNATURE_STORAGE_KEY);
  storage?.removeItem(DELIVERY_CHECKLIST_NOTES_STORAGE_KEY);
  storage?.removeItem(WORKFLOW_CREATED_AT_KEY);
  storage?.removeItem("walker.deal.id.v1");
  storage?.removeItem("walker.workflow.view.v1");

  if (options.broadcast !== false) {
    broadcastWorkflowSessionCleared();
  }
}

export function subscribeToWorkflowSessionClear(onClear: () => void) {
  if (!isBrowser() || typeof BroadcastChannel === "undefined") {
    return () => undefined;
  }

  const channel = new BroadcastChannel(WORKFLOW_SESSION_CHANNEL_NAME);
  channel.onmessage = (event: MessageEvent<{ type?: string }>) => {
    if (event.data?.type === WORKFLOW_SESSION_CLEAR_EVENT) {
      onClear();
    }
  };

  return () => channel.close();
}

export function loadWorkflow() {
  const storage = getBrowserStorage();
  if (!storage) {
    return createDefaultWorkflowData();
  }

  clearExpiredWorkflowSession(storage);

  try {
    return normalizeWorkflowData(JSON.parse(storage.getItem(WORKFLOW_STORAGE_KEY) || "{}"));
  } catch {
    return createDefaultWorkflowData();
  }
}

export function saveWorkflow(data: WorkflowData) {
  const next = normalizeWorkflowData(data);
  const storage = getBrowserStorage();
  if (storage) {
    ensureWorkflowCreatedAt(storage);
    storage.setItem(WORKFLOW_STORAGE_KEY, JSON.stringify(next));
  }
  return next;
}

export function loadSignatures() {
  const storage = getBrowserStorage();
  if (!storage) {
    return {};
  }

  clearExpiredWorkflowSession(storage);

  try {
    return JSON.parse(storage.getItem(SIGNATURE_STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

export function saveSignatures(store: SignatureStore) {
  const storage = getBrowserStorage();
  if (storage) {
    ensureWorkflowCreatedAt(storage);
    storage.setItem(SIGNATURE_STORAGE_KEY, JSON.stringify(store));
  }
  return store;
}

export function signatureIdFor(
  pathname: string,
  explicitId: string | undefined,
  index: number,
) {
  return explicitId || `${pathname}#signature-${index}`;
}

export function loadDeliveryChecklistNotes() {
  const storage = getBrowserStorage();
  if (!storage) {
    return {};
  }

  clearExpiredWorkflowSession(storage);

  try {
    return JSON.parse(
      storage.getItem(DELIVERY_CHECKLIST_NOTES_STORAGE_KEY) || "{}",
    ) as DeliveryChecklistNotes;
  } catch {
    return {};
  }
}

export function saveDeliveryChecklistNotes(notes: DeliveryChecklistNotes) {
  const next = Object.fromEntries(
    Object.entries(notes).filter(([, value]) => cleanSingleLine(value)),
  ) as DeliveryChecklistNotes;

  const storage = getBrowserStorage();
  if (storage) {
    ensureWorkflowCreatedAt(storage);
    storage.setItem(DELIVERY_CHECKLIST_NOTES_STORAGE_KEY, JSON.stringify(next));
  }

  return next;
}
