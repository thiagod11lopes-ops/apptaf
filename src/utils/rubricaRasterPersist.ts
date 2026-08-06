import type { CadastroItemPersist } from '../services/cadastrosIndexedDb';
import type { SessaoAplicacaoTaf } from '../services/resultadosAplicadosIndexedDb';
import { RUBRICA_COR_FUNDO, RUBRICA_COR_TRACO, normalizarRubricaSvgDataUrl } from './rubricaSvgNormalize';
import {
  RUBRICA_RASTER_ALTURA,
  RUBRICA_RASTER_LARGURA,
  RUBRICA_WEBP_QUALITY,
} from './rubricaConstants';

/** Decodifica data-URL SVG (utf8 ou base64) para string SVG. */
export function decodeSvgDataUrl(svgUri: string): string | null {
  const normalized = normalizarRubricaSvgDataUrl(svgUri) ?? svgUri.trim();
  if (!normalized.startsWith('data:image/svg')) return null;

  const comma = normalized.indexOf(',');
  if (comma < 0) return null;
  const meta = normalized.slice(0, comma);
  const data = normalized.slice(comma + 1);

  try {
    if (/;base64/i.test(meta)) {
      const binary = atob(data);
      const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
      return new TextDecoder('utf-8').decode(bytes);
    }
    return decodeURIComponent(data);
  } catch {
    try {
      return decodeURIComponent(data);
    } catch {
      return null;
    }
  }
}

