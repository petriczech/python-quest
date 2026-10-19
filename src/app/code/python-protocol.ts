import type { PythonRunResult } from '../core/turtle-ops';

export interface WorkerRequest {
  id: number;
  code: string;
}

export type WorkerResponse =
  | { kind: 'ready' }
  | { kind: 'failed'; message: string }
  | { kind: 'result'; id: number; result: PythonRunResult };
