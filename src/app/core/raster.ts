import { Point, Trace } from './program';
import { VIEW } from './level';

export const LINE_WIDTH = 3;

export interface Raster {
  width: number;
  height: number;
  /** 1 = čára */
  lines: Uint8Array;
  /** 0 = bez výplně, jinak id barvy */
  fills: Uint8Array;
}

/** Svět → pixel: (0, 0) uprostřed, y nahoru. */
export function toPixel(point: Point, width = VIEW.width, height = VIEW.height): Point {
  return { x: point.x + width / 2, y: height / 2 - point.y };
}

const colorIds = new Map<string, number>();

function colorId(color: string): number {
  const key = color.trim().toLowerCase();
  let id = colorIds.get(key);
  if (id === undefined) {
    id = (colorIds.size % 255) + 1;
    colorIds.set(key, id);
  }
  return id;
}

function drawSegment(raster: Raster, a: Point, b: Point, radius: number): void {
  const { width, height, lines } = raster;
  const minX = Math.max(0, Math.floor(Math.min(a.x, b.x) - radius));
  const maxX = Math.min(width - 1, Math.ceil(Math.max(a.x, b.x) + radius));
  const minY = Math.max(0, Math.floor(Math.min(a.y, b.y) - radius));
  const maxY = Math.min(height - 1, Math.ceil(Math.max(a.y, b.y) + radius));
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSq = dx * dx + dy * dy;
  const radiusSq = radius * radius;
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const px = x + 0.5;
      const py = y + 0.5;
      const t = lengthSq === 0 ? 0 : Math.max(0, Math.min(1, ((px - a.x) * dx + (py - a.y) * dy) / lengthSq));
      const ex = a.x + t * dx - px;
      const ey = a.y + t * dy - py;
      if (ex * ex + ey * ey <= radiusSq) {
        lines[y * width + x] = 1;
      }
    }
  }
}

function fillPolygon(raster: Raster, polygon: Point[], id: number): void {
  const { width, height, fills } = raster;
  const ys = polygon.map((p) => p.y);
  const minY = Math.max(0, Math.floor(Math.min(...ys)));
  const maxY = Math.min(height - 1, Math.ceil(Math.max(...ys)));
  for (let y = minY; y <= maxY; y++) {
    const py = y + 0.5;
    const crossings: number[] = [];
    for (let i = 0; i < polygon.length; i++) {
      const a = polygon[i] as Point;
      const b = polygon[(i + 1) % polygon.length] as Point;
      if (a.y <= py !== b.y <= py) {
        crossings.push(a.x + ((py - a.y) / (b.y - a.y)) * (b.x - a.x));
      }
    }
    crossings.sort((p, q) => p - q);
    for (let i = 0; i + 1 < crossings.length; i += 2) {
      const from = Math.max(0, Math.ceil((crossings[i] as number) - 0.5));
      const to = Math.min(width - 1, Math.floor((crossings[i + 1] as number) - 0.5));
      for (let x = from; x <= to; x++) {
        fills[y * width + x] = id;
      }
    }
  }
}

/** Vykreslí trace do masek bez antialiasingu. */
export function rasterize(trace: Pick<Trace, 'segments' | 'fills'>, width = VIEW.width, height = VIEW.height): Raster {
  const raster: Raster = {
    width,
    height,
    lines: new Uint8Array(width * height),
    fills: new Uint8Array(width * height),
  };
  for (const fill of trace.fills) {
    fillPolygon(
      raster,
      fill.polygon.map((p) => toPixel(p, width, height)),
      colorId(fill.color),
    );
  }
  for (const segment of trace.segments) {
    drawSegment(raster, toPixel(segment.from, width, height), toPixel(segment.to, width, height), LINE_WIDTH / 2);
  }
  return raster;
}

/** Rozšíří masku o `radius` px (čtverec). */
export function dilate(mask: Uint8Array, width: number, height: number, radius: number): Uint8Array {
  const out = new Uint8Array(mask.length);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const value = mask[y * width + x] as number;
      if (!value) {
        continue;
      }
      for (let dy = -radius; dy <= radius; dy++) {
        const ny = y + dy;
        if (ny < 0 || ny >= height) {
          continue;
        }
        for (let dx = -radius; dx <= radius; dx++) {
          const nx = x + dx;
          if (nx >= 0 && nx < width) {
            out[ny * width + nx] = value;
          }
        }
      }
    }
  }
  return out;
}
