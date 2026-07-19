import * as G from '../game';

export type ProductionMateriaStat = 'CMS' | 'CRL' | 'CP' | 'GTH' | 'PCP' | 'GP';

export interface ProductionMateriaSlotInput {
  allowedGrades: G.MateriaGrade[];
}

export interface ProductionMateriaGearInput {
  gearId: G.GearId;
  slot: number;
  baseStats: G.Stats;
  caps: G.Stats;
  slots: ProductionMateriaSlotInput[];
}

export interface ProductionMateriaOptimizationInput {
  stats: [ProductionMateriaStat, ProductionMateriaStat, ProductionMateriaStat];
  baseStats: G.Stats;
  targets: G.Stats;
  gears: ProductionMateriaGearInput[];
}

export interface ProductionMateriaPlanEntry {
  stat?: ProductionMateriaStat;
  grade?: G.MateriaGrade;
}

export interface ProductionMateriaGearPlan {
  gearId: G.GearId;
  slot: number;
  materias: ProductionMateriaPlanEntry[];
}

export interface ProductionMateriaOptimizationOkResult {
  status: 'ok';
  stats: G.Stats;
  plan: ProductionMateriaGearPlan[];
  usesTools: boolean;
}

export interface ProductionMateriaOptimizationUnreachableResult {
  status: 'unreachable';
  maximumStats: G.Stats;
}

export interface ProductionMateriaOptimizationErrorResult {
  status: 'error';
  message: string;
}

export type ProductionMateriaOptimizationResult = ProductionMateriaOptimizationOkResult |
  ProductionMateriaOptimizationUnreachableResult | ProductionMateriaOptimizationErrorResult;

interface GearChoice {
  gains: [number, number, number];
  materias: ProductionMateriaPlanEntry[];
  count: number;
  neatness: number;
}

export const productionMateriaSearchStateLimit = 350_000;

type PlanSearchResult =
  { status: 'found'; plan: ProductionMateriaGearPlan[] } |
  { status: 'unreachable' } |
  { status: 'exhausted' };

type CountSearchResult =
  { status: 'found'; count: number } |
  { status: 'unreachable' } |
  { status: 'exhausted' };

function isTool(slot: number): boolean {
  return slot === 1 || slot === 2;
}

function bestGrade(
  stat: ProductionMateriaStat,
  allowedGrades: G.MateriaGrade[],
  maximumGrade: number,
): G.MateriaGrade | undefined {
  let best: G.MateriaGrade | undefined;
  for (const grade of allowedGrades) {
    if (grade > maximumGrade) continue;
    if (best === undefined || G.materias[stat]![grade - 1] > G.materias[stat]![best - 1] ||
        (G.materias[stat]![grade - 1] === G.materias[stat]![best - 1] && grade < best)) {
      best = grade;
    }
  }
  return best;
}

function enumerateGearChoices(
  gear: ProductionMateriaGearInput,
  stats: ProductionMateriaOptimizationInput['stats'],
  maximumGrade: number,
  forceFilled: boolean,
): GearChoice[] {
  const choices = new Map<string, GearChoice>();
  const materias: ProductionMateriaPlanEntry[] = new Array(gear.slots.length).fill(undefined).map(() => ({}));
  const raw: [number, number, number] = [0, 0, 0];
  const counts: [number, number, number] = [0, 0, 0];
  const visit = (slotIndex: number) => {
    if (slotIndex === gear.slots.length) {
      const gains = stats.map((stat, i) => Math.max(0, Math.min(
        raw[i],
        (gear.caps[stat] ?? 0) - (gear.baseStats[stat] ?? 0),
      ))) as [number, number, number];
      const key = gains.join(',');
      const count = counts[0] + counts[1] + counts[2];
      const neatness = counts.reduce((sum, count) => sum + count * count, 0);
      const old = choices.get(key);
      if (old === undefined || count < old.count || (count === old.count && neatness < old.neatness)) {
        choices.set(key, { gains, materias: materias.map(m => ({ ...m })), count, neatness });
      }
      return;
    }
    if (!forceFilled) {
      materias[slotIndex] = {};
      visit(slotIndex + 1);
    }
    for (let statIndex = 0; statIndex < stats.length; statIndex++) {
      const stat = stats[statIndex];
      const grade = bestGrade(stat, gear.slots[slotIndex].allowedGrades, maximumGrade);
      if (grade === undefined) continue;
      materias[slotIndex] = { stat, grade };
      raw[statIndex] += G.materias[stat]![grade - 1];
      counts[statIndex]++;
      visit(slotIndex + 1);
      counts[statIndex]--;
      raw[statIndex] -= G.materias[stat]![grade - 1];
    }
  };
  visit(0);
  return Array.from(choices.values());
}

