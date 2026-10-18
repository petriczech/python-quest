import {
  Component,
  ElementRef,
  computed,
  effect,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { VIEW } from '../core/level';
import { Point, Trace, TurtleState } from '../core/program';
import { LINE_WIDTH, rasterize, toPixel } from '../core/raster';
import { DIFF_EXTRA, DIFF_MATCH, DIFF_MISSING, diff } from '../core/score';

export type CompareMode = 'overlay' | 'slider' | 'diff';

const SCALE = 2;
const GRID = 20;
const DIFF_COLORS: Record<number, [number, number, number]> = {
  [DIFF_MATCH]: [15, 123, 108],
  [DIFF_MISSING]: [213, 43, 30],
  [DIFF_EXTRA]: [31, 95, 191],
};

/** Plátno s výstupem želvy, vzorem a režimy porovnání. */
@Component({
  selector: 'app-turtle-canvas',
  template: `
    <div class="wrap">
      <canvas
        #canvas
        width="800"
        height="600"
        role="img"
        [attr.aria-label]="label()"
      ></canvas>
      <div class="coords">
        x: {{ round(state().x) }} · y: {{ round(state().y) }} · směr: {{ round(state().heading) }}°
      </div>
      @if (mode() === 'diff') {
        <ul class="legend" aria-label="Legenda">
          <li><span class="swatch match"></span>shoda</li>
          <li><span class="swatch missing"></span>chybí</li>
          <li><span class="swatch extra"></span>navíc</li>
        </ul>
      }
    </div>
    @if (mode() === 'slider') {
      <label class="slider">
        <span>vzor</span>
        <input
          type="range"
          min="0"
          max="100"
          [value]="split()"
          (input)="split.set(+$any($event.target).value)"
          aria-label="Posuvník vzor a výstup"
        />
        <span>výstup</span>
      </label>
    }
  `,
  styles: `
    .wrap {
      position: relative;
      background: #fbfcfe;
    }
    canvas {
      display: block;
      width: 100%;
      height: auto;
      aspect-ratio: 4 / 3;
    }
    .coords {
      position: absolute;
      left: 12px;
      bottom: 12px;
      font: 12px var(--font-code);
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 6px 10px;
      color: var(--text-2);
    }
    .legend {
      position: absolute;
      right: 12px;
      bottom: 12px;
      display: flex;
      gap: 12px;
      margin: 0;
      padding: 6px 10px;
      list-style: none;
      font-size: 13px;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 8px;
    }
    .legend li {
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .swatch {
      width: 12px;
      height: 12px;
      border-radius: 3px;
    }
    .match {
      background: #0f7b6c;
    }
    .missing {
      background: #d52b1e;
    }
    .extra {
      background: #1f5fbf;
    }
    .slider {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 8px 16px;
      font-size: 13px;
      color: var(--text-3);
    }
    .slider input {
      flex: 1;
      accent-color: var(--ink);
    }
  `,
})
export class TurtleCanvas {
  readonly reference = input.required<Trace>();
  readonly output = input.required<Trace>();
  /** Počet zobrazených kroků výstupu */
  readonly step = input.required<number>();
  readonly mode = input<CompareMode>('overlay');
  readonly showPattern = input(true);
  readonly showGrid = input(true);

  protected readonly split = signal(50);
  protected readonly round = Math.round;

  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');

  protected readonly state = computed<TurtleState>(() => {
    const output = this.output();
    return output.steps[this.step() - 1] ?? output.start;
  });

  protected readonly label = computed(() => {
    const output = this.output();
    const drawn = output.steps[this.step() - 1]?.segmentCount ?? 0;
    return `Plátno: želva nakreslila ${drawn} z ${output.segments.length} čar.`;
  });

  private readonly diffImage = computed(() => {
    if (this.mode() !== 'diff') {
      return null;
    }
    const mask = diff(rasterize(this.reference()), rasterize(this.output()));
    const image = new ImageData(VIEW.width, VIEW.height);
    mask.forEach((value, i) => {
      const color = DIFF_COLORS[value];
      if (color) {
        image.data.set([...color, 255], i * 4);
      }
    });
    return image;
  });

  constructor() {
    effect(() => this.draw());
  }

  private draw(): void {
    const ctx = this.canvas().nativeElement.getContext('2d');
    if (!ctx) {
      return;
    }
    const mode = this.mode();
    const reference = this.reference();
    const output = this.output();
    const step = output.steps[this.step() - 1];
    const segmentCount = step?.segmentCount ?? 0;
    const fillCount = step?.fillCount ?? 0;

    ctx.setTransform(SCALE, 0, 0, SCALE, 0, 0);
    ctx.clearRect(0, 0, VIEW.width, VIEW.height);
    if (this.showGrid()) {
      this.drawGrid(ctx);
    }

    if (mode === 'diff') {
      this.drawDiff(ctx);
      this.drawTurtle(ctx, this.state());
      return;
    }

    if (mode === 'slider') {
      const splitX = (this.split() / 100) * VIEW.width;
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, splitX, VIEW.height);
      ctx.clip();
      this.drawTrace(ctx, reference, reference.segments.length, reference.fills.length, 1);
      ctx.restore();
      ctx.save();
      ctx.beginPath();
      ctx.rect(splitX, 0, VIEW.width - splitX, VIEW.height);
      ctx.clip();
      this.drawTrace(ctx, output, segmentCount, fillCount, 1);
      ctx.restore();
      ctx.strokeStyle = '#C2470F';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(splitX, 0);
      ctx.lineTo(splitX, VIEW.height);
      ctx.stroke();
      return;
    }

    if (this.showPattern()) {
      this.drawPattern(ctx, reference);
    }
    this.drawTrace(ctx, output, segmentCount, fillCount, 1);
    this.drawTurtle(ctx, this.state());
  }

  private drawGrid(ctx: CanvasRenderingContext2D): void {
    ctx.lineWidth = 1;
    ctx.strokeStyle = '#EDF1F6';
    ctx.beginPath();
    for (let x = GRID; x < VIEW.width; x += GRID) {
      ctx.moveTo(x + 0.5, 0);
      ctx.lineTo(x + 0.5, VIEW.height);
    }
    for (let y = (VIEW.height / 2) % GRID; y < VIEW.height; y += GRID) {
      ctx.moveTo(0, y + 0.5);
      ctx.lineTo(VIEW.width, y + 0.5);
    }
    ctx.stroke();
    ctx.strokeStyle = '#D4DDE8';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(VIEW.width / 2, 0);
    ctx.lineTo(VIEW.width / 2, VIEW.height);
    ctx.moveTo(0, VIEW.height / 2);
    ctx.lineTo(VIEW.width, VIEW.height / 2);
    ctx.stroke();
  }

  private drawPattern(ctx: CanvasRenderingContext2D, trace: Trace): void {
    ctx.save();
    ctx.globalAlpha = 0.25;
    for (const fill of trace.fills) {
      this.fillPolygon(ctx, fill.polygon, '#8FB1E0');
    }
    ctx.globalAlpha = 0.35;
    ctx.strokeStyle = '#8FB1E0';
    ctx.lineWidth = 10;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const segment of trace.segments) {
      this.line(ctx, segment.from, segment.to);
    }
    ctx.restore();
  }

  private drawTrace(
    ctx: CanvasRenderingContext2D,
    trace: Trace,
    segmentCount: number,
    fillCount: number,
    alpha: number,
  ): void {
    ctx.save();
    ctx.globalAlpha = alpha;
    for (const fill of trace.fills.slice(0, fillCount)) {
      this.fillPolygon(ctx, fill.polygon, fill.color);
    }
    ctx.lineWidth = LINE_WIDTH;
    ctx.lineCap = 'round';
    for (const segment of trace.segments.slice(0, segmentCount)) {
      ctx.strokeStyle = segment.color;
      this.line(ctx, segment.from, segment.to);
    }
    ctx.restore();
  }

  private drawDiff(ctx: CanvasRenderingContext2D): void {
    const image = this.diffImage();
    if (!image) {
      return;
    }
    const buffer = document.createElement('canvas');
    buffer.width = VIEW.width;
    buffer.height = VIEW.height;
    buffer.getContext('2d')?.putImageData(image, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(buffer, 0, 0);
  }

  private drawTurtle(ctx: CanvasRenderingContext2D, state: TurtleState): void {
    const p = toPixel(state);
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate((-state.heading * Math.PI) / 180);
    ctx.beginPath();
    ctx.moveTo(14, 0);
    ctx.lineTo(-9, -9);
    ctx.lineTo(-4, 0);
    ctx.lineTo(-9, 9);
    ctx.closePath();
    ctx.fillStyle = '#E8632B';
    ctx.strokeStyle = '#8C3410';
    ctx.lineWidth = 1.2;
    ctx.lineJoin = 'round';
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  private line(ctx: CanvasRenderingContext2D, from: Point, to: Point): void {
    const a = toPixel(from);
    const b = toPixel(to);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }

  private fillPolygon(ctx: CanvasRenderingContext2D, polygon: Point[], color: string): void {
    ctx.beginPath();
    polygon.forEach((point, i) => {
      const p = toPixel(point);
      if (i === 0) {
        ctx.moveTo(p.x, p.y);
      } else {
        ctx.lineTo(p.x, p.y);
      }
    });
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  }
}
