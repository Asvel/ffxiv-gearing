import { optimizeGcd } from './gcdOptimizationCore';
import type { GcdOptimizationInput, GcdOptimizationResult } from './gcdOptimizationCore';

interface GcdOptimizationWorkerRequest {
  id: number;
  input: GcdOptimizationInput;
}

interface GcdOptimizationWorkerResponse {
  id: number;
  result: GcdOptimizationResult;
}

interface GcdOptimizationWorkerScope {
  onmessage: ((event: MessageEvent<GcdOptimizationWorkerRequest>) => void) | null;
  postMessage: (message: GcdOptimizationWorkerResponse) => void;
}

const workerScope = globalThis as unknown as GcdOptimizationWorkerScope;

workerScope.onmessage = (event: MessageEvent<GcdOptimizationWorkerRequest>) => {
  const { id, input } = event.data;
  const result = optimizeGcd(input);
  workerScope.postMessage({ id, result } satisfies GcdOptimizationWorkerResponse);
};

export {};