function findPlan(
  input: ProductionMateriaOptimizationInput,
  maximumGrade: number,
  useTools: boolean,
  maximumMateriaCount: number,
): PlanSearchResult {
  const gears = input.gears.filter(gear => useTools || !isTool(gear.slot));
  const needed = input.stats.map(stat => Math.max(0, input.targets[stat]! - input.baseStats[stat]!)) as
    [number, number, number];
  const choices = gears.map(gear => enumerateGearChoices(
    gear,
    input.stats,
    maximumGrade,
    useTools && !isTool(gear.slot),
  ));
  if (choices.some(options => options.length === 0)) return { status: 'unreachable' };
  const suffixMaximum: [number, number, number][] = new Array(gears.length + 1);
  const suffixMinimumCount: number[] = new Array(gears.length + 1);
  suffixMaximum[gears.length] = [0, 0, 0];
  suffixMinimumCount[gears.length] = 0;
  for (let i = gears.length - 1; i >= 0; i--) {
    suffixMaximum[i] = input.stats.map((_, statIndex) => suffixMaximum[i + 1][statIndex] +
      Math.max(...choices[i].map(choice => choice.gains[statIndex]))) as [number, number, number];
    suffixMinimumCount[i] = suffixMinimumCount[i + 1] + Math.min(...choices[i].map(choice => choice.count));
  }
  const route: GearChoice[] = [];
  const failed = new Set<string>();
  let states = 0;
  let exhausted = false;
  const search = (
    gearIndex: number,
    deficits: [number, number, number],
    remainingCount: number,
  ): boolean => {
    if (remainingCount < suffixMinimumCount[gearIndex]) return false;
    if (deficits.every(value => value <= 0)) {
      let countLeft = remainingCount;
      for (let i = gearIndex; i < gears.length; i++) {
        const choice = choices[i].slice().sort((a, b) => a.count - b.count || a.neatness - b.neatness)[0];
        if (choice.count > countLeft) return false;
        route[i] = choice;
        countLeft -= choice.count;
      }
      return true;
    }
    if (gearIndex === gears.length || deficits.some((value, i) => value > suffixMaximum[gearIndex][i])) return false;
    const key = `${gearIndex}:${remainingCount}:${deficits.map(value => Math.max(0, value)).join(',')}`;
    if (failed.has(key)) return false;
    if (++states > productionMateriaSearchStateLimit) {
      exhausted = true;
      return false;
    }
    const ranked = choices[gearIndex].slice().sort((a, b) => {
      const aCovered = a.gains.reduce((sum, gain, i) => sum + Math.min(gain, Math.max(0, deficits[i])), 0);
      const bCovered = b.gains.reduce((sum, gain, i) => sum + Math.min(gain, Math.max(0, deficits[i])), 0);
      return bCovered - aCovered || a.count - b.count || a.neatness - b.neatness;
    });
    for (const choice of ranked) {
      if (choice.count > remainingCount) continue;
      route[gearIndex] = choice;
      const next = deficits.map((value, i) => Math.max(0, value - choice.gains[i])) as [number, number, number];
      if (search(gearIndex + 1, next, remainingCount - choice.count)) return true;
      if (exhausted) return false;
    }
    failed.add(key);
    return false;
  };
  if (!search(0, needed, maximumMateriaCount)) {
    return { status: exhausted ? 'exhausted' : 'unreachable' };
  }
  const selected = new Map(gears.map((gear, i) => [gear.gearId, route[i].materias]));
  return { status: 'found', plan: input.gears.map(gear => ({
    gearId: gear.gearId,
    slot: gear.slot,
    materias: selected.get(gear.gearId) ?? gear.slots.map(() => ({})),
  })) };
}

