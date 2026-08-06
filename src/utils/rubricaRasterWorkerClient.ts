import { RUBRICA_COR_FUNDO, RUBRICA_COR_TRACO } from './rubricaSvgNormalize';
import {
  RUBRICA_RASTER_ALTURA,
  RUBRICA_RASTER_LARGURA,
  RUBRICA_WEBP_QUALITY,
} from './rubricaConstants';

type WorkerReq = {
  id: number;
  svgUri: string;
  widthPx: number;
  heightPx: number;
  mime: 'image/png' | 'image/webp';
  quality: number;
  corFundo: string;
  corTraco: string;
};

type WorkerRes = {
  id: number;
  ok: boolean;
  dataUrl?: string;
  error?: string;
};

type Pending = {
  resolve: (v: string | null) => void;
};

/**
 * Worker self-contained (Blob) — Metro/Expo não embute Worker via import.meta.url de forma estável.
 * Usa OffscreenCanvas + convertToBlob fora do thread da UI.
 */
const WORKER_SOURCE = `
function decodeSvgDataUrl(svgUri) {
  var normalized = String(svgUri || '').trim();
  if (normalized.indexOf('data:image/svg') !== 0) return null;
  var comma = normalized.indexOf(',');
  if (comma < 0) return null;
  var meta = normalized.slice(0, comma);
  var data = normalized.slice(comma + 1);
  try {
    if (/;base64/i.test(meta)) {
      var binary = atob(data);
      var bytes = new Uint8Array(binary.length);
      for (var bi = 0; bi < binary.length; bi++) bytes[bi] = binary.charCodeAt(bi);
      return new TextDecoder('utf-8').decode(bytes);
    }
    return decodeURIComponent(data);
  } catch (e1) {
    try { return decodeURIComponent(data); } catch (e2) { return null; }
  }
}

function extrairPathsDoSvg(svg) {
  var vbMatch = svg.match(/viewBox=["']0\\s+0\\s+([\\d.]+)\\s+([\\d.]+)["']/i);
  var wMatch = svg.match(/\\bwidth=["']([\\d.]+)["']/i);
  var hMatch = svg.match(/\\bheight=["']([\\d.]+)["']/i);
  var vbW = vbMatch ? parseFloat(vbMatch[1]) : parseFloat((wMatch && wMatch[1]) || '420');
  var vbH = vbMatch ? parseFloat(vbMatch[2]) : parseFloat((hMatch && hMatch[1]) || '180');
  var paths = [];
  var re = /<path\\b[^>]*\\bd=["']([^"']+)["'][^>]*>/gi;
  var m;
  while ((m = re.exec(svg)) !== null) {
    if (m[1] && m[1].trim()) paths.push(m[1].trim());
  }
  return {
    paths: paths,
    vbW: isFinite(vbW) && vbW > 0 ? vbW : 420,
    vbH: isFinite(vbH) && vbH > 0 ? vbH : 180
  };
}

function strokePathManual(ctx, d) {
  var tokens = d.match(/[MLml]|-?\\d*\\.?\\d+(?:e[-+]?\\d+)?/g);
  if (!tokens || !tokens.length) return;
  ctx.beginPath();
  var cmd = 'M';
  var i = 0;
  var started = false;
  while (i < tokens.length) {
    var t = tokens[i];
    if (t === 'M' || t === 'L' || t === 'm' || t === 'l') { cmd = t; i += 1; continue; }
    var x = parseFloat(tokens[i]);
    var y = parseFloat(tokens[i + 1] || '');
    if (!isFinite(x) || !isFinite(y)) break;
    i += 2;
    if (cmd === 'M' || cmd === 'm') { ctx.moveTo(x, y); started = true; }
    else if (started) { ctx.lineTo(x, y); }
    else { ctx.moveTo(x, y); started = true; }
  }
  ctx.stroke();
}

function blobToDataUrl(blob) {
  return new Promise(function (resolve, reject) {
    var fr = new FileReader();
    fr.onload = function () { resolve(typeof fr.result === 'string' ? fr.result : null); };
    fr.onerror = function () { reject(fr.error || new Error('FileReader')); };
    fr.readAsDataURL(blob);
  });
}

async function renderToDataUrl(msg) {
  var svg = decodeSvgDataUrl(msg.svgUri);
  if (!svg) throw new Error('svg');
  var parsed = extrairPathsDoSvg(svg);
  if (!parsed.paths.length) throw new Error('paths');

  var w = Math.max(1, Math.round(msg.widthPx));
  var h = Math.max(1, Math.round(msg.heightPx));
  var canvas = new OffscreenCanvas(w, h);
  var ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('ctx');

  ctx.fillStyle = msg.corFundo || '#FFFFFF';
  ctx.fillRect(0, 0, w, h);
  ctx.save();
  ctx.scale(w / parsed.vbW, h / parsed.vbH);
  ctx.strokeStyle = msg.corTraco || '#111827';
  ctx.lineWidth = Math.max(2.5, 3.5);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (var pi = 0; pi < parsed.paths.length; pi++) {
    var d = parsed.paths[pi];
    try {
      if (typeof Path2D !== 'undefined') ctx.stroke(new Path2D(d));
      else strokePathManual(ctx, d);
    } catch (e) {
      strokePathManual(ctx, d);
    }
  }
  ctx.restore();

  var mime = msg.mime || 'image/webp';
  var quality = typeof msg.quality === 'number' ? msg.quality : 0.72;
  try {
    var blob = await canvas.convertToBlob({ type: mime, quality: quality });
    var dataUrl = await blobToDataUrl(blob);
    if (dataUrl && dataUrl.indexOf('data:image/') === 0) return dataUrl;
  } catch (eWebp) {}
  if (mime !== 'image/png') {
    var pngBlob = await canvas.convertToBlob({ type: 'image/png' });
    return blobToDataUrl(pngBlob);
  }
  return null;
}

self.onmessage = function (ev) {
  var msg = ev.data || {};
  var id = msg.id;
  renderToDataUrl(msg)
    .then(function (dataUrl) {
      self.postMessage({ id: id, ok: !!dataUrl, dataUrl: dataUrl || undefined });
    })
    .catch(function (err) {
      self.postMessage({ id: id, ok: false, error: String(err && err.message ? err.message : err) });
    });
};
`;

