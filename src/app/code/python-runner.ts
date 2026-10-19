import { Service, signal } from '@angular/core';
import type { PythonRunResult } from '../core/turtle-ops';
import type { WorkerRequest, WorkerResponse } from './python-protocol';

/** Limit běhu programu, pak se worker ukončí (nekonečná smyčka bez kreslení) */
export const RUN_TIMEOUT_MS = 5000;

export type RunnerState = 'idle' | 'loading' | 'ready' | 'failed';

interface Pending {
  resolve: (result: PythonRunResult) => void;
  timer: ReturnType<typeof setTimeout>;
}

function errorResult(type: string, message: string): PythonRunResult {
  return { ops: [], error: { type, message, line: null }, truncated: false, output: '' };
}

/** Spouští Python v Pyodide ve Web Workeru. Worker vzniká až při prvním použití. */
@Service()
export class PythonRunner {
  readonly state = signal<RunnerState>('idle');

  private worker: Worker | null = null;
  private ready: Promise<boolean> | null = null;
  /** Ukončení workeru během načítání musí uvolnit čekající `ready` */
  private resolveReady: ((ok: boolean) => void) | null = null;
  private nextId = 1;
  private readonly pending = new Map<number, Pending>();

  /** Spustí načítání Pythonu dopředu, aby první spuštění nečekalo. */
  preload(): void {
    this.ensureWorker();
  }

  async run(code: string): Promise<PythonRunResult> {
    const ready = await this.ensureWorker();
    const worker = this.worker;
    if (!ready || !worker) {
      return errorResult('LoadError', 'Python se nepodařilo načíst. Zkontroluj připojení a zkus to znovu.');
    }
    const id = this.nextId++;
    return new Promise<PythonRunResult>((resolve) => {
      const timer = setTimeout(() => {
        // Ukončí jen worker, ve kterém tenhle běh visí, ne novější
        if (this.worker === worker) {
          this.stop(errorResult('TimeoutError', 'Program běžel moc dlouho. Není v něm nekonečná smyčka?'));
        }
      }, RUN_TIMEOUT_MS);
      this.pending.set(id, { resolve, timer });
      worker.postMessage({ id, code } satisfies WorkerRequest);
    });
  }

  private ensureWorker(): Promise<boolean> {
    if (this.ready) {
      return this.ready;
    }
    this.state.set('loading');
    const worker = new Worker(new URL('./python.worker', import.meta.url), { type: 'module' });
    this.worker = worker;
    this.ready = new Promise<boolean>((resolve) => {
      this.resolveReady = resolve;
      worker.addEventListener('message', ({ data }: MessageEvent<WorkerResponse>) => {
        if (data.kind === 'ready') {
          this.state.set('ready');
          resolve(true);
        } else if (data.kind === 'failed') {
          this.fail();
          resolve(false);
        } else {
          const pending = this.pending.get(data.id);
          if (pending) {
            clearTimeout(pending.timer);
            this.pending.delete(data.id);
            pending.resolve(data.result);
          }
        }
      });
      worker.addEventListener('error', () => {
        this.fail();
        resolve(false);
      });
    });
    return this.ready;
  }

  /**
   * Ukončí worker a všem čekajícím během vrátí `reason`; další spuštění založí nový worker
   * a Python se načte znovu (z cache).
   */
  private stop(reason: PythonRunResult): void {
    this.worker?.terminate();
    this.worker = null;
    this.ready = null;
    this.resolveReady?.(false);
    this.resolveReady = null;
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timer);
      pending.resolve(reason);
    }
    this.pending.clear();
    this.state.set('idle');
  }

  private fail(): void {
    this.stop(errorResult('LoadError', 'Python se nepodařilo načíst. Zkontroluj připojení a zkus to znovu.'));
    this.state.set('failed');
  }
}