function findMinimumMateriaCount(
  input: ProductionMateriaOptimizationInput,
  useTools: boolean,
): CountSearchResult {
  const availableGears = input.gears.filter(gear => useTools || !isTool(gear.slot));
  let low = useTools
    ? availableGears.filter(gear => !isTool(gear.slot)).reduce((sum, gear) => sum + gear.slots.length, 0)
    : 0;
  let high = availableGears.reduce((sum, gear) => sum + gear.slots.length, 0);
  const maximumResult = findPlan(input, G.materiaMaxGrade, useTools, high);
  if (maximumResult.status !== 'found') return maximumResult;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    const result = findPlan(input, G.materiaMaxGrade, useTools, middle);
    if (result.status === 'exhausted') return result;
    if (result.status === 'unreachable') {
      low = middle + 1;
    } else {
      high = middle;
    }
  }
  return { status: 'found', count: low };
}

function calculateStats(
  input: ProductionMateriaOptimizationInput,
  plan: ProductionMateriaGearPlan[],
): G.Stats {
  const result: G.Stats = { ...input.baseStats };
  const plans = new Map(plan.map(entry => [entry.gearId, entry]));
  for (const gear of input.gears) {
    const raw: G.Stats = {};
    for (const materia of plans.get(gear.gearId)!.materias) {
      if (materia.stat === undefined) continue;
      raw[materia.stat] = (raw[materia.stat] ?? 0) + G.materias[materia.stat]![materia.grade! - 1];
    }
    for (const stat of input.stats) {
      result[stat]! += Math.max(0, Math.min(
        raw[stat] ?? 0,
        (gear.caps[stat] ?? 0) - (gear.baseStats[stat] ?? 0),
      ));
    }
  }
  return result;
}

function lowerMateriaGrades(
  input: ProductionMateriaOptimizationInput,
  plan: ProductionMateriaGearPlan[],
): void {
  const gearInputs = new Map(input.gears.map(gear => [gear.gearId, gear]));
  for (let grade = G.materiaMaxGrade; grade > G.materiaMinGrade; grade--) {
    let changed = true;
    while (changed) {
      changed = false;
      let bestCandidate: { materia: ProductionMateriaPlanEntry; grade: G.MateriaGrade; loss: number } | undefined;
      for (const gearPlan of plan) {
        const gear = gearInputs.get(gearPlan.gearId)!;
        for (let i = 0; i < gearPlan.materias.length; i++) {
          const materia = gearPlan.materias[i];
          if (materia.stat === undefined || materia.grade !== grade) continue;
          for (const lower of gear.slots[i].allowedGrades.slice().sort((a, b) => a - b)) {
            if (lower >= grade) continue;
            const oldGrade = materia.grade as G.MateriaGrade;
            materia.grade = lower;
            const stats = calculateStats(input, plan);
            const reachable = input.stats.every(stat => stats[stat]! >= input.targets[stat]!);
            materia.grade = oldGrade;
            if (!reachable) continue;
            const loss = G.materias[materia.stat]![oldGrade - 1] - G.materias[materia.stat]![lower - 1];
            if (bestCandidate === undefined || lower < bestCandidate.grade ||
                (lower === bestCandidate.grade && loss < bestCandidate.loss)) {
              bestCandidate = { materia, grade: lower, loss };
            }
            break;
          }
        }
      }
      if (bestCandidate !== undefined) {
        bestCandidate.materia.grade = bestCandidate.grade;
        changed = true;
      }
    }
  }
}

function planNeatness(
  input: ProductionMateriaOptimizationInput,
  plan: ProductionMateriaGearPlan[],
): number {
  return plan.reduce((total, gearPlan) => {
    const counts = new Map<ProductionMateriaStat, number>();
    for (const materia of gearPlan.materias) {
      if (materia.stat !== undefined) counts.set(materia.stat, (counts.get(materia.stat) ?? 0) + 1);
    }
    return total + input.stats.reduce((sum, stat) => sum + (counts.get(stat) ?? 0) ** 2, 0);
  }, 0);
}

