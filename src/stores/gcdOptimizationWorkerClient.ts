import { optimizeGcd } from './gcdOptimizationCore';
import type { GcdOptimizationInput, GcdOptimizationResult } from './gcdOptimizationCore';

interface GcdOptimizationWorkerRequest {
  id: number,
  input: GcdOptimizationInput,
}

interface GcdOptimizationWorkerResponse {
  id: number,
  result: GcdOptimizationResult,
}

let requestId = 0;
let activeWorker: Worker | undefined;
let activeResolve: ((result: GcdOptimizationResult) => void) | undefined;

function completeActive(result: GcdOptimizationResult) {
  activeWorker?.terminate();
  activeWorker = undefined;
  activeResolve?.(result);
  activeResolve = undefined;
}

export function optimizeGcdInWorker(input: GcdOptimizationInput): Promise<GcdOptimizationResult> {
  if (typeof Worker === 'undefined') {
    return Promise.resolve(optimizeGcd(input));
  }

  completeActive({ status: 'error', message: '计算已取消。' });

  const id = ++requestId;
  const worker = new Worker(new URL('./gcdOptimization.worker.ts', import.meta.url), { type: 'module' });
  activeWorker = worker;

  return new Promise<GcdOptimizationResult>((resolve) => {
    activeResolve = resolve;
    worker.onmessage = (event: MessageEvent<GcdOptimizationWorkerResponse>) => {
      if (event.data.id !== id || worker !== activeWorker) return;
      completeActive(event.data.result);
    };
    worker.onerror = () => {
      if (worker !== activeWorker) return;
      completeActive({ status: 'error', message: '后台计算失败。' });
    };
    worker.postMessage({ id, input } satisfies GcdOptimizationWorkerRequest);
  });
}

export function cancelGcdOptimizationInWorker(): void {
  completeActive({ status: 'error', message: '计算已取消。' });
}
