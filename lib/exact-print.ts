import {
  WORKFLOW_SESSION_CHANNEL_NAME,
  WORKFLOW_SESSION_CLEAR_EVENT,
} from "./walker-workflow";

function broadcastWorkflowSessionCleared() {
  try {
    const channel = new BroadcastChannel(WORKFLOW_SESSION_CHANNEL_NAME);
    channel.postMessage({ type: WORKFLOW_SESSION_CLEAR_EVENT });
    channel.close();
  } catch {
    // Ignore browsers that do not support BroadcastChannel.
  }
}

export function printCurrentWindowAndClear() {
  const clear = () => {
    broadcastWorkflowSessionCleared();
  };

  window.addEventListener("afterprint", clear, { once: true });
  window.print();
}

const PDF_CAPTURE_MARKER_ATTR = "data-pdf-capture";
const PDF_CAPTURE_SOURCE_ATTR = "data-pdf-capture-source";
let pdfCaptureCounter = 0;

const PDF_CAPTURE_TEXT_STABILIZER_CSS = `
[${PDF_CAPTURE_MARKER_ATTR}="1"] [class*="fieldLine"],
[${PDF_CAPTURE_MARKER_ATTR}="1"] [class*="entryLine"],
[${PDF_CAPTURE_MARKER_ATTR}="1"] [class*="fillLine"],
[${PDF_CAPTURE_MARKER_ATTR}="1"] [class*="headerFill"],
[${PDF_CAPTURE_MARKER_ATTR}="1"] [class*="inlineField"],
[${PDF_CAPTURE_MARKER_ATTR}="1"] [class*="vehicleLine"],
[${PDF_CAPTURE_MARKER_ATTR}="1"] [class*="vinLine"],
[${PDF_CAPTURE_MARKER_ATTR}="1"] [class*="contactLine"],
[${PDF_CAPTURE_MARKER_ATTR}="1"] [class*="priorityLine"],
[${PDF_CAPTURE_MARKER_ATTR}="1"] [class*="signatureLine"],
[${PDF_CAPTURE_MARKER_ATTR}="1"] [class*="taxPercentValue"] {
  line-height: 1.24 !important;
  padding-bottom: 4px !important;
  text-rendering: geometricPrecision;
  -webkit-font-smoothing: antialiased;
}

[${PDF_CAPTURE_MARKER_ATTR}="1"] [class*="fieldLine"],
[${PDF_CAPTURE_MARKER_ATTR}="1"] [class*="entryLine"],
[${PDF_CAPTURE_MARKER_ATTR}="1"] [class*="fillLine"],
[${PDF_CAPTURE_MARKER_ATTR}="1"] [class*="headerFill"],
[${PDF_CAPTURE_MARKER_ATTR}="1"] [class*="vehicleLine"],
[${PDF_CAPTURE_MARKER_ATTR}="1"] [class*="vinLine"] {
  align-items: flex-start !important;
}

[${PDF_CAPTURE_MARKER_ATTR}="1"] .pdf-capture-text-lift {
  position: relative;
  top: -2px;
  z-index: 1;
  background: #fff;
  padding: 0 1px;
}
`;

const PDF_CAPTURE_LINE_SELECTOR = [
  '[class*="fieldLine"]',
  '[class*="entryLine"]',
  '[class*="fillLine"]',
  '[class*="headerFill"]',
  '[class*="inlineField"]',
  '[class*="vehicleLine"]',
  '[class*="vinLine"]',
  '[class*="contactLine"]',
  '[class*="priorityLine"]',
  '[class*="signatureLine"]',
  '[class*="taxPercentValue"]',
].join(",");

function liftPlainTextForCapture(root: HTMLElement, doc: Document) {
  const candidates = root.querySelectorAll<HTMLElement>(PDF_CAPTURE_LINE_SELECTOR);
  for (const el of candidates) {
    if (el.children.length > 0) continue;
    const raw = el.textContent;
    if (!raw || raw.trim().length === 0) continue;
    const span = doc.createElement("span");
    span.className = "pdf-capture-text-lift";
    span.textContent = raw;
    el.textContent = "";
    el.appendChild(span);
  }
}

function createPdfCaptureSourceId() {
  pdfCaptureCounter += 1;
  return `pdf-capture-${Date.now()}-${pdfCaptureCounter}`;
}