function extrairPathsDoSvg(svg: string): { paths: string[]; vbW: number; vbH: number } {
  const vbMatch = svg.match(/viewBox=["']0\s+0\s+([\d.]+)\s+([\d.]+)["']/i);
  const wMatch = svg.match(/\bwidth=["']([\d.]+)["']/i);
  const hMatch = svg.match(/\bheight=["']([\d.]+)["']/i);
  const vbW = vbMatch ? parseFloat(vbMatch[1]!) : parseFloat(wMatch?.[1] ?? '420');
  const vbH = vbMatch ? parseFloat(vbMatch[2]!) : parseFloat(hMatch?.[1] ?? '180');

  const paths: string[] = [];
  const re = /<path\b[^>]*\bd=["']([^"']+)["'][^>]*>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(svg)) !== null) {
    if (m[1]?.trim()) paths.push(m[1].trim());
  }
  return {
    paths,
    vbW: Number.isFinite(vbW) && vbW > 0 ? vbW : 420,
    vbH: Number.isFinite(vbH) && vbH > 0 ? vbH : 180,
  };
}

function strokePathManual(ctx: CanvasRenderingContext2D, d: string): void {
  const tokens = d.match(/[MLml]|-?\d*\.?\d+(?:e[-+]?\d+)?/g);
  if (!tokens || tokens.length === 0) return;

  ctx.beginPath();
  let cmd = 'M';
  let i = 0;
  let started = false;
  while (i < tokens.length) {
    const t = tokens[i]!;
    if (t === 'M' || t === 'L' || t === 'm' || t === 'l') {
      cmd = t;
      i += 1;
      continue;
    }
    const x = parseFloat(tokens[i]!);
    const y = parseFloat(tokens[i + 1] ?? '');
    if (!Number.isFinite(x) || !Number.isFinite(y)) break;
    i += 2;
    if (cmd === 'M' || cmd === 'm') {
      ctx.moveTo(x, y);
      started = true;
    } else if (started) {
      ctx.lineTo(x, y);
    } else {
      ctx.moveTo(x, y);
      started = true;
    }
  }
  ctx.stroke();
}

export function isRubricaSvgDataUrl(uri?: string | null): boolean {
  return Boolean(uri?.trim().startsWith('data:image/svg'));
}

export function isRubricaRasterDataUrl(uri?: string | null): boolean {
  const raw = uri?.trim() ?? '';
  return (
    raw.startsWith('data:image/png') ||
    raw.startsWith('data:image/webp') ||
    raw.startsWith('data:image/jpeg') ||
    raw.startsWith('data:image/jpg')
  );
}

export function precisaRasterizarRubrica(uri?: string | null): boolean {
  return isRubricaSvgDataUrl(uri);
}

export type RubricaPdfFormat = 'PNG' | 'WEBP' | 'JPEG';

export function rubricaDataUrlPdfFormat(uri?: string | null): RubricaPdfFormat | null {
  const raw = uri?.trim() ?? '';
  if (raw.startsWith('data:image/png')) return 'PNG';
  if (raw.startsWith('data:image/webp')) return 'WEBP';
  if (raw.startsWith('data:image/jpeg') || raw.startsWith('data:image/jpg')) return 'JPEG';
  return null;
}

/**
 * Rasteriza SVG → PNG/WebP desenhando paths no canvas (sem Image() — Safari/iPhone).
 */
export function renderRubricaSvgToRasterDataUrl(
  svgUri: string | undefined | null,
  widthPx: number,
  heightPx: number,
  mime: 'image/png' | 'image/webp' = 'image/png',
  quality = RUBRICA_WEBP_QUALITY,
): string | null {
  if (typeof document === 'undefined') return null;
  if (!svgUri?.trim()) return null;

  const svg = decodeSvgDataUrl(svgUri);
  if (!svg) return null;

  const { paths, vbW, vbH } = extrairPathsDoSvg(svg);
  if (paths.length === 0) return null;

  const scale = 2;
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(widthPx * scale));
  canvas.height = Math.max(1, Math.round(heightPx * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.fillStyle = RUBRICA_COR_FUNDO;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const sx = canvas.width / vbW;
  const sy = canvas.height / vbH;
  ctx.save();
  ctx.scale(sx, sy);
  ctx.strokeStyle = RUBRICA_COR_TRACO;
  ctx.lineWidth = Math.max(2.5, 3.5);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  for (const d of paths) {
    try {
      if (typeof Path2D !== 'undefined') {
        ctx.stroke(new Path2D(d));
      } else {
        strokePathManual(ctx, d);
      }
    } catch {
      strokePathManual(ctx, d);
    }
  }
  ctx.restore();

  try {
    if (mime === 'image/webp') {
      const webp = canvas.toDataURL('image/webp', quality);
      if (webp.startsWith('data:image/webp')) return webp;
      return canvas.toDataURL('image/png');
    }
    return canvas.toDataURL('image/png');
  } catch {
    return null;
  }
}

/** Compatível com PDFs existentes — sempre PNG. */
export function renderRubricaSvgToPngDataUrl(
  svgUri: string | undefined | null,
  widthPx: number,
  heightPx: number,
): string | null {
  if (isRubricaRasterDataUrl(svgUri)) {
    const raw = svgUri!.trim();
    // PNG síncrono; WebP/JPEG ficam para rubricaParaPdfEmbedDataUrl (async).
    if (raw.startsWith('data:image/png')) return raw;
    return raw;
  }
  return renderRubricaSvgToRasterDataUrl(svgUri, widthPx, heightPx, 'image/png');
}

/** Converte WebP/JPEG → PNG via Image+canvas (jsPDF embute WEBP de forma inconsistente). */
export function rasterDataUrlToPngDataUrlAsync(
  dataUrl: string,
  widthPx: number,
  heightPx: number,
): Promise<string | null> {
  const raw = dataUrl.trim();
  if (!raw || typeof document === 'undefined') return Promise.resolve(null);
  if (raw.startsWith('data:image/png')) return Promise.resolve(raw);

  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(widthPx));
        canvas.height = Math.max(1, Math.round(heightPx));
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(null);
          return;
        }
        ctx.fillStyle = RUBRICA_COR_FUNDO;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/png'));
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = raw;
  });
}

/** Data-URL pronto para doc.addImage — preferencialmente PNG. */
export async function rubricaParaPdfEmbedDataUrl(
  uri: string | undefined | null,
  widthPx: number,
  heightPx: number,
): Promise<string | null> {
  const raw = uri?.trim();
  if (!raw) return null;
  if (raw.startsWith('data:image/png')) return raw;
  if (isRubricaSvgDataUrl(raw)) {
    return renderRubricaSvgToRasterDataUrl(raw, widthPx, heightPx, 'image/png');
  }
  if (isRubricaRasterDataUrl(raw)) {
    return (await rasterDataUrlToPngDataUrlAsync(raw, widthPx, heightPx)) ?? raw;
  }
  return null;
}

/**
 * Converte rúbrica SVG em WebP (ou PNG) para persistência.
 * Já rasterizada: devolve como está. Sem canvas (nativo): mantém original.
 */
export function rubricaParaPersistencia(uri?: string | null): string | undefined {
  const raw = uri?.trim();
  if (!raw) return undefined;
  if (isRubricaRasterDataUrl(raw)) return raw;
  if (!isRubricaSvgDataUrl(raw)) return raw;
  if (typeof document === 'undefined') return raw;

  const webp = renderRubricaSvgToRasterDataUrl(
    raw,
    RUBRICA_RASTER_LARGURA,
    RUBRICA_RASTER_ALTURA,
    'image/webp',
    RUBRICA_WEBP_QUALITY,
  );
  if (webp?.startsWith('data:image/webp') || webp?.startsWith('data:image/png')) {
    return webp;
  }
  return renderRubricaSvgToRasterDataUrl(
    raw,
    RUBRICA_RASTER_LARGURA,
    RUBRICA_RASTER_ALTURA,
    'image/png',
  ) ?? raw;
}

/**
 * Mesma conversão de `rubricaParaPersistencia`, mas cede a UI antes do canvas/`toDataURL`.
 * Use no fluxo “Próximo militar” para não travar o paint.
 */
export async function rubricaParaPersistenciaAsync(
  uri?: string | null,
): Promise<string | undefined> {
  const raw = uri?.trim();
  if (!raw) return undefined;
  if (isRubricaRasterDataUrl(raw)) return raw;
  if (!isRubricaSvgDataUrl(raw)) return raw;

  const { yieldToUi } = await import('./yieldToUi');
  await yieldToUi();
  if (typeof requestAnimationFrame === 'function') {
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => resolve());
    });
  }
  return rubricaParaPersistencia(raw);
}

