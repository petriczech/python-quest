import { Trace } from './program';
import { Raster, dilate, rasterize, toPixel } from './raster';

/** Tolerance polohy v px */
export const TOLERANCE = 2;
/** Váha výplní ve skóre, když vzor nebo výstup výplň má */
export const FILL_WEIGHT = 0.4;
/** Práh splnění úlohy v % */
export const PASS_PERCENT = 98;

export interface MatchResult {
  /** Shoda 0–100 s jedním desetinným místem */
  percent: number;
  lines: number;
  fills: number | null;
}

function count(mask: Uint8Array): number {
  let n = 0;
  for (const value of mask) {
    if (value) {
      n++;
    }
  }
  return n;
}

/** Pokrytý vzor / (vzor + přebývající pixely výstupu), s tolerancí polohy a barvou. */
function coverage(reference: Uint8Array, output: Uint8Array, width: number, height: number): number {
  const dilatedRef = dilate(reference, width, height, TOLERANCE);
  const dilatedOut = dilate(output, width, height, TOLERANCE);
  let covered = 0;
  let total = 0;
  for (let i = 0; i < reference.length; i++) {
    const r = reference[i] as number;
    const o = output[i] as number;
    if (r) {
      total++;
      if (dilatedOut[i] === r) {
        covered++;
      }
    }
    if (o && dilatedRef[i] !== o) {
      total++;
    }
  }
  return total === 0 ? 1 : covered / total;
}

export function match(reference: Raster, output: Raster): MatchResult {
  const { width, height } = reference;
  const lines = coverage(reference.lines, output.lines, width, height);
  const hasFills = count(reference.fills) > 0 || count(output.fills) > 0;
  const fills = hasFills ? coverage(reference.fills, output.fills, width, height) : null;
  const score = fills === null ? lines : (1 - FILL_WEIGHT) * lines + FILL_WEIGHT * fills;
  return { percent: Math.floor(score * 1000) / 10, lines, fills };
}

export const DIFF_MATCH = 1;
export const DIFF_MISSING = 2;
export const DIFF_EXTRA = 3;

/** Mapa pro režim diff: shoda / chybí / navíc. */
export function diff(reference: Raster, output: Raster): Uint8Array {
  const { width, height } = reference;
  const ref = reference.lines.map((v, i) => (v || reference.fills[i] ? 1 : 0));
  const out = output.lines.map((v, i) => (v || output.fills[i] ? 1 : 0));
  const dilatedRef = dilate(ref, width, height, TOLERANCE);
  const dilatedOut = dilate(out, width, height, TOLERANCE);
  const result = new Uint8Array(ref.length);
  for (let i = 0; i < ref.length; i++) {
    if (ref[i]) {
      result[i] = dilatedOut[i] ? DIFF_MATCH : DIFF_MISSING;
    } else if (out[i]) {
      result[i] = dilatedRef[i] ? DIFF_MATCH : DIFF_EXTRA;
    }
  }
  return result;
}

function plural(n: number, one: string, few: string, many: string): string {
  if (n === 1) {
    return one;
  }
  return n >= 2 && n <= 4 ? few : many;
}

/** Slovní nápověda z trace: co chybí a co přebývá. */
export function feedback(reference: Trace, output: Trace, result: MatchResult): string {
  if (output.segments.length === 0 && output.fills.length === 0) {
    return 'Želva zatím nic nenakreslila. Přidej blok a spusť program.';
  }
  if (result.percent >= PASS_PERCENT) {
    return result.percent >= 100 ? 'Přesně podle vzoru.' : 'Sedí to se vzorem.';
  }
  const raster = rasterize(output);
  const covered = dilate(raster.lines, raster.width, raster.height, TOLERANCE);
  let missing = 0;
  for (const segment of reference.segments) {
    const a = toPixel(segment.from);
    const b = toPixel(segment.to);
    const samples = Math.max(2, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 3));
    let hits = 0;
    for (let s = 0; s <= samples; s++) {
      const x = Math.min(raster.width - 1, Math.floor(a.x + ((b.x - a.x) * s) / samples));
      const y = Math.min(raster.height - 1, Math.floor(a.y + ((b.y - a.y) * s) / samples));
      if (covered[y * raster.width + x]) {
        hits++;
      }
    }
    if (hits / (samples + 1) < 0.6) {
      missing++;
    }
  }
  const parts: string[] = [];
  if (missing > 0) {
    parts.push(
      missing === reference.segments.length
        ? 'Kresba je úplně mimo vzor.'
        : `Chybí ${missing} ${plural(missing, 'čára', 'čáry', 'čar')}.`,
    );
  }
  if (result.lines < 1 && output.segments.length > reference.segments.length) {
    parts.push('Něco je navíc.');
  }
  if (result.fills !== null && result.fills < 0.9) {
    parts.push('Zkontroluj výplň.');
  }
  return parts.length ? parts.join(' ') : 'Skoro! Zkontroluj délky a úhly.';
}
