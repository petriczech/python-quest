import { Component, computed, input } from '@angular/core';
import { Level, levelStart } from '../core/level';
import { Point } from '../core/program';
import { run } from '../core/run';

const MAX_LABELS = 12;
const LABEL_OFFSET = 14;

/** Vzor úlohy s kótami délek; vykresluje se z referenčního řešení. */
@Component({
  selector: 'app-pattern-figure',
  template: `
    <figure>
      <svg [attr.viewBox]="figure().viewBox" width="100%" role="img" [attr.aria-label]="figure().label">
        @for (fill of figure().fills; track $index) {
          <polygon [attr.points]="fill.points" [attr.fill]="fill.color" opacity="0.85" />
        }
        @for (line of figure().lines; track $index) {
          <line
            [attr.x1]="line.from.x"
            [attr.y1]="line.from.y"
            [attr.x2]="line.to.x"
            [attr.y2]="line.to.y"
            stroke="#12233B"
            stroke-width="2.5"
            stroke-linecap="round"
          />
        }
        @for (label of figure().labels; track $index) {
          <text
            [attr.x]="label.x"
            [attr.y]="label.y"
            text-anchor="middle"
            dominant-baseline="middle"
            class="dimension"
          >
            {{ label.text }}
          </text>
        }
        <circle [attr.cx]="figure().start.x" [attr.cy]="figure().start.y" r="5" fill="#E8632B" />
        <path
          [attr.d]="figure().arrow"
          fill="none"
          stroke="#E8632B"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
      <figcaption>Oranžová tečka je start, šipka ukazuje, kam se želva dívá.</figcaption>
    </figure>
  `,
  styles: `
    figure {
      margin: 0;
      background: var(--surface-2);
      border: 1px dashed #b7c5d4;
      border-radius: 12px;
      padding: 12px;
    }
    svg {
      display: block;
      max-height: 260px;
    }
    .dimension {
      font-family: var(--font-code);
      font-size: 12px;
      fill: var(--text);
    }
    figcaption {
      margin-top: 8px;
      font-size: 13px;
      color: var(--text-3);
    }
  `,
})
export class PatternFigure {
  readonly level = input.required<Level>();

  protected readonly figure = computed(() => {
    const level = this.level();
    const start = levelStart(level);
    const trace = run(level.reference, start);
    const flip = (p: Point): Point => ({ x: p.x, y: -p.y });

    // Úsečky projeté víckrát se kótují jednou
    const unique = new Map<string, { from: Point; to: Point }>();
    for (const segment of trace.segments) {
      const a = flip(segment.from);
      const b = flip(segment.to);
      const key = [a, b]
        .map((p) => `${Math.round(p.x)},${Math.round(p.y)}`)
        .sort()
        .join('|');
      unique.set(key, { from: a, to: b });
    }
    const lines = [...unique.values()];
    const points = lines.flatMap((l) => [l.from, l.to]);
    const center = {
      x: points.reduce((s, p) => s + p.x, 0) / Math.max(points.length, 1),
      y: points.reduce((s, p) => s + p.y, 0) / Math.max(points.length, 1),
    };

    const labelled = lines.length > MAX_LABELS ? lines.slice(0, 1) : lines;
    const labels = labelled.map(({ from, to }) => {
      const mid = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
      const length = Math.hypot(to.x - from.x, to.y - from.y);
      let nx = -(to.y - from.y) / (length || 1);
      let ny = (to.x - from.x) / (length || 1);
      // Kóta směrem ven od středu tvaru
      if (nx * (mid.x - center.x) + ny * (mid.y - center.y) < 0) {
        nx = -nx;
        ny = -ny;
      }
      return {
        x: mid.x + nx * LABEL_OFFSET,
        y: mid.y + ny * LABEL_OFFSET,
        text: String(Math.round(length)),
      };
    });

    const startPoint = flip({ x: start.x ?? 0, y: start.y ?? 0 });
    const xs = [...points.map((p) => p.x), ...labels.map((l) => l.x), startPoint.x];
    const ys = [...points.map((p) => p.y), ...labels.map((l) => l.y), startPoint.y];
    const pad = 16;
    const minX = Math.min(...xs) - pad;
    const minY = Math.min(...ys) - pad;
    const sx = startPoint.x;
    const sy = startPoint.y;

    return {
      viewBox: `${minX} ${minY} ${Math.max(...xs) + pad - minX} ${Math.max(...ys) + pad - minY}`,
      label: `Vzor: ${level.title}. Kóty: ${labels.map((l) => l.text).join(', ')}.`,
      lines,
      labels,
      fills: trace.fills.map((f) => ({
        color: f.color,
        points: f.polygon.map((p) => `${p.x},${-p.y}`).join(' '),
      })),
      start: startPoint,
      arrow: `M${sx + 8} ${sy - 10} h14 m-5 -5 l5 5 l-5 5`,
    };
  });
}
