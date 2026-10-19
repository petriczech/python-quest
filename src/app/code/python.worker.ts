/// <reference lib="webworker" />
import type { loadPyodide as LoadPyodide } from 'pyodide';
import { TURTLE_SHIM } from '../core/turtle-shim';
import type { PythonRunResult } from '../core/turtle-ops';
import type { WorkerRequest, WorkerResponse } from './python-protocol';

/** Pyodide se načte za běhu ze `pyodide/` vedle aplikace (kopie z npm balíčku), ne z bundlu */
const indexURL = new URL('pyodide/', self.location.href).href;

const ready = (async () => {
  const module = (await import(/* @vite-ignore */ `${indexURL}pyodide.mjs`)) as { loadPyodide: typeof LoadPyodide };
  const pyodide = await module.loadPyodide({ indexURL });
  pyodide.runPython(TURTLE_SHIM);
  return pyodide.runPython('run_student') as (code: string) => string;
})();

ready.then(
  () => postMessage({ kind: 'ready' } satisfies WorkerResponse),
  (error: unknown) => postMessage({ kind: 'failed', message: String(error) } satisfies WorkerResponse),
);

addEventListener('message', async ({ data }: MessageEvent<WorkerRequest>) => {
  let result: PythonRunResult;
  try {
    const runStudent = await ready;
    result = JSON.parse(runStudent(data.code)) as PythonRunResult;
  } catch (error) {
    // Pád samotného Pyodide (např. dojde paměť), chyby studenta zachytí už shim
    result = { ops: [], error: { type: 'InternalError', message: String(error), line: null }, truncated: false, output: '' };
  }
  postMessage({ kind: 'result', id: data.id, result } satisfies WorkerResponse);
});