function getHtml2CanvasCaptureOptions(
  target: HTMLElement,
  useForeignObjectRendering: boolean,
) {
  const sourceId = createPdfCaptureSourceId();
  target.setAttribute(PDF_CAPTURE_SOURCE_ATTR, sourceId);

  return {
    backgroundColor: "#ffffff",
    scale: 2,
    useCORS: true,
    logging: false,
    foreignObjectRendering: useForeignObjectRendering,
    onclone: (clonedDoc: Document) => {
      const markerSelector = `[${PDF_CAPTURE_SOURCE_ATTR}="${sourceId}"]`;
      const clonedTarget = clonedDoc.querySelector<HTMLElement>(markerSelector);
      if (!clonedTarget) return;

      clonedTarget.setAttribute(PDF_CAPTURE_MARKER_ATTR, "1");
      clonedTarget.removeAttribute(PDF_CAPTURE_SOURCE_ATTR);

      const style = clonedDoc.createElement("style");
      style.setAttribute("data-pdf-capture-style", "1");
      style.textContent = PDF_CAPTURE_TEXT_STABILIZER_CSS;
      clonedDoc.head.appendChild(style);

      liftPlainTextForCapture(clonedTarget, clonedDoc);
    },
  };
}

function isLikelyBlankCanvas(canvas: HTMLCanvasElement) {
  if (canvas.width === 0 || canvas.height === 0) return true;

  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return false;

  const steps = 18;
  const maxWhite = 246;
  const maxAlphaForTransparent = 12;

  for (let y = 0; y < steps; y++) {
    const sampleY = Math.floor((y / (steps - 1)) * (canvas.height - 1));
    for (let x = 0; x < steps; x++) {
      const sampleX = Math.floor((x / (steps - 1)) * (canvas.width - 1));
      const pixel = ctx.getImageData(sampleX, sampleY, 1, 1).data;
      const [r, g, b, a] = pixel;
      const isTransparent = a <= maxAlphaForTransparent;
      const isWhite = r >= maxWhite && g >= maxWhite && b >= maxWhite;

      if (!isTransparent && !isWhite) {
        return false;
      }
    }
  }

  return true;
}

export async function printElementExact(target: HTMLElement) {
  let html2canvas: typeof import("html2canvas").default;

  try {
    ({ default: html2canvas } = await import("html2canvas"));
  } catch {
    window.alert(
      "Could not load the exact print renderer. Falling back to browser print.",
    );
    printCurrentWindowAndClear();
    return;
  }

  const canvas = await html2canvas(target, {
    backgroundColor: "#ffffff",
    scale: 2,
    useCORS: true,
    logging: false,
  });

  const dataUrl = canvas.toDataURL("image/png");
  const win = window.open("", "_blank", "noopener");
  if (!win) {
    window.alert("Pop-up blocked. Allow pop-ups for exact print output.");
    return;
  }

  win.document.open();
  win.document.write(`<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>Print</title>
<style>
  @page { size: letter; margin: 0; }
  html, body { margin: 0; padding: 0; background: #fff; width: 8.5in; height: 11in; overflow: hidden; }
  .page {
    width: 8.5in;
    height: 11in;
    margin: 0 auto;
    display: grid;
    place-items: center;
    overflow: hidden;
  }
  img {
    width: 100%;
    height: 100%;
    object-fit: contain;
    display: block;
  }
</style>
</head>
<body>
  <div class="page"><img src="${dataUrl}" alt="Form print output"></div>
  <script>
    const channelName = ${JSON.stringify(WORKFLOW_SESSION_CHANNEL_NAME)};
    const clearMessageType = ${JSON.stringify(WORKFLOW_SESSION_CLEAR_EVENT)};
    function clearWorkflowSession() {
      try {
        const channel = new BroadcastChannel(channelName);
        channel.postMessage({ type: clearMessageType });
        channel.close();
      } catch {}
      window.close();
    }

    window.addEventListener("afterprint", clearWorkflowSession, { once: true });
    window.onload = function () {
      setTimeout(function () { window.print(); }, 80);
    };
  <\/script>
</body>
</html>`);
  win.document.close();
}

export async function printAllElementsExact(targets: HTMLElement[]) {
  if (targets.length === 0) return;

  let html2canvas: typeof import("html2canvas").default;

  try {
    ({ default: html2canvas } = await import("html2canvas"));
  } catch {
    window.alert(
      "Could not load the exact print renderer. Falling back to browser print.",
    );
    printCurrentWindowAndClear();
    return;
  }

  const pages: string[] = [];
  for (const target of targets) {
    const canvas = await html2canvas(target, {
      backgroundColor: "#ffffff",
      scale: 2,
      useCORS: true,
      logging: false,
    });
    pages.push(canvas.toDataURL("image/png"));
  }

  const win = window.open("", "_blank", "noopener");
  if (!win) {
    window.alert("Pop-up blocked. Allow pop-ups for exact print output.");
    return;
  }

  const pagesHtml = pages
    .map((src) => `<div class="page"><img src="${src}" alt="Form page"></div>`)
    .join("\n");

  win.document.open();
  win.document.write(`<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>Print All Forms</title>
<style>
  @page { size: letter; margin: 0; }
  html, body { margin: 0; padding: 0; background: #fff; }
  .page {
    width: 8.5in;
    height: 11in;
    margin: 0 auto;
    display: grid;
    place-items: center;
    overflow: hidden;
    page-break-after: always;
  }
  .page:last-child { page-break-after: auto; }
  img {
    width: 100%;
    height: 100%;
    object-fit: contain;
    display: block;
  }
</style>
</head>
<body>
  ${pagesHtml}
  <script>
    const channelName = ${JSON.stringify(WORKFLOW_SESSION_CHANNEL_NAME)};
    const clearMessageType = ${JSON.stringify(WORKFLOW_SESSION_CLEAR_EVENT)};
    function clearWorkflowSession() {
      try {
        const channel = new BroadcastChannel(channelName);
        channel.postMessage({ type: clearMessageType });
        channel.close();
      } catch {}
      window.close();
    }

    window.addEventListener("afterprint", clearWorkflowSession, { once: true });
    window.onload = function () {
      setTimeout(function () { window.print(); }, 80);
    };
  <\/script>
</body>
</html>`);
  win.document.close();
}