function mapUri(uri: string | undefined, mudou: { value: boolean }): string | undefined {
  if (!precisaRasterizarRubrica(uri)) return uri;
  const next = rubricaParaPersistencia(uri);
  if (next && next !== uri) mudou.value = true;
  return next ?? uri;
}

export function rasterizarRubricasNaSessao(sessao: SessaoAplicacaoTaf): {
  sessao: SessaoAplicacaoTaf;
  mudou: boolean;
} {
  const flag = { value: false };
  const resultados = sessao.resultados.map((r) => {
    if (!precisaRasterizarRubrica(r.rubricaCandidatoSvg)) return r;
    const rubricaCandidatoSvg = mapUri(r.rubricaCandidatoSvg, flag);
    return rubricaCandidatoSvg === r.rubricaCandidatoSvg
      ? r
      : { ...r, rubricaCandidatoSvg };
  });

  let aplicadorAssinatura = sessao.aplicadorAssinatura;
  if (aplicadorAssinatura && precisaRasterizarRubrica(aplicadorAssinatura.rubricaSvg)) {
    const rubricaSvg = mapUri(aplicadorAssinatura.rubricaSvg, flag);
    if (rubricaSvg !== aplicadorAssinatura.rubricaSvg) {
      aplicadorAssinatura = { ...aplicadorAssinatura, rubricaSvg };
    }
  }

  if (!flag.value) return { sessao, mudou: false };
  return {
    sessao: {
      ...sessao,
      resultados,
      ...(aplicadorAssinatura ? { aplicadorAssinatura } : {}),
    },
    mudou: true,
  };
}

const CADASTRO_RUBRICA_KEYS = [
  'rubricaCorridaSvg',
  'rubricaCaminhadaSvg',
  'rubricaNatacaoSvg',
  'rubricaPermanenciaSvg',
] as const;

export function rasterizarRubricasNoCadastro(cadastro: CadastroItemPersist): {
  cadastro: CadastroItemPersist;
  mudou: boolean;
} {
  const flag = { value: false };
  const patch: Partial<CadastroItemPersist> = {};
  for (const key of CADASTRO_RUBRICA_KEYS) {
    const cur = cadastro[key];
    if (!precisaRasterizarRubrica(cur)) continue;
    const next = mapUri(cur, flag);
    if (next !== cur) patch[key] = next;
  }
  if (!flag.value) return { cadastro, mudou: false };
  return { cadastro: { ...cadastro, ...patch }, mudou: true };
}
