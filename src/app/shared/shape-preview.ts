import { Component, computed, input } from '@angular/core';
import { Level, levelStart } from '../core/level';
import { run } from '../core/run';

/** Malý náhled vzoru úlohy. */
@Component({
  selector: 'app-shape-preview',
  template: `
    <svg [attr.viewBox]="shape().viewBox" width="100%" height="72" aria-hidden="true">
      @for (fill of shape().fills; track $index) {
        <polygon [attr.points]="fill.points" [attr.fill]="fill.color" opacity="0.8" />
      }
      @for (line of shape().lines; track $index) {
        <line
          [attr.x1]="line.x1"
          [attr.y1]="line.y1"
          [attr.x2]="line.x2"
          [attr.y2]="line.y2"
          stroke="#12233B"
          [attr.stroke-width]="shape().stroke"
          stroke-linecap="round"
        />
      }
    </svg>
  `,
  styles: `
    :host {
      display: block;
      background: var(--surface-2);
      border-radius: 10px;
      padding: 6px;
    }
    svg {
      display: block;
    }
  `,
})
export class ShapePreview {
  readonly level = input.required<Level>();

  protected readonly shape = computed(() => {
    const trace = run(this.level().reference, levelStart(this.level()));
    const points = trace.segments.flatMap((s) => [s.from, s.to]);
    const xs = points.map((p) => p.x);
    const ys = points.map((p) => -p.y);
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    const width = Math.max(Math.max(...xs) - minX, 1);
    const height = Math.max(Math.max(...ys) - minY, 1);
    const pad = Math.max(width, height) * 0.1;
    return {
      viewBox: `${minX - pad} ${minY - pad} ${width + 2 * pad} ${height + 2 * pad}`,
      stroke: Math.max(width, height) / 40,
      lines: trace.segments.map((s) => ({ x1: s.from.x, y1: -s.from.y, x2: s.to.x, y2: -s.to.y })),
      fills: trace.fills.map((f) => ({
        color: f.color,
        points: f.polygon.map((p) => `${p.x},${-p.y}`).join(' '),
      })),
    };
  });
}
