import { RUBRICA_COR_FUNDO, RUBRICA_COR_TRACO, normalizarRubricaSvgDataUrl } from './rubricaSvgNormalize';

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

export function extrairPathsDoSvg(svg: string): { paths: string[]; vbW: number; vbH: number } {
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

export function strokePathManual(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  d: string,
): void {
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

export type RubricaRasterDrawOpts = {
  svgMarkup: string;
  widthPx: number;
  heightPx: number;
  corFundo?: string;
  corTraco?: string;
};

/** Desenha paths da rúbrica no contexto 2D (main thread ou Worker). */
export function desenharRubricaSvgNoContexto(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  canvasWidth: number,
  canvasHeight: number,
  opts: RubricaRasterDrawOpts,
): boolean {
  const { paths, vbW, vbH } = extrairPathsDoSvg(opts.svgMarkup);
  if (paths.length === 0) return false;

  const fundo = opts.corFundo ?? RUBRICA_COR_FUNDO;
  const traco = opts.corTraco ?? RUBRICA_COR_TRACO;

  ctx.fillStyle = fundo;
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  const sx = canvasWidth / vbW;
  const sy = canvasHeight / vbH;
  ctx.save();
  ctx.scale(sx, sy);
  ctx.strokeStyle = traco;
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
  return true;
}
