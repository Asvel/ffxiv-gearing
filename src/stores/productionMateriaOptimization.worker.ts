import { optimizeProductionMateria } from './productionMateriaOptimizationCore';
import type { ProductionMateriaOptimizationInput,
  ProductionMateriaOptimizationResult } from './productionMateriaOptimizationCore';

interface ProductionMateriaWorkerRequest {
  id: number;
  input: ProductionMateriaOptimizationInput;
}

interface ProductionMateriaWorkerResponse {
  id: number;
  result: ProductionMateriaOptimizationResult;
}

interface ProductionMateriaWorkerScope {
  onmessage: ((event: MessageEvent<ProductionMateriaWorkerRequest>) => void) | null;
  postMessage: (message: ProductionMateriaWorkerResponse) => void;
}

const workerScope = globalThis as unknown as ProductionMateriaWorkerScope;

workerScope.onmessage = (event: MessageEvent<ProductionMateriaWorkerRequest>) => {
  const { id, input } = event.data;
  workerScope.postMessage({ id, result: optimizeProductionMateria(input) });
};

export {};