let workerInstance: Worker | null = null;
let workerDisabled = false;
let nextJobId = 1;
const pendingJobs = new Map<number, Pending>();

function supportsRasterWorker(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof Worker !== 'undefined' &&
    typeof OffscreenCanvas !== 'undefined' &&
    typeof Blob !== 'undefined' &&
    typeof URL !== 'undefined' &&
    typeof URL.createObjectURL === 'function'
  );
}

function disableWorker(reason?: unknown): void {
  workerDisabled = true;
  if (workerInstance) {
    try {
      workerInstance.terminate();
    } catch {
      // ignore
    }
    workerInstance = null;
  }
  for (const [, job] of pendingJobs) {
    job.resolve(null);
  }
  pendingJobs.clear();
  if (reason && typeof console !== 'undefined') {
    console.warn('[rubricaRasterWorker] desativado; fallback no UI thread.', reason);
  }
}

function ensureWorker(): Worker | null {
  if (workerDisabled || !supportsRasterWorker()) return null;
  if (workerInstance) return workerInstance;

  try {
    const blob = new Blob([WORKER_SOURCE], { type: 'application/javascript' });
    const url = URL.createObjectURL(blob);
    const worker = new Worker(url);
    worker.onmessage = (ev: MessageEvent<WorkerRes>) => {
      const data = ev.data;
      if (!data || typeof data.id !== 'number') return;
      const job = pendingJobs.get(data.id);
      if (!job) return;
      pendingJobs.delete(data.id);
      job.resolve(data.ok && data.dataUrl ? data.dataUrl : null);
    };
    worker.onerror = (err) => {
      disableWorker(err);
    };
    workerInstance = worker;
    return worker;
  } catch (e) {
    disableWorker(e);
    return null;
  }
}

/**
 * Rasteriza SVG→WebP/PNG no Worker (OffscreenCanvas).
 * Devolve null se Worker indisponível ou falhar (caller faz fallback).
 */
export function rubricaRasterViaWorker(
  svgUri: string,
  options?: {
    widthPx?: number;
    heightPx?: number;
    mime?: 'image/png' | 'image/webp';
    quality?: number;
  },
): Promise<string | null> {
  const worker = ensureWorker();
  if (!worker) return Promise.resolve(null);

  const id = nextJobId++;
  const req: WorkerReq = {
    id,
    svgUri,
    widthPx: options?.widthPx ?? RUBRICA_RASTER_LARGURA,
    heightPx: options?.heightPx ?? RUBRICA_RASTER_ALTURA,
    mime: options?.mime ?? 'image/webp',
    quality: options?.quality ?? RUBRICA_WEBP_QUALITY,
    corFundo: RUBRICA_COR_FUNDO,
    corTraco: RUBRICA_COR_TRACO,
  };

  return new Promise((resolve) => {
    pendingJobs.set(id, { resolve });
    try {
      worker.postMessage(req);
    } catch (e) {
      pendingJobs.delete(id);
      disableWorker(e);
      resolve(null);
    }
  });
}

export function isRubricaRasterWorkerDisponivel(): boolean {
  return !workerDisabled && supportsRasterWorker();
}
