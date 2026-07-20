interface ParetoPoint<T> {
  order: number,
  state: T,
  coordinates: number[],
}

interface ParetoIndexNode<T> {
  start: number,
  end: number,
  minimums: number[],
  maximums: number[],
  minimumOrder: number,
  left?: ParetoIndexNode<T>,
  right?: ParetoIndexNode<T>,
}

const paretoIndexLeafSize = 32;

export class ParetoFrontierLimitError extends Error {}

function swap<T>(values: T[], a: number, b: number): void {
  const value = values[a];
  values[a] = values[b];
  values[b] = value;
}

function comparePointCoordinate<T>(a: ParetoPoint<T>, b: ParetoPoint<T>, dimension: number): number {
  return a.coordinates[dimension] - b.coordinates[dimension] || a.order - b.order;
}

function partitionPoints<T>(
  points: ParetoPoint<T>[],
  start: number,
  end: number,
  pivotIndex: number,
  dimension: number,
): number {
  const pivot = points[pivotIndex];
  swap(points, pivotIndex, end - 1);
  let next = start;
  for (let i = start; i < end - 1; i++) {
    if (comparePointCoordinate(points[i], pivot, dimension) < 0) {
      swap(points, next, i);
      next++;
    }
  }
  swap(points, next, end - 1);
  return next;
}

function selectPoint<T>(
  points: ParetoPoint<T>[],
  start: number,
  end: number,
  target: number,
  dimension: number,
): void {
  let low = start;
  let high = end;
  while (high - low > 1) {
    const middle = low + Math.floor((high - low) / 2);
    const last = high - 1;
    let pivotIndex = middle;
    if (comparePointCoordinate(points[low], points[middle], dimension) > 0) {
      swap(points, low, middle);
    }
    if (comparePointCoordinate(points[middle], points[last], dimension) > 0) {
      swap(points, middle, last);
    }
    if (comparePointCoordinate(points[low], points[middle], dimension) > 0) {
      swap(points, low, middle);
    }
    pivotIndex = middle;
    const selected = partitionPoints(points, low, high, pivotIndex, dimension);
    if (selected === target) return;
    if (target < selected) {
      high = selected;
    } else {
      low = selected + 1;
    }
  }
}

function buildParetoIndex<T>(
  points: ParetoPoint<T>[],
  start: number,
  end: number,
  depth: number,
  dimensionCount: number,
  dimensionRanges?: number[],
): ParetoIndexNode<T> {
  const minimums = Array.from({ length: dimensionCount }, () => Infinity);
  const maximums = Array.from({ length: dimensionCount }, () => -Infinity);
  let minimumOrder = Infinity;
  for (let i = start; i < end; i++) {
    const point = points[i];
    minimumOrder = Math.min(minimumOrder, point.order);
    for (let dimension = 0; dimension < dimensionCount; dimension++) {
      minimums[dimension] = Math.min(minimums[dimension], point.coordinates[dimension]);
      maximums[dimension] = Math.max(maximums[dimension], point.coordinates[dimension]);
    }
  }
  const node: ParetoIndexNode<T> = { start, end, minimums, maximums, minimumOrder };
  if (end - start <= paretoIndexLeafSize) return node;

  const ranges = dimensionRanges ?? maximums.map((value, dimension) => value - minimums[dimension]);
  let dimension = depth % dimensionCount;
  let widest = -Infinity;
  for (let offset = 0; offset < dimensionCount; offset++) {
    const candidate = (depth + offset) % dimensionCount;
    const range = ranges[candidate];
    const width = range === 0 ? 0 : (maximums[candidate] - minimums[candidate]) / range;
    if (width > widest) {
      widest = width;
      dimension = candidate;
    }
  }
  const middle = start + Math.floor((end - start) / 2);
  selectPoint(points, start, end, middle, dimension);
  node.left = buildParetoIndex(points, start, middle, depth + 1, dimensionCount, ranges);
  node.right = buildParetoIndex(points, middle, end, depth + 1, dimensionCount, ranges);
  return node;
}

function pointDominates<T>(candidate: ParetoPoint<T>, target: ParetoPoint<T>): boolean {
  if (candidate.order >= target.order) return false;
  let better = false;
  for (let dimension = 0; dimension < target.coordinates.length; dimension++) {
    const candidateValue = candidate.coordinates[dimension];
    const targetValue = target.coordinates[dimension];
    if (candidateValue < targetValue) return false;
    if (candidateValue > targetValue) better = true;
  }
  return better;
}

function hasDominator<T>(
  points: ParetoPoint<T>[],
  node: ParetoIndexNode<T>,
  target: ParetoPoint<T>,
): boolean {
  if (node.minimumOrder >= target.order) return false;
  for (let dimension = 0; dimension < target.coordinates.length; dimension++) {
    if (node.maximums[dimension] < target.coordinates[dimension]) return false;
  }
  if (
    node.minimums.every((value, dimension) => value >= target.coordinates[dimension]) &&
    node.minimums.some((value, dimension) => value > target.coordinates[dimension])
  ) {
    return true;
  }
  if (node.left === undefined || node.right === undefined) {
    for (let i = node.start; i < node.end; i++) {
      if (pointDominates(points[i], target)) return true;
    }
    return false;
  }
  return hasDominator(points, node.left, target) || hasDominator(points, node.right, target);
}

/**
 * Filters an already deterministically-sorted list to its Pareto frontier.
 * Coordinates are maximized, and points in different groups never dominate one another.
 */
export function filterParetoFrontier<T>(
  states: T[],
  getGroup: (state: T) => number,
  getCoordinates: (state: T) => number[],
  limit: number,
): T[] {
  const grouped = new Map<number, ParetoPoint<T>[]>();
  const pointByOrder: ParetoPoint<T>[] = [];
  for (let order = 0; order < states.length; order++) {
    const state = states[order];
    const point = { order, state, coordinates: getCoordinates(state) };
    pointByOrder.push(point);
    const group = getGroup(state);
    const points = grouped.get(group);
    if (points === undefined) {
      grouped.set(group, [point]);
    } else {
      points.push(point);
    }
  }

  const indexByGroup = new Map<number, { points: ParetoPoint<T>[], root: ParetoIndexNode<T> }>();
  for (const [ group, points ] of grouped) {
    const root = buildParetoIndex(points, 0, points.length, 0, points[0].coordinates.length);
    indexByGroup.set(group, { points, root });
  }

  const frontier: T[] = [];
  for (const point of pointByOrder) {
    const index = indexByGroup.get(getGroup(point.state))!;
    if (hasDominator(index.points, index.root, point)) continue;
    frontier.push(point.state);
    if (frontier.length > limit) {
      throw new ParetoFrontierLimitError('计算范围过大，请缩小品级范围。');
    }
  }
  return frontier;
}
