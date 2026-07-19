import { optimizeProductionMateria } from './productionMateriaOptimizationCore';
import type { ProductionMateriaOptimizationInput,
  ProductionMateriaOptimizationResult } from './productionMateriaOptimizationCore';

interface ProductionMateriaWorkerResponse {
  id: number;
  result: ProductionMateriaOptimizationResult;
}

let requestId = 0;
let activeWorker: Worker | undefined;
let activeResolve: ((result: ProductionMateriaOptimizationResult) => void) | undefined;

function completeActive(result: ProductionMateriaOptimizationResult): void {
  activeWorker?.terminate();
  activeWorker = undefined;
  activeResolve?.(result);
  activeResolve = undefined;
}

export function optimizeProductionMateriaInWorker(
  input: ProductionMateriaOptimizationInput,
): Promise<ProductionMateriaOptimizationResult> {
  if (typeof Worker === 'undefined') return Promise.resolve(optimizeProductionMateria(input));

  completeActive({ status: 'error', message: '计算已取消。' });
  const id = ++requestId;
  const worker = new Worker(new URL('./productionMateriaOptimization.worker.ts', import.meta.url), { type: 'module' });
  activeWorker = worker;
  return new Promise(resolve => {
    activeResolve = resolve;
    worker.onmessage = (event: MessageEvent<ProductionMateriaWorkerResponse>) => {
      if (event.data.id !== id || worker !== activeWorker) return;
      completeActive(event.data.result);
    };
    worker.onerror = () => {
      if (worker !== activeWorker) return;
      completeActive({ status: 'error', message: '后台计算失败。' });
    };
    worker.postMessage({ id, input });
  });
}

export function cancelProductionMateriaOptimizationInWorker(): void {
  completeActive({ status: 'error', message: '计算已取消。' });
}
