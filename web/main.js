import init, { encode_svg, encode_png } from "./vendor/tpt_app_labels_wasm.js";
import { createZip } from "./lib/minizip.js";

const $ = (id) => document.getElementById(id);

const dataEl = $("data");
const formatEl = $("format");
const ecLevelEl = $("ec-level");
const ecRow = $("qr-ec-row");
const showCaptionEl = $("show-caption");
const colsEl = $("cols");
const moduleSizeEl = $("module-size");
const barHeightEl = $("bar-height");
const cellSizeEl = $("cell-size");
const sheetEl = $("sheet");
const countPill = $("count-pill");
const errorBox = $("error-box");

const SAMPLE = {
  qr: "https://tptsolutions.co.nz\nhttps://tptsolutions.co.nz/tools\nSKU-00123\nSKU-00124",
  datamatrix: "SKU-00123\nSKU-00124\nSKU-00125",
  code128: "ITEM-0001\nITEM-0002\nITEM-0003",
  code39: "PART-A1\nPART-A2\nPART-A3",
  ean13: "5901234123457\n4006381333931",
  upca: "036000291452\n012345678905",
};

function showError(msg) {
  errorBox.textContent = msg;
  errorBox.classList.toggle("show", Boolean(msg));
}

function parseEntries(raw) {
  return raw
    .split(/\r?\n/)
    .map((line) => line.split(",")[0].trim())
    .filter((line) => line.length > 0);
}

function currentSettings() {
  return {
    format: formatEl.value,
    ec: ecLevelEl.value,
    cols: Math.max(1, parseInt(colsEl.value, 10) || 1),
    moduleSize: Math.max(1, parseInt(moduleSizeEl.value, 10) || 4),
    barHeight: Math.max(10, parseInt(barHeightEl.value, 10) || 80),
    cellMm: Math.max(5, parseInt(cellSizeEl.value, 10) || 40),
    showCaption: showCaptionEl.checked,
  };
}

let lastEntries = [];

function render() {
  showError("");
  const entries = parseEntries(dataEl.value);
  lastEntries = entries;
  const s = currentSettings();

  sheetEl.style.gridTemplateColumns = `repeat(${s.cols}, 1fr)`;
  sheetEl.innerHTML = "";
  countPill.textContent = `${entries.length} code${entries.length === 1 ? "" : "s"}`;

  let firstError = null;

  for (const entry of entries) {
    const cell = document.createElement("div");
    cell.className = "label-cell";
    cell.style.minHeight = `${s.cellMm}mm`;
    try {
      const svg = encode_svg(s.format, entry, s.ec, s.moduleSize, s.barHeight);
      cell.innerHTML = svg;
      if (s.showCaption) {
        const cap = document.createElement("div");
        cap.className = "caption";
        cap.textContent = entry;
        cell.appendChild(cap);
      }
    } catch (err) {
      cell.classList.add("error");
      cell.textContent = `"${entry}": ${err}`;
      if (!firstError) firstError = `${entry}: ${err}`;
    }
    sheetEl.appendChild(cell);
  }

  if (firstError) {
    showError(`Some entries failed to encode — first error: ${firstError}`);
  }
}

function safeFileName(text, index) {
  const cleaned = text.replace(/[^a-z0-9_-]+/gi, "_").slice(0, 40);
  return cleaned || `code-${index + 1}`;
}

async function exportZip(kind) {
  if (lastEntries.length === 0) {
    showError("Nothing to export — generate some codes first.");
    return;
  }
  const s = currentSettings();
  const files = [];
  const seen = new Map();

  lastEntries.forEach((entry, i) => {
    let base = safeFileName(entry, i);
    const n = (seen.get(base) || 0) + 1;
    seen.set(base, n);
    if (n > 1) base = `${base}-${n}`;

    try {
      if (kind === "svg") {
        const svg = encode_svg(s.format, entry, s.ec, s.moduleSize, s.barHeight);
        files.push({ name: `${base}.svg`, data: new TextEncoder().encode(svg) });
      } else {
        const bytes = encode_png(s.format, entry, s.ec, s.moduleSize, s.barHeight, s.moduleSize * 2);
        files.push({ name: `${base}.png`, data: bytes });
      }
    } catch (err) {
      // Skip failed entries in the export; they're already flagged in the preview.
    }
  });

  if (files.length === 0) {
    showError("No codes could be exported — check the error above.");
    return;
  }

  const blob = createZip(files);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `tpt-labels-${s.format}.zip`;
  a.click();
  URL.revokeObjectURL(url);
}

function updateEcVisibility() {
  ecRow.style.display = formatEl.value === "qr" ? "" : "none";
}

async function main() {
  await init();

  formatEl.addEventListener("change", () => {
    updateEcVisibility();
    render();
  });
  [dataEl, ecLevelEl, colsEl, moduleSizeEl, barHeightEl, cellSizeEl, showCaptionEl].forEach((el) =>
    el.addEventListener("input", render)
  );

  $("generate-btn").addEventListener("click", render);
  $("load-sample-btn").addEventListener("click", () => {
    dataEl.value = SAMPLE[formatEl.value] || SAMPLE.qr;
    render();
  });
  $("print-btn").addEventListener("click", () => window.print());
  $("export-zip-btn").addEventListener("click", () => exportZip("svg"));
  $("export-zip-png-btn").addEventListener("click", () => exportZip("png"));

  const aboutDialog = $("about-dialog");
  $("about-link").addEventListener("click", (e) => {
    e.preventDefault();
    aboutDialog.showModal();
  });
  $("about-close").addEventListener("click", () => aboutDialog.close());

  updateEcVisibility();
  dataEl.value = SAMPLE.qr;
  render();

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch(() => {
      // Offline caching is a nice-to-have; ignore registration failures
      // (e.g. running from file:// during local development).
    });
  }

  let deferredInstallPrompt = null;
  const installLink = $("install-link");
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
    installLink.hidden = false;
  });
  installLink.addEventListener("click", async (e) => {
    e.preventDefault();
    if (!deferredInstallPrompt) return;
    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    installLink.hidden = true;
  });
}

main();