/* ------------------------------------------------------------------ */
/*  Save-to-PDF helpers (downloads a real .pdf to the user's device)  */
/* ------------------------------------------------------------------ */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function loadJsPdfFromCdn(): Promise<any> {
  return new Promise((resolve, reject) => {
    // Already loaded from a previous call
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((window as any).jspdf?.jsPDF) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      resolve((window as any).jspdf.jsPDF);
      return;
    }
    const script = document.createElement("script");
    script.src = "/jspdf.umd.min.js";
    script.onload = () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const jsPDF = (window as any).jspdf?.jsPDF;
      if (jsPDF) resolve(jsPDF);
      else reject(new Error("jsPDF not found on window after load"));
    };
    script.onerror = () => reject(new Error("Failed to load jsPDF from CDN"));
    document.head.appendChild(script);
  });
}

/** Capture element the same way printElementExact does. */
async function captureElement(
  html2canvas: typeof import("html2canvas").default,
  target: HTMLElement,
) {
  let foreignCanvas: HTMLCanvasElement | null = null;
  try {
    const primaryOptions = getHtml2CanvasCaptureOptions(target, true);
    foreignCanvas = await html2canvas(target, primaryOptions);
  } catch {
    foreignCanvas = null;
  } finally {
    target.removeAttribute(PDF_CAPTURE_SOURCE_ATTR);
  }

  if (foreignCanvas && !isLikelyBlankCanvas(foreignCanvas)) {
    return foreignCanvas;
  }

  const fallbackOptions = getHtml2CanvasCaptureOptions(target, false);
  try {
    return await html2canvas(target, fallbackOptions);
  } finally {
    target.removeAttribute(PDF_CAPTURE_SOURCE_ATTR);
  }
}

/** Render a single element to a downloadable PDF. */
export async function saveElementAsPdf(
  target: HTMLElement,
  filename = "document.pdf",
) {
  let html2canvas: typeof import("html2canvas").default;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let jsPDF: any;

  try {
    [{ default: html2canvas }, jsPDF] = await Promise.all([
      import("html2canvas"),
      loadJsPdfFromCdn(),
    ]);
  } catch {
    window.alert("Could not load PDF libraries.");
    return;
  }

  const canvas = await captureElement(html2canvas, target);
  const imgData = canvas.toDataURL("image/png");

  // Size the PDF page to match the captured image's aspect ratio
  const pxW = canvas.width;
  const pxH = canvas.height;
  const pdfW = 8.5;
  const pdfH = (pxH / pxW) * pdfW;

  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "in",
    format: [pdfW, pdfH],
  });
  pdf.addImage(imgData, "PNG", 0, 0, pdfW, pdfH);
  pdf.save(filename);
}

/** Render multiple elements into a single multi-page downloadable PDF. */
export async function saveAllElementsAsPdf(
  targets: HTMLElement[],
  filename = "all-forms.pdf",
) {
  if (targets.length === 0) return;

  let html2canvas: typeof import("html2canvas").default;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let jsPDF: any;

  try {
    [{ default: html2canvas }, jsPDF] = await Promise.all([
      import("html2canvas"),
      loadJsPdfFromCdn(),
    ]);
  } catch {
    window.alert("Could not load PDF libraries.");
    return;
  }

  // Capture first page to determine dimensions
  const firstCanvas = await captureElement(html2canvas, targets[0]);
  const pxW = firstCanvas.width;
  const pxH = firstCanvas.height;
  const pdfW = 8.5;
  const pdfH = (pxH / pxW) * pdfW;

  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "in",
    format: [pdfW, pdfH],
  });
  pdf.addImage(firstCanvas.toDataURL("image/png"), "PNG", 0, 0, pdfW, pdfH);

  for (let i = 1; i < targets.length; i++) {
    const canvas = await captureElement(html2canvas, targets[i]);
    const w = 8.5;
    const h = (canvas.height / canvas.width) * w;
    pdf.addPage([w, h], "portrait");
    pdf.addImage(canvas.toDataURL("image/png"), "PNG", 0, 0, w, h);
  }

  pdf.save(filename);
}