function improvePlanNeatness(
  input: ProductionMateriaOptimizationInput,
  plan: ProductionMateriaGearPlan[],
  usesTools: boolean,
): void {
  const gearInputs = new Map(input.gears.map(gear => [gear.gearId, gear]));
  const samePriorityGroup = (a: ProductionMateriaGearPlan, b: ProductionMateriaGearPlan) =>
    isTool(a.slot) === isTool(b.slot) && (usesTools || !isTool(a.slot));
  const isReachable = () => {
    const stats = calculateStats(input, plan);
    return input.stats.every(stat => stats[stat]! >= input.targets[stat]!);
  };
  let currentScore = planNeatness(input, plan);
  let improved = true;
  while (improved) {
    improved = false;
    for (const sourceGear of plan) {
      const sourceInput = gearInputs.get(sourceGear.gearId)!;
      for (let sourceIndex = 0; sourceIndex < sourceGear.materias.length; sourceIndex++) {
        const source = sourceGear.materias[sourceIndex];
        if (source.stat === undefined) continue;
        for (const targetGear of plan) {
          if (targetGear === sourceGear || !samePriorityGroup(sourceGear, targetGear)) continue;
          const targetInput = gearInputs.get(targetGear.gearId)!;
          for (let targetIndex = 0; targetIndex < targetGear.materias.length; targetIndex++) {
            const target = targetGear.materias[targetIndex];
            if (target.stat === undefined) {
              if (!targetInput.slots[targetIndex].allowedGrades.includes(source.grade!)) continue;
              targetGear.materias[targetIndex] = source;
              sourceGear.materias[sourceIndex] = {};
              const score = planNeatness(input, plan);
              if (score < currentScore && isReachable()) {
                currentScore = score;
                improved = true;
                break;
              }
              sourceGear.materias[sourceIndex] = source;
              targetGear.materias[targetIndex] = target;
            } else {
              if (source.stat === target.stat ||
                  !targetInput.slots[targetIndex].allowedGrades.includes(source.grade!) ||
                  !sourceInput.slots[sourceIndex].allowedGrades.includes(target.grade!)) continue;
              sourceGear.materias[sourceIndex] = target;
              targetGear.materias[targetIndex] = source;
              const score = planNeatness(input, plan);
              if (score < currentScore && isReachable()) {
                currentScore = score;
                improved = true;
                break;
              }
              sourceGear.materias[sourceIndex] = source;
              targetGear.materias[targetIndex] = target;
            }
          }
          if (improved) break;
        }
        if (improved) break;
      }
      if (improved) break;
    }
  }
}

function individualMaximumStats(input: ProductionMateriaOptimizationInput): G.Stats {
  const maximum: G.Stats = { ...input.baseStats };
  for (const stat of input.stats) {
    for (const gear of input.gears) {
      let raw = 0;
      for (const slot of gear.slots) {
        const grade = bestGrade(stat, slot.allowedGrades, G.materiaMaxGrade);
        if (grade !== undefined) raw += G.materias[stat]![grade - 1];
      }
      maximum[stat]! += Math.max(0, Math.min(raw, (gear.caps[stat] ?? 0) - (gear.baseStats[stat] ?? 0)));
    }
  }
  return maximum;
}

export function optimizeProductionMateria(
  input: ProductionMateriaOptimizationInput,
): ProductionMateriaOptimizationResult {
  for (const stat of input.stats) {
    const target = input.targets[stat];
    if (!Number.isInteger(target) || target! < 0) return { status: 'error', message: '目标属性必须是非负整数。' };
    if (target! < input.baseStats[stat]!) {
      return { status: 'error', message: `${G.statNames[stat]}不能低于装备基础属性 ${input.baseStats[stat]}。` };
    }
  }
  let plan: ProductionMateriaGearPlan[] | undefined;
  let usesTools = false;
  let countResult = findMinimumMateriaCount(input, false);
  if (countResult.status === 'exhausted') {
    return { status: 'error', message: '计算范围过大，请调整目标属性后重试。' };
  }
  if (countResult.status === 'unreachable') {
    usesTools = true;
    countResult = findMinimumMateriaCount(input, true);
  }
  if (countResult.status === 'exhausted') {
    return { status: 'error', message: '计算范围过大，请调整目标属性后重试。' };
  }
  if (countResult.status === 'unreachable') {
    return { status: 'unreachable', maximumStats: individualMaximumStats(input) };
  }
  for (let grade = G.materiaMinGrade; grade <= G.materiaMaxGrade && plan === undefined; grade++) {
    const result = findPlan(input, grade, usesTools, countResult.count);
    if (result.status === 'exhausted') {
      return { status: 'error', message: '计算范围过大，请调整目标属性后重试。' };
    }
    if (result.status === 'found') plan = result.plan;
  }
  if (plan === undefined) return { status: 'error', message: '未能生成满足条件的镶嵌方案。' };
  lowerMateriaGrades(input, plan);
  improvePlanNeatness(input, plan, usesTools);
  return { status: 'ok', stats: calculateStats(input, plan), plan, usesTools };
}
