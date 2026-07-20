import * as G from '../game';
import { getGearAcquisitionPolicy, progressionBudget } from './gcdOptimizationAcquisition';
import { calcEffects, calcRequiredSpeed, floor } from './gcdOptimizationFormula';
import type {
  EquippedEffects,
  GcdOptimizationGearInput,
  GcdOptimizationGearPlan,
  GcdOptimizationInput,
  GcdOptimizationMateriaPlan,
  GcdOptimizationResult,
} from './gcdOptimizationTypes';
import { filterParetoFrontier, ParetoFrontierLimitError } from './paretoFrontier';

export { calcEffects, calcGcd, calcRequiredSpeed } from './gcdOptimizationFormula';
export type {
  EquippedEffects,
  GcdOptimizationGearInput,
  GcdOptimizationGearPlan,
  GcdOptimizationInput,
  GcdOptimizationMateriaPlan,
  GcdOptimizationMode,
  GcdOptimizationResult,
  GcdOptimizationSpeedRange,
} from './gcdOptimizationTypes';

interface GcdGearState {
  slot: number,
  gearId: G.GearId,
  stats: G.Stats,
  materias?: GcdOptimizationMateriaPlan[],
  planItems?: GcdOptimizationGearPlan[],
  changeCost: number,
  tomestoneCost?: number,
  raidCost?: number,
}

interface GcdPlanNode {
  previous?: GcdPlanNode,
  item: GcdOptimizationGearPlan,
}

interface GcdCombinedState {
  stats: G.Stats,
  plan?: GcdPlanNode,
  changeCost: number,
  tomestoneCost?: number,
  raidCost?: number,
}

interface GcdMateriaState {
  stats: G.Stats,
  totals: G.Stats,
  materias: GcdOptimizationMateriaPlan[],
  changeCost: number,
}

interface GcdSlotStateSet {
  schemaIndex: number,
  states: GcdGearState[],
}

interface GcdAllGearStateSets {
  slotStates: GcdSlotStateSet[],
  customSkipped: boolean,
  guaranteedBaseSpeed: number,
  error?: string,
}

interface GcdExactPlanNode {
  previous?: GcdExactPlanNode,
  state: GcdGearState,
}

interface GcdExactState {
  values: number[],
  dualScores: number[],
  changeCost: number,
  tomestoneCost?: number,
  raidCost?: number,
  plan?: GcdExactPlanNode,
}

interface GcdExactChoice {
  state: GcdGearState,
  values: number[],
  dualScores?: number[],
}

interface GcdExactSlot {
  schemaIndex: number,
  choices: GcdExactChoice[],
}

interface GcdDamageDual {
  weights: number[],
  intercept: number,
  slotMaximums: number[],
  root: number,
}

interface GcdConstrainedDamageDual extends GcdDamageDual {
  speedWeight: number,
}

interface GcdExactBest {
  choices: GcdExactChoice[],
  effects: EquippedEffects,
  stats: G.Stats,
  food?: G.Food,
  changeCost: number,
}

interface GcdExactDamageModel {
  attackMainStat: G.Stat,
  weaponStat: G.Stat,
  damageStats: G.Stat[],
  damageIndexes: number[],
  foods: (G.Food | undefined)[],
  lowerBounds: number[],
  upperBounds: number[],
  damageMultiplier: number,
  logConstant: number,
  factor: (stat: G.Stat, value: number) => number,
  logFactor: (stat: G.Stat, value: number) => number,
}

interface GcdOptimizationContext extends GcdOptimizationInput {
  schema: G.JobSchema,
  gearById: Map<G.GearId, GcdOptimizationGearInput>,
  equippedGearIdBySlot: Map<number, G.GearId>,
  progressionPointWeaponChargeSlot?: number,
}

export const gcdOptimizationMinTargetGcd = 1.80;
export const gcdOptimizationMaxTargetGcd = 2.50;
export const gcdOptimizationMaxSpeed = 100000;

const gcdOptimizationFrontierLimit = 200000;
const gcdOptimizationExactStateLimit = 1000000;
const gcdOptimizationDamageTolerance = 1e-10;
const gcdOptimizationBoundTolerance = 1e-10;

interface ProgressionCostState {
  tomestoneCost?: number,
  raidCost?: number,
}

function getTomestoneCost(state: ProgressionCostState): number {
  return state.tomestoneCost ?? 0;
}

function getRaidCost(state: ProgressionCostState): number {
  return state.raidCost ?? 0;
}

function isWithinProgressionBudget(ctx: GcdOptimizationContext, state: ProgressionCostState): boolean {
  if (ctx.progressionWeeks === undefined) return true;
  return getTomestoneCost(state) <= progressionBudget.tomestonesPerWeek * ctx.progressionWeeks &&
    getRaidCost(state) <= progressionBudget.raidTokensPerWeek * ctx.progressionWeeks;
}

function isWeaponSlot(ctx: GcdOptimizationContext, slot: number): boolean {
  return ctx.schema.slots.some(item => item.slot === slot && item.uiGroup === 'weapon');
}

function isTomestoneGear(gear: GcdOptimizationGearInput): boolean {
  return getGearAcquisitionPolicy(gear.data.source, gear.slot, true, false).kind === 'tomestone';
}

function getGearProgressionCosts(
  ctx: GcdOptimizationContext,
  gear: GcdOptimizationGearInput,
): Required<ProgressionCostState> {
  if (ctx.progressionWeeks === undefined) return { tomestoneCost: 0, raidCost: 0 };
  const policy = getGearAcquisitionPolicy(
    gear.data.source,
    gear.slot,
    isWeaponSlot(ctx, gear.slot),
    gear.slot === ctx.progressionPointWeaponChargeSlot,
  );
  return { tomestoneCost: policy.tomestoneCost, raidCost: policy.raidCost };
}

function getSpeedStat(schema: G.JobSchema): G.Stat | undefined {
  if (schema.stats.includes('SPS')) return 'SPS';
  if (schema.stats.includes('SKS')) return 'SKS';
}

function getAttackMainStat(schema: G.JobSchema): G.Stat | undefined {
  if (schema.mainStat === undefined) return;
  return schema.mainStat === 'VIT' ? 'STR' : schema.mainStat;
}

function addStats(a: G.Stats, b: G.Stats): G.Stats {
  const ret = { ...a };
  for (const [ stat, value ] of Object.entries(b) as G.StatPairs) {
    ret[stat] = (ret[stat] ?? 0) + value;
  }
  return ret;
}

function getSyncedLevel(gear: G.Gear, jobLevel: G.JobLevel, syncLevel=Infinity): number | undefined {
  if (syncLevel >= gear.level && jobLevel >= gear.equipLevel) return undefined;
  const jobLevelSyncedLevel = Math.min(gear.level, G.syncLevelOfJobLevels[jobLevel]);
  return gear.equipLevelVariable
    ? Math.min(syncLevel, jobLevelSyncedLevel)
    : syncLevel < gear.level ? syncLevel : jobLevelSyncedLevel;
}

function concretizeStat(stat: G.Stat, schema: G.JobSchema): G.Stat {
  if (stat === 'main') return schema.mainStat!;
  if (stat === 'secondary') return schema.secondaryStat!;
  return stat;
}

function getGearBaseStats(
  gear: G.Gear,
  schema: G.JobSchema,
  jobLevel: G.JobLevel,
  syncLevel: number | undefined,
  customStats?: G.Stats,
): { stats: G.Stats, syncedLevel?: number } {
  const stats: G.Stats = {};
  for (const [ stat, value ] of Object.entries(gear.stats) as G.StatPairs) {
    stats[concretizeStat(stat, schema)] = value;
  }
  if (gear.customizable) {
    Object.assign(stats, customStats);
  }
  const syncedLevel = getSyncedLevel(gear, jobLevel, syncLevel);
  if (syncedLevel !== undefined) {
    const caps = G.getCaps(gear, syncedLevel);
    for (const [ stat, value ] of Object.entries(stats) as G.StatPairs) {
      stats[stat] = Math.min(value, caps[stat]!);
    }
    if (syncedLevel === 700 && gear.occultStats !== undefined) {
      for (const [ stat, value ] of Object.entries(gear.occultStats) as G.StatPairs) {
        const concreteStat = concretizeStat(stat, schema);
        stats[concreteStat] = (stats[concreteStat] ?? 0) + value;
      }
    }
  }
  return { stats, syncedLevel };
}

function getMateriaSlotCount(gear: G.Gear): number {
  return gear.materiaAdvanced ? 5 : gear.materiaSlot;
}

function getDefaultMateriaGrades(gear: G.Gear, materiaIndex: number): G.MateriaGrade[] {
  const canRestricted = materiaIndex <= gear.materiaSlot;
  return G.materiaGrades.slice(0, 2).filter(grade =>
    gear.level >= G.materiaGradeRequiredLevels[grade - 1] &&
    (canRestricted || !G.materiaGradeIsRestricted[grade]));
}

function getCandidateMateriaStats(
  schema: G.JobSchema,
  speedStat: G.Stat,
  skipSpeedMateria=false,
): G.Stat[] {
  const stats = ['CRT', 'DET', 'DHT', speedStat] as G.Stat[];
  if (schema.stats.includes('TEN')) {
    stats.push('TEN');
  }
  return Array.from(new Set(stats)).filter(stat =>
    schema.stats.includes(stat) && stat in G.materias && (!skipSpeedMateria || stat !== speedStat));
}

function applyMateriaStats(baseStats: G.Stats, materiaStats: G.Stats, caps: G.Stats): G.Stats {
  const stats = { ...baseStats };
  for (const [ stat, value ] of Object.entries(materiaStats) as G.StatPairs) {
    const base = stats[stat] ?? 0;
    stats[stat] = Math.min(base + value, Math.max(base, caps[stat] ?? Infinity));
  }
  return stats;
}

function getRelevantStats(schema: G.JobSchema, speedStat: G.Stat): G.Stat[] {
  const attackMainStat = getAttackMainStat(schema)!;
  const weaponStat = schema.mainStat === 'MND' || schema.mainStat === 'INT' ? 'MDMG' : 'PDMG';
  const stats = [attackMainStat, weaponStat, 'CRT', 'DET', 'DHT', speedStat] as G.Stat[];
  if (schema.stats.includes('TEN')) {
    stats.push('TEN');
  }
  return Array.from(new Set(stats));
}

function getComparableStatValue(
  stats: G.Stats,
  stat: G.Stat,
  speedStat: G.Stat,
  requiredSpeed: number,
): number {
  const value = stats[stat] ?? 0;
  return stat === speedStat ? Math.min(value, requiredSpeed) : value;
}

function getPruneKey(
  stats: G.Stats,
  relevantStats: G.Stat[],
  speedStat: G.Stat,
  requiredSpeed: number,
): string {
  return relevantStats.map(stat => getComparableStatValue(stats, stat, speedStat, requiredSpeed)).join(',');
}

function getSpeedOverflow(stats: G.Stats, speedStat: G.Stat, requiredSpeed: number): number {
  return Math.max(0, (stats[speedStat] ?? 0) - requiredSpeed);
}

function shouldReplaceSamePruneKey<T extends { stats: G.Stats, changeCost: number } & ProgressionCostState>(
  state: T,
  existing: T,
  speedStat: G.Stat,
  requiredSpeed: number,
): boolean {
  const overflow = getSpeedOverflow(state.stats, speedStat, requiredSpeed);
  const existingOverflow = getSpeedOverflow(existing.stats, speedStat, requiredSpeed);
  return overflow < existingOverflow || overflow === existingOverflow && state.changeCost < existing.changeCost;
}

function addUniqueState<T extends { stats: G.Stats, changeCost: number } & ProgressionCostState>(
  unique: Map<string, T>,
  state: T,
  relevantStats: G.Stat[],
  speedStat: G.Stat,
  requiredSpeed: number,
  key=`${getPruneKey(state.stats, relevantStats, speedStat, requiredSpeed)};` +
    `${getTomestoneCost(state)},${getRaidCost(state)}`,
): void {
  const existing = unique.get(key);
  if (existing === undefined || shouldReplaceSamePruneKey(state, existing, speedStat, requiredSpeed)) {
    unique.set(key, state);
  }
}

function deduplicateStates<T extends { stats: G.Stats, changeCost: number } & ProgressionCostState>(
  states: Iterable<T>,
  relevantStats: G.Stat[],
  speedStat: G.Stat,
  requiredSpeed: number,
): T[] {
  const unique = new Map<string, T>();
  for (const state of states) {
    addUniqueState(unique, state, relevantStats, speedStat, requiredSpeed);
  }
  return Array.from(unique.values());
}

function pruneUniqueStates<T extends { stats: G.Stats, changeCost: number } & ProgressionCostState>(
  states: T[],
  relevantStats: G.Stat[],
  speedStat: G.Stat,
  requiredSpeed: number,
): T[] {
  const sorted = states.sort((a, b) => {
    for (const stat of relevantStats) {
      const diff = getComparableStatValue(b.stats, stat, speedStat, requiredSpeed) -
        getComparableStatValue(a.stats, stat, speedStat, requiredSpeed);
      if (diff !== 0) return diff;
    }
    const tomestoneDiff = getTomestoneCost(a) - getTomestoneCost(b);
    if (tomestoneDiff !== 0) return tomestoneDiff;
    const raidDiff = getRaidCost(a) - getRaidCost(b);
    if (raidDiff !== 0) return raidDiff;
    return a.changeCost - b.changeCost;
  });
  const otherStats = relevantStats.filter(stat => stat !== speedStat);
  return filterParetoFrontier(
    sorted,
    state => getComparableStatValue(state.stats, speedStat, speedStat, requiredSpeed),
    state => [
      ...otherStats.map(stat => state.stats[stat] ?? 0),
      -getSpeedOverflow(state.stats, speedStat, requiredSpeed),
      -getTomestoneCost(state),
      -getRaidCost(state),
      -state.changeCost,
    ],
    gcdOptimizationFrontierLimit,
  );
}

export function pruneGcdOptimizationStates<
  T extends { stats: G.Stats, changeCost: number } & ProgressionCostState,
>(
  states: Iterable<T>,
  relevantStats: G.Stat[],
  speedStat: G.Stat,
  requiredSpeed: number,
): T[] {
  // Keep every dimension that can affect feasibility or the final tie-break order in the Pareto key.
  // In particular, pre-food speed cannot dominate a lower value because food and a maximum range are nonlinear.
  return pruneUniqueStates(
    deduplicateStates(states, relevantStats, speedStat, requiredSpeed),
    relevantStats,
    speedStat,
    requiredSpeed,
  );
}

function getFoodEffectiveStats(stats: G.Stats, food?: G.Food): G.Stats {
  if (food === undefined) return {};
  const ret: G.Stats = {};
  for (const stat of Object.keys(food.stats) as G.Stat[]) {
    if (stat in food.statRates) {
      ret[stat] = Math.min(food.stats[stat]!, floor((stats[stat] ?? 0) * food.statRates[stat]! / 100));
    } else {
      ret[stat] = food.stats[stat];
    }
  }
  return ret;
}

function getCurrentGearOfSlot(ctx: GcdOptimizationContext, slot: number): GcdOptimizationGearInput | undefined {
  const gearId = ctx.equippedGearIdBySlot.get(slot);
  return gearId === undefined ? undefined : ctx.gearById.get(gearId);
}

function getGearChangeCost(currentGear: GcdOptimizationGearInput | undefined, gear: GcdOptimizationGearInput): number {
  return currentGear?.id === gear.id ? 0 : 100000;
}

function getGearStates(
  ctx: GcdOptimizationContext,
  gear: GcdOptimizationGearInput,
  speedStat: G.Stat,
  requiredSpeed: number,
  relevantStats: G.Stat[],
  currentGear: GcdOptimizationGearInput | undefined,
  skipUnconfiguredCustomStats: boolean,
  skipSpeedMateria: boolean,
): { states: GcdGearState[], customSkipped: boolean } {
  const data = gear.data;
  if (skipUnconfiguredCustomStats && data.customizable && Object.keys(gear.customStats ?? {}).length === 0) {
    return { states: [], customSkipped: true };
  }

  const baseChangeCost = getGearChangeCost(currentGear, gear);
  const progressionCosts = getGearProgressionCosts(ctx, gear);
  const { stats: syncedStats, syncedLevel } = getGearBaseStats(
    data,
    ctx.schema,
    ctx.jobLevel,
    ctx.syncLevel,
    gear.customStats,
  );
  const materiaSlotCount = getMateriaSlotCount(data);
  if (syncedLevel !== undefined || materiaSlotCount === 0) {
    return {
      customSkipped: false,
      states: [{
        slot: gear.slot,
        gearId: gear.id,
        stats: syncedStats,
        changeCost: baseChangeCost,
        ...progressionCosts,
      }],
    };
  }

  const candidateMateriaStats = getCandidateMateriaStats(ctx.schema, speedStat, skipSpeedMateria);
  const currentMaterias = currentGear?.id === gear.id ? currentGear.materias.slice(0, materiaSlotCount) : [];
  const options = Array.from({ length: materiaSlotCount }, (_, index) => {
    const slotOptions: GcdOptimizationMateriaPlan[] = [
      {},
      ...getDefaultMateriaGrades(data, index).flatMap(grade =>
        candidateMateriaStats.map(stat => ({ stat, grade }))),
    ];
    const current = currentMaterias[index];
    if (current?.stat !== undefined && current.grade !== undefined) slotOptions.push({ ...current });
    return Array.from(new Map(slotOptions.map(option =>
      [`${option.stat ?? ''}:${option.grade ?? ''}`, option])).values());
  });
  const mutableStats = Array.from(new Set(options.flatMap(slotOptions =>
    slotOptions.flatMap(option => option.stat === undefined ? [] : [option.stat]))));
  const caps = G.getCaps(data);
  let materiaStates = new Map<string, GcdMateriaState>();
  materiaStates.set('', { stats: syncedStats, totals: {}, materias: [], changeCost: 0 });
  for (let index = 0; index < options.length; index++) {
    const nextStates = new Map<string, GcdMateriaState>();
    for (const state of materiaStates.values()) {
      for (const option of options[index]) {
        const totals = { ...state.totals };
        if (option.stat !== undefined && option.grade !== undefined) {
          totals[option.stat] = (totals[option.stat] ?? 0) + G.materias[option.stat]![option.grade - 1];
        }
        const stats = applyMateriaStats(syncedStats, totals, caps);
        const materias = state.materias.concat({ stat: option.stat, grade: option.grade });
        const current = currentMaterias[index];
        const changeCost = state.changeCost +
          (current?.stat === option.stat && current?.grade === option.grade ? 0 : 1);
        const key = mutableStats.map(stat => stats[stat] ?? 0).join(',');
        const existing = nextStates.get(key);
        if (existing === undefined || changeCost < existing.changeCost) {
          nextStates.set(key, { stats, totals, materias, changeCost });
        }
      }
    }
    materiaStates = nextStates;
  }

  const states = Array.from(materiaStates.values(), state => ({
    slot: gear.slot,
    gearId: gear.id,
    stats: state.stats,
    materias: state.materias,
    changeCost: baseChangeCost + state.changeCost,
    ...progressionCosts,
  }));

  return {
    customSkipped: false,
    states: pruneGcdOptimizationStates(states, relevantStats, speedStat, requiredSpeed),
  };
}

function combineFrontier(
  ctx: GcdOptimizationContext,
  frontier: GcdCombinedState[],
  gearStates: GcdGearState[],
  relevantStats: G.Stat[],
  speedStat: G.Stat,
  requiredSpeed: number,
): GcdCombinedState[] {
  if (frontier.length * gearStates.length > gcdOptimizationFrontierLimit * 20) {
    throw new ParetoFrontierLimitError('计算范围过大，请缩小品级范围。');
  }
  const combined = new Map<string, GcdCombinedState>();
  for (const frontierState of frontier) {
    for (const gearState of gearStates) {
      const speed = (frontierState.stats[speedStat] ?? 0) + (gearState.stats[speedStat] ?? 0);
      const changeCost = frontierState.changeCost + gearState.changeCost;
      const tomestoneCost = getTomestoneCost(frontierState) + getTomestoneCost(gearState);
      const raidCost = getRaidCost(frontierState) + getRaidCost(gearState);
      if (!isWithinProgressionBudget(ctx, { tomestoneCost, raidCost })) continue;
      const key = `${relevantStats.map(stat => {
        const value = (frontierState.stats[stat] ?? 0) + (gearState.stats[stat] ?? 0);
        return stat === speedStat ? Math.min(value, requiredSpeed) : value;
      }).join(',')};${tomestoneCost},${raidCost}`;
      const existing = combined.get(key);
      const overflow = Math.max(0, speed - requiredSpeed);
      if (
        existing !== undefined &&
        (overflow > getSpeedOverflow(existing.stats, speedStat, requiredSpeed) ||
          overflow === getSpeedOverflow(existing.stats, speedStat, requiredSpeed) &&
          changeCost >= existing.changeCost)
      ) {
        continue;
      }
      combined.set(key, {
        stats: addStats(frontierState.stats, gearState.stats),
        plan: appendGearStatePlan(frontierState.plan, gearState),
        changeCost,
        tomestoneCost,
        raidCost,
      });
    }
  }
  return pruneUniqueStates(Array.from(combined.values()), relevantStats, speedStat, requiredSpeed);
}

function getGearStatePlanItems(state: GcdGearState): GcdOptimizationGearPlan[] {
  return state.planItems ?? [{ slot: state.slot, gearId: state.gearId, materias: state.materias }];
}

function appendGearStatePlan(plan: GcdPlanNode | undefined, state: GcdGearState): GcdPlanNode | undefined {
  let next = plan;
  for (const item of getGearStatePlanItems(state)) {
    next = { previous: next, item };
  }
  return next;
}

function getNonrepeatableRingGroup(
  ctx: GcdOptimizationContext,
  state: GcdGearState,
): string | undefined {
  const source = ctx.gearById.get(state.gearId)?.data.source;
  return getGearAcquisitionPolicy(source, state.slot, false, false).ringExclusivityGroup;
}

function combineRingSlotStates(
  ctx: GcdOptimizationContext,
  first: GcdSlotStateSet,
  second: GcdSlotStateSet,
  relevantStats: G.Stat[],
  speedStat: G.Stat,
  requiredSpeed: number,
): GcdSlotStateSet {
  const states: GcdGearState[] = [];
  for (const firstState of first.states) {
    const firstSource = getNonrepeatableRingGroup(ctx, firstState);
    for (const secondState of second.states) {
      if (firstSource !== undefined && firstSource === getNonrepeatableRingGroup(ctx, secondState)) continue;
      const tomestoneCost = getTomestoneCost(firstState) + getTomestoneCost(secondState);
      const raidCost = getRaidCost(firstState) + getRaidCost(secondState);
      states.push({
        slot: firstState.slot,
        gearId: firstState.gearId,
        stats: addStats(firstState.stats, secondState.stats),
        planItems: getGearStatePlanItems(firstState).concat(getGearStatePlanItems(secondState)),
        changeCost: firstState.changeCost + secondState.changeCost,
        tomestoneCost,
        raidCost,
      });
    }
  }
  return {
    schemaIndex: Math.min(first.schemaIndex, second.schemaIndex),
    states: pruneGcdOptimizationStates(states, relevantStats, speedStat, requiredSpeed),
  };
}

function pruneRingSlotStates(
  ctx: GcdOptimizationContext,
  states: GcdGearState[],
  relevantStats: G.Stat[],
  speedStat: G.Stat,
  requiredSpeed: number,
): GcdGearState[] {
  const statesBySource = new Map<string, GcdGearState[]>();
  for (const state of states) {
    const source = getNonrepeatableRingGroup(ctx, state) ?? '';
    const sourceStates = statesBySource.get(source) ?? [];
    sourceStates.push(state);
    statesBySource.set(source, sourceStates);
  }
  return Array.from(statesBySource.values()).flatMap(sourceStates =>
    pruneGcdOptimizationStates(sourceStates, relevantStats, speedStat, requiredSpeed));
}

function createCurrentGearFrontier(
  ctx: GcdOptimizationContext,
  speedStat: G.Stat,
  requiredSpeed: number,
  relevantStats: G.Stat[],
): { frontier: GcdCombinedState[], customSkipped: boolean } {
  let frontier: GcdCombinedState[] = [{ stats: ctx.baseStats, changeCost: 0 }];
  let customSkipped = false;
  const equippedGears: GcdOptimizationGearInput[] = [];
  for (const [ slot, gearId ] of ctx.equippedGearIdsBySlot) {
    if (slot === -1 || slot === -2) continue;
    const gear = ctx.gearById.get(gearId);
    if (gear === undefined) continue;
    equippedGears.push(gear);
  }
  const baseSpeed = (ctx.baseStats[speedStat] ?? 0) + equippedGears.reduce((total, gear) =>
    total + (getGearBaseStats(gear.data, ctx.schema, ctx.jobLevel, ctx.syncLevel, gear.customStats)
      .stats[speedStat] ?? 0), 0);
  const skipSpeedMateria = baseSpeed >= requiredSpeed;
  for (const gear of equippedGears) {
    const { states, customSkipped: skipped } = getGearStates(
      ctx,
      gear,
      speedStat,
      requiredSpeed,
      relevantStats,
      gear,
      false,
      skipSpeedMateria,
    );
    customSkipped ||= skipped;
    frontier = combineFrontier(ctx, frontier, states, relevantStats, speedStat, requiredSpeed);
  }
  return { frontier, customSkipped };
}

function createAllGearStateSets(
  ctx: GcdOptimizationContext,
  speedStat: G.Stat,
  requiredSpeed: number,
  relevantStats: G.Stat[],
): GcdAllGearStateSets {
  let customSkipped = false;
  const slots: { schemaIndex: number, slot: G.SlotSchema, gears: GcdOptimizationGearInput[] }[] = [];
  for (let schemaIndex = 0; schemaIndex < ctx.schema.slots.length; schemaIndex++) {
    const slot = ctx.schema.slots[schemaIndex];
    if (slot.slot === -1 || slot.slot === -2) continue;
    const gears: GcdOptimizationGearInput[] = [];
    for (const gearId of ctx.filteredIds) {
      const gear = ctx.gearById.get(gearId);
      if (gear === undefined || gear.slot !== slot.slot) continue;
      if (gear.data.customizable && Object.keys(gear.customStats ?? {}).length === 0) {
        customSkipped = true;
        continue;
      }
      gears.push(gear);
    }
    if (gears.length === 0) {
      return {
        slotStates: [],
        customSkipped,
        guaranteedBaseSpeed: 0,
        error: `${slot.name}没有可用装备，无法生成完整配装。`,
      };
    }
    slots.push({ schemaIndex, slot, gears });
  }

  if (ctx.progressionWeeks !== undefined) {
    const weaponSlots = slots.filter(item => item.slot.uiGroup === 'weapon');
    const pointWeaponsBySlot = weaponSlots.map(item => item.gears.filter(isTomestoneGear));
    const otherWeaponsBySlot = weaponSlots.map(item => item.gears.filter(gear => !isTomestoneGear(gear)));
    const forcePointWeapon = weaponSlots.length > 0 && weaponSlots.every((_, index) =>
      pointWeaponsBySlot[index].length === 1 && otherWeaponsBySlot[index].length === 0);
    if (forcePointWeapon) {
      const availableTomestones = progressionBudget.tomestonesPerWeek * ctx.progressionWeeks;
      if (availableTomestones < progressionBudget.pointWeaponCost) {
        return {
          slotStates: [],
          customSkipped,
          guaranteedBaseSpeed: 0,
          error: `准备 ${ctx.progressionWeeks} 周只有 ${availableTomestones} 点数，` +
            `不足以购买需要 ${progressionBudget.pointWeaponCost} 点数的武器。`,
        };
      }
      // 骑士的主手和盾牌共同消耗 500 点；把成本记在第一个武器部位即可避免重复扣除。
      ctx.progressionPointWeaponChargeSlot = weaponSlots[0].slot.slot;
    } else {
      for (let index = 0; index < weaponSlots.length; index++) {
        weaponSlots[index].gears = otherWeaponsBySlot[index];
        if (weaponSlots[index].gears.length > 0) continue;
        const onlyPointWeapons = pointWeaponsBySlot.every((pointWeapons, pointIndex) =>
          pointWeapons.length > 0 && otherWeaponsBySlot[pointIndex].length === 0);
        return {
          slotStates: [],
          customSkipped,
          guaranteedBaseSpeed: 0,
          error: onlyPointWeapons
            ? '使用点数武器时，请取消勾选其他武器，并在每个武器部位仅保留一件点数武器。'
            : `${weaponSlots[index].slot.name}没有可用装备，无法生成完整配装。`,
        };
      }
    }
  }

  const guaranteedBaseSpeed = (ctx.baseStats[speedStat] ?? 0) + slots.reduce((total, slot) =>
    total + Math.min(...slot.gears.map(gear =>
      getGearBaseStats(gear.data, ctx.schema, ctx.jobLevel, ctx.syncLevel, gear.customStats)
        .stats[speedStat] ?? 0)), 0);
  const skipSpeedMateria = guaranteedBaseSpeed >= requiredSpeed;
  const slotStates: GcdSlotStateSet[] = [];
  for (const { schemaIndex, slot, gears } of slots) {
    const gearStates: GcdGearState[] = [];
    for (const gear of gears) {
      const { states, customSkipped: skipped } = getGearStates(
        ctx,
        gear,
        speedStat,
        requiredSpeed,
        relevantStats,
        getCurrentGearOfSlot(ctx, slot.slot),
        false,
        skipSpeedMateria,
      );
      customSkipped ||= skipped;
      gearStates.push(...states);
    }
    slotStates.push({
      schemaIndex,
      states: Math.abs(slot.slot) === 12
        ? pruneRingSlotStates(ctx, gearStates, relevantStats, speedStat, requiredSpeed)
        : pruneGcdOptimizationStates(gearStates, relevantStats, speedStat, requiredSpeed),
    });
  }
  const ringSlotStates = slotStates.filter(slot => Math.abs(ctx.schema.slots[slot.schemaIndex].slot) === 12);
  if (ringSlotStates.length === 2) {
    const combinedRings = combineRingSlotStates(
      ctx,
      ringSlotStates[0],
      ringSlotStates[1],
      relevantStats,
      speedStat,
      requiredSpeed,
    );
    if (combinedRings.states.length === 0) {
      return {
        slotStates: [],
        customSkipped,
        guaranteedBaseSpeed,
        error: '两个戒指不能同时选择同为“点数/*”“点数强化/*”或“零式/*”的装备。',
      };
    }
    const ringSlotStateSet = new Set(ringSlotStates);
    slotStates.splice(0, slotStates.length, ...slotStates.filter(slot => !ringSlotStateSet.has(slot)), combinedRings);
  }
  slotStates.sort((a, b) => a.states.length - b.states.length || a.schemaIndex - b.schemaIndex);
  return { slotStates, customSkipped, guaranteedBaseSpeed };
}

function combineAllGearStateSets(
  ctx: GcdOptimizationContext,
  slotStates: GcdSlotStateSet[],
  speedStat: G.Stat,
  requiredSpeed: number,
  relevantStats: G.Stat[],
): GcdCombinedState[] {
  let frontier: GcdCombinedState[] = [{ stats: ctx.baseStats, changeCost: 0 }];
  for (const slot of slotStates) {
    frontier = combineFrontier(
      ctx,
      frontier,
      slot.states,
      relevantStats,
      speedStat,
      requiredSpeed,
    );
  }
  return frontier;
}

function getFoodStat(food: G.Food | undefined, stat: G.Stat): { value: number, rate?: number } {
  return {
    value: food?.stats[stat] ?? 0,
    rate: food !== undefined && stat in food.statRates ? food.statRates[stat] : undefined,
  };
}

function isSameFoodStat(a: G.Food | undefined, b: G.Food | undefined, stat: G.Stat): boolean {
  const av = getFoodStat(a, stat);
  const bv = getFoodStat(b, stat);
  return av.value === bv.value && av.rate === bv.rate;
}

function isFoodStatAlwaysAtLeast(a: G.Food | undefined, b: G.Food | undefined, stat: G.Stat): boolean {
  const av = getFoodStat(a, stat);
  const bv = getFoodStat(b, stat);
  if (av.rate !== undefined && bv.rate !== undefined) {
    return av.rate >= bv.rate && av.value >= bv.value;
  }
  if (av.rate === undefined && bv.rate === undefined) return av.value >= bv.value;
  if (av.rate === undefined) return av.value >= bv.value;
  return bv.value <= 0;
}

function foodAlwaysDominates(
  ctx: GcdOptimizationContext,
  candidate: G.Food | undefined,
  food: G.Food | undefined,
  speedStat: G.Stat,
  candidateIndex: number,
  foodIndex: number,
): boolean {
  if (!isSameFoodStat(candidate, food, speedStat)) return false;
  const candidateCost = getFoodChangeCost(ctx, candidate);
  const foodCost = getFoodChangeCost(ctx, food);
  if (candidateCost > foodCost) return false;
  const candidateId = candidate?.id ?? 0;
  const foodId = food?.id ?? 0;
  if (candidateCost === foodCost && candidateId > foodId) return false;
  if (candidateCost === foodCost && candidateId === foodId && candidateIndex > foodIndex) return false;
  const stats = new Set<G.Stat>([
    ...Object.keys(candidate?.stats ?? {}) as G.Stat[],
    ...Object.keys(candidate?.statRates ?? {}) as G.Stat[],
    ...Object.keys(food?.stats ?? {}) as G.Stat[],
    ...Object.keys(food?.statRates ?? {}) as G.Stat[],
  ]);
  return Array.from(stats).every(stat => isFoodStatAlwaysAtLeast(candidate, food, stat));
}

function getFoodCandidates(ctx: GcdOptimizationContext, speedStat: G.Stat): (G.Food | undefined)[] {
  const foods: (G.Food | undefined)[] = [undefined, ...ctx.foods];
  foods.sort((a, b) => (a?.id ?? 0) - (b?.id ?? 0));
  return foods.filter((food, foodIndex) => !foods.some((candidate, candidateIndex) =>
    candidateIndex !== foodIndex &&
    foodAlwaysDominates(ctx, candidate, food, speedStat, candidateIndex, foodIndex)));
}

function getFoodChangeCost(ctx: GcdOptimizationContext, food?: G.Food): number {
  return ctx.currentFoodId === food?.id ? 0 : 1;
}

function getFinalStats(ctx: GcdOptimizationContext, state: GcdCombinedState, food?: G.Food): G.Stats {
  let finalStats = addStats(state.stats, getFoodEffectiveStats(state.stats, food));
  for (const fixedConsumable of ctx.fixedConsumables) {
    finalStats = addStats(finalStats, getFoodEffectiveStats(state.stats, fixedConsumable));
  }
  return finalStats;
}

function isBetterGcdOptimization(
  candidate: { effects: EquippedEffects, stats: G.Stats, changeCost: number, foodId?: G.GearId },
  current: { effects: EquippedEffects, stats: G.Stats, changeCost: number, foodId?: G.GearId } | undefined,
  speedStat: G.Stat,
  requiredSpeed: number,
): boolean {
  if (current === undefined) return true;
  const damageDiff = candidate.effects.damage - current.effects.damage;
  if (Math.abs(damageDiff) > 1e-10) return damageDiff > 0;
  const overflowDiff = getSpeedOverflow(candidate.stats, speedStat, requiredSpeed) -
    getSpeedOverflow(current.stats, speedStat, requiredSpeed);
  if (overflowDiff !== 0) return overflowDiff < 0;
  if (candidate.changeCost !== current.changeCost) return candidate.changeCost < current.changeCost;
  return (candidate.foodId ?? 0) < (current.foodId ?? 0);
}

function isSpeedWithinRange(ctx: GcdOptimizationContext, speed: number): boolean {
  return ctx.speedRange === undefined || speed >= ctx.speedRange.min && speed <= ctx.speedRange.max;
}

function getSpeedRangeDistance(ctx: GcdOptimizationContext, speed: number): number {
  if (ctx.speedRange === undefined) return 0;
  if (speed < ctx.speedRange.min) return ctx.speedRange.min - speed;
  if (speed > ctx.speedRange.max) return speed - ctx.speedRange.max;
  return 0;
}

function isCloserToSpeedRange(
  ctx: GcdOptimizationContext,
  candidate: { effects: EquippedEffects, stats: G.Stats },
  current: { effects: EquippedEffects, stats: G.Stats } | undefined,
  speedStat: G.Stat,
): boolean {
  if (current === undefined) return true;
  const candidateSpeed = candidate.stats[speedStat] ?? 0;
  const currentSpeed = current.stats[speedStat] ?? 0;
  const distanceDiff = getSpeedRangeDistance(ctx, candidateSpeed) - getSpeedRangeDistance(ctx, currentSpeed);
  if (distanceDiff !== 0) return distanceDiff < 0;
  return candidate.effects.damage > current.effects.damage;
}

function materializePlan(ctx: GcdOptimizationContext, node: GcdPlanNode | undefined): GcdOptimizationGearPlan[] {
  const plan: GcdOptimizationGearPlan[] = [];
  for (let current = node; current !== undefined; current = current.previous) {
    plan.push(current.item);
  }
  const schemaOrder = new Map(ctx.schema.slots.map((slot, index) => [slot.slot, index]));
  return plan.sort((a, b) => (schemaOrder.get(a.slot) ?? Infinity) - (schemaOrder.get(b.slot) ?? Infinity));
}

function evaluateGcdFrontier(
  ctx: GcdOptimizationContext,
  speedStat: G.Stat,
  requiredSpeed: number,
  frontier: GcdCombinedState[],
  customSkipped: boolean,
): GcdOptimizationResult {
  let best: (GcdCombinedState & {
    effects: EquippedEffects,
    finalStats: G.Stats,
    food?: G.Food,
    finalChangeCost: number,
  }) | undefined;
  let fastest: { effects: EquippedEffects, stats: G.Stats } | undefined;
  let closest: { effects: EquippedEffects, stats: G.Stats } | undefined;
  const foods = getFoodCandidates(ctx, speedStat);
  for (const state of frontier) {
    for (const food of foods) {
      const finalStats = getFinalStats(ctx, state, food);
      const effects = calcEffects(finalStats, ctx.baseStats, ctx.job, ctx.jobLevel, ctx.schema);
      if (effects === undefined) continue;
      if (
        fastest === undefined ||
        effects.gcd < fastest.effects.gcd ||
        (effects.gcd === fastest.effects.gcd && effects.damage > fastest.effects.damage)
      ) {
        fastest = { effects, stats: finalStats };
      }
      if (isCloserToSpeedRange(ctx, { effects, stats: finalStats }, closest, speedStat)) {
        closest = { effects, stats: finalStats };
      }
      const speed = finalStats[speedStat] ?? 0;
      if (effects.gcd > ctx.targetGcd || !isSpeedWithinRange(ctx, speed)) continue;
      const candidate = {
        effects,
        stats: finalStats,
        changeCost: state.changeCost + getFoodChangeCost(ctx, food),
        foodId: food?.id,
      };
      if (
        isBetterGcdOptimization(
          candidate,
          best && {
            effects: best.effects,
            stats: best.finalStats,
            changeCost: best.finalChangeCost,
            foodId: best.food?.id,
          },
          speedStat,
          requiredSpeed,
        )
      ) {
        best = {
          ...state,
          effects,
          finalStats,
          food,
          finalChangeCost: candidate.changeCost,
        };
      }
    }
  }

  const baseResult = {
    mode: ctx.mode,
    targetGcd: ctx.targetGcd,
    speedStat,
    requiredSpeed,
    speedRange: ctx.speedRange,
    customSkipped,
  };
  if (best !== undefined) {
    return {
      ...baseResult,
      status: 'ok',
      stats: best.finalStats,
      effects: best.effects,
      foodId: best.food?.id,
      foodName: best.food?.name ?? '不吃食物',
      speed: best.finalStats[speedStat] ?? 0,
      damageDelta: best.effects.damage - ctx.currentDamage,
      plan: materializePlan(ctx, best.plan),
    };
  }
  if (fastest !== undefined) {
    return {
      ...baseResult,
      status: 'unreachable',
      fastestGcd: fastest.effects.gcd,
      fastestSpeed: fastest.stats[speedStat] ?? 0,
      fastestDamage: fastest.effects.damage,
      closestGcd: closest?.effects.gcd,
      closestSpeed: closest?.stats[speedStat] ?? 0,
    };
  }
  return { status: 'error', message: '没有可用于计算的装备状态。' };
}

function getDamageFoodCandidates(
  ctx: GcdOptimizationContext,
  damageStats: G.Stat[],
): (G.Food | undefined)[] {
  const foods: (G.Food | undefined)[] = [undefined, ...ctx.foods];
  foods.sort((a, b) => (a?.id ?? 0) - (b?.id ?? 0));
  return foods.filter((food, foodIndex) => !foods.some((candidate, candidateIndex) => {
    if (candidateIndex === foodIndex) return false;
    if (!damageStats.every(stat => isFoodStatAlwaysAtLeast(candidate, food, stat))) return false;
    return candidateIndex < foodIndex || damageStats.some(stat => !isSameFoodStat(candidate, food, stat));
  }));
}

function getConsumableStatBonus(value: number, consumable: G.Food | undefined, stat: G.Stat): number {
  if (consumable === undefined || !(stat in consumable.stats)) return 0;
  const maximum = consumable.stats[stat] ?? 0;
  return stat in consumable.statRates
    ? Math.min(maximum, floor(value * consumable.statRates[stat]! / 100))
    : maximum;
}

function getExactFinalStatValue(
  ctx: GcdOptimizationContext,
  value: number,
  stat: G.Stat,
  food: G.Food | undefined,
): number {
  let finalValue = value + getConsumableStatBonus(value, food, stat);
  for (const fixedConsumable of ctx.fixedConsumables) {
    finalValue += getConsumableStatBonus(value, fixedConsumable, stat);
  }
  return finalValue;
}

function createExactDamageModel(
  ctx: GcdOptimizationContext,
  relevantStats: G.Stat[],
  slotStates: GcdSlotStateSet[],
  speedStat: G.Stat,
): GcdExactDamageModel | undefined {
  // The exact solver requires damage to factor into positive, per-stat terms. BLU's weapon correction and
  // missing base dimensions violate that model, so those inputs deliberately stay on the generic frontier path.
  const { mainStat, statModifiers, traitDamageMultiplier } = ctx.schema;
  const attackMainStat = getAttackMainStat(ctx.schema);
  if (
    ctx.job === 'BLU' ||
    mainStat === undefined ||
    attackMainStat === undefined ||
    statModifiers === undefined ||
    traitDamageMultiplier === undefined
  ) return;
  const weaponStat: G.Stat = mainStat === 'MND' || mainStat === 'INT' ? 'MDMG' : 'PDMG';
  const supportedStats = new Set<G.Stat>([attackMainStat, weaponStat, 'CRT', 'DET', 'DHT', 'TEN']);
  const damageStats = relevantStats.filter(stat => stat !== speedStat);
  const attackStatModifier = statModifiers[attackMainStat as 'STR' | 'DEX' | 'INT' | 'MND' | 'VIT'];
  if (
    damageStats.some(stat => !supportedStats.has(stat) || ctx.baseStats[stat] === undefined) ||
    attackStatModifier === undefined
  ) return;

  const level = G.jobLevelModifiers[ctx.jobLevel];
  const { main, sub, div, det, detTrunc } = level;
  const attackPowerModifier = mainStat === 'VIT' ? level.apTank : level.ap;
  const weaponDamageBase = floor(main * attackStatModifier / 1000);
  const factor = (stat: G.Stat, value: number): number => {
    if (stat === attackMainStat) {
      return floor(attackPowerModifier *
        (floor(value * (ctx.schema.partyBonus ?? 1.05)) - main) / main + 100) / 100;
    }
    if (stat === weaponStat) return weaponDamageBase + value;
    if (stat === 'CRT') {
      const chance = floor(200 * (value - sub) / div + 50) / 1000;
      const amount = floor(200 * (value - sub) / div + 1400) / 1000;
      return (amount - 1) * chance + 1;
    }
    if (stat === 'DET') {
      return floor((140 * (value - main) / det + 1000) / detTrunc) * detTrunc / 1000;
    }
    if (stat === 'DHT') return 0.25 * floor(550 * (value - sub) / div) / 1000 + 1;
    if (stat === 'TEN') return floor(112 * (value - sub) / div + 1000) / 1000;
    return NaN;
  };
  const logFactor = (stat: G.Stat, value: number): number => Math.log(factor(stat, value));
  const lowerBounds = damageStats.map(stat => (ctx.baseStats[stat] ?? 0) +
    slotStates.reduce((total, slot) => total +
      Math.min(...slot.states.map(state => state.stats[stat] ?? 0)), 0));
  const upperBounds = damageStats.map(stat => (ctx.baseStats[stat] ?? 0) +
    slotStates.reduce((total, slot) => total +
      Math.max(...slot.states.map(state => state.stats[stat] ?? 0)), 0));
  if (lowerBounds.some((value, index) =>
    !Number.isInteger(value) ||
    !Number.isInteger(upperBounds[index]) ||
    upperBounds[index] - value > 20000 ||
    !Number.isFinite(logFactor(damageStats[index], value)) ||
    !Number.isFinite(logFactor(damageStats[index], upperBounds[index])))) return;
  for (let index = 0; index < damageStats.length; index++) {
    const stat = damageStats[index];
    const foodMaximum = Math.max(0, ...ctx.foods.map(food => food.stats[stat] ?? 0));
    const fixedMaximum = ctx.fixedConsumables.reduce((total, food) => total + (food.stats[stat] ?? 0), 0);
    const finalUpperBound = upperBounds[index] + foodMaximum + fixedMaximum;
    let previous = factor(stat, lowerBounds[index]);
    for (let value = lowerBounds[index] + 1; value <= finalUpperBound; value++) {
      const next = factor(stat, value);
      if (!Number.isFinite(next) || next < previous) return;
      previous = next;
    }
  }
  return {
    attackMainStat,
    weaponStat,
    damageStats,
    damageIndexes: damageStats.map(stat => relevantStats.indexOf(stat)),
    foods: getDamageFoodCandidates(ctx, damageStats),
    lowerBounds,
    upperBounds,
    damageMultiplier: traitDamageMultiplier,
    logConstant: Math.log(0.01 * traitDamageMultiplier),
    factor,
    logFactor,
  };
}

function getMaximumExactModelDamage(
  ctx: GcdOptimizationContext,
  model: GcdExactDamageModel,
  values: number[],
): number {
  let maximum = -Infinity;
  for (const food of model.foods) {
    maximum = Math.max(maximum, getExactModelDamage(ctx, model, values, food));
  }
  return maximum;
}

function getExactModelDamage(
  ctx: GcdOptimizationContext,
  model: GcdExactDamageModel,
  values: number[],
  food: G.Food | undefined,
): number {
  let attackMain = 1;
  let weapon = 1;
  let criticalHit = 1;
  let determination = 1;
  let directHit = 1;
  let tenacity = 1;
  for (let index = 0; index < model.damageStats.length; index++) {
    const stat = model.damageStats[index];
    const value = values[model.damageIndexes[index]];
    const factor = model.factor(stat, getExactFinalStatValue(ctx, value, stat, food));
    if (stat === model.attackMainStat) attackMain = factor;
    else if (stat === model.weaponStat) weapon = factor;
    else if (stat === 'CRT') criticalHit = factor;
    else if (stat === 'DET') determination = factor;
    else if (stat === 'DHT') directHit = factor;
    else if (stat === 'TEN') tenacity = factor;
  }
  return 0.01 * weapon * attackMain * determination * tenacity * model.damageMultiplier *
    criticalHit * directHit;
}

function addStatValues(a: number[], b: number[]): number[] {
  return a.map((value, index) => value + b[index]);
}

function subtractStatValues(a: number[], b: number[]): number[] {
  return a.map((value, index) => value - b[index]);
}

function getExactCombinedStats(ctx: GcdOptimizationContext, choices: GcdExactChoice[]): G.Stats {
  let stats = ctx.baseStats;
  for (const choice of choices) stats = addStats(stats, choice.state.stats);
  return stats;
}

function getExactChoicesProgressionCosts(choices: GcdExactChoice[]): Required<ProgressionCostState> {
  return choices.reduce((costs, choice) => ({
    tomestoneCost: costs.tomestoneCost + getTomestoneCost(choice.state),
    raidCost: costs.raidCost + getRaidCost(choice.state),
  }), { tomestoneCost: 0, raidCost: 0 });
}

function areExactChoicesWithinProgressionBudget(
  ctx: GcdOptimizationContext,
  choices: GcdExactChoice[],
): boolean {
  return isWithinProgressionBudget(ctx, getExactChoicesProgressionCosts(choices));
}

function selectExactChoicesWithinProgressionBudget(
  ctx: GcdOptimizationContext,
  slots: GcdExactSlot[],
  getScore: (choice: GcdExactChoice) => number,
): GcdExactChoice[] | undefined {
  if (ctx.progressionWeeks === undefined) {
    return slots.map(slot => slot.choices.reduce((best, choice) =>
      getScore(choice) > getScore(best) ? choice : best));
  }
  interface SelectionState extends Required<ProgressionCostState> {
    score: number,
    choices: GcdExactChoice[],
  }
  let selections = new Map<string, SelectionState>();
  selections.set('0,0', { tomestoneCost: 0, raidCost: 0, score: 0, choices: [] });
  for (const slot of slots) {
    const bestChoicesByCost = new Map<string, { choice: GcdExactChoice, score: number }>();
    for (const choice of slot.choices) {
      const key = `${getTomestoneCost(choice.state)},${getRaidCost(choice.state)}`;
      const score = getScore(choice);
      const existing = bestChoicesByCost.get(key);
      if (existing === undefined || score > existing.score) {
        bestChoicesByCost.set(key, { choice, score });
      }
    }
    const next = new Map<string, SelectionState>();
    for (const selection of selections.values()) {
      for (const option of bestChoicesByCost.values()) {
        const tomestoneCost = selection.tomestoneCost + getTomestoneCost(option.choice.state);
        const raidCost = selection.raidCost + getRaidCost(option.choice.state);
        if (!isWithinProgressionBudget(ctx, { tomestoneCost, raidCost })) continue;
        const key = `${tomestoneCost},${raidCost}`;
        const score = selection.score + option.score;
        const existing = next.get(key);
        if (existing === undefined || score > existing.score) {
          next.set(key, {
            tomestoneCost,
            raidCost,
            score,
            choices: selection.choices.concat(option.choice),
          });
        }
      }
    }
    selections = next;
    if (selections.size === 0) return;
  }
  return Array.from(selections.values()).reduce((best, selection) =>
    selection.score > best.score ? selection : best).choices;
}

function getExactDamageBaseWeights(model: GcdExactDamageModel): number[] {
  return model.damageStats.map((stat, index) => {
    const low = model.lowerBounds[index];
    const high = model.upperBounds[index];
    return high === low ? 0 : Math.max(1e-12,
      (model.logFactor(stat, high) - model.logFactor(stat, low)) / (high - low));
  });
}

function findExactDamageIncumbent(
  ctx: GcdOptimizationContext,
  model: GcdExactDamageModel,
  slots: GcdExactSlot[],
  relevantStats: G.Stat[],
): { damage: number, baseWeights: number[] } | undefined {
  const baseValues = relevantStats.map(stat => ctx.baseStats[stat] ?? 0);
  const baseWeights = getExactDamageBaseWeights(model);
  let bestDamage = -Infinity;
  let seed = 0x12345678;
  const random = () => {
    seed = (Math.imul(1664525, seed) + 1013904223) >>> 0;
    return seed / 0x100000000;
  };
  for (let attempt = 0; attempt < 40; attempt++) {
    const weights = baseWeights.map(weight => weight * Math.exp((random() - 0.5) * (attempt === 0 ? 0 : 3)));
    const selected = selectExactChoicesWithinProgressionBudget(ctx, slots, choice =>
      model.damageIndexes.reduce((score, statIndex, index) =>
        score + weights[index] * choice.values[statIndex], 0));
    if (selected === undefined) continue;
    let values = selected.reduce((total, choice) => addStatValues(total, choice.values), baseValues);
    let progressionCosts = getExactChoicesProgressionCosts(selected);
    for (let round = 0; round < 3; round++) {
      let changed = false;
      for (let slotIndex = 0; slotIndex < slots.length; slotIndex++) {
        const without = subtractStatValues(values, selected[slotIndex].values);
        let localChoice = selected[slotIndex];
        let localValues = values;
        let localDamage = getMaximumExactModelDamage(ctx, model, values);
        for (const choice of slots[slotIndex].choices) {
          const candidateProgressionCosts = {
            tomestoneCost: progressionCosts.tomestoneCost - getTomestoneCost(selected[slotIndex].state) +
              getTomestoneCost(choice.state),
            raidCost: progressionCosts.raidCost - getRaidCost(selected[slotIndex].state) +
              getRaidCost(choice.state),
          };
          if (!isWithinProgressionBudget(ctx, candidateProgressionCosts)) continue;
          const candidateValues = addStatValues(without, choice.values);
          const damage = getMaximumExactModelDamage(ctx, model, candidateValues);
          if (damage > localDamage) {
            localChoice = choice;
            localValues = candidateValues;
            localDamage = damage;
          }
        }
        changed ||= localChoice !== selected[slotIndex];
        progressionCosts = {
          tomestoneCost: progressionCosts.tomestoneCost - getTomestoneCost(selected[slotIndex].state) +
            getTomestoneCost(localChoice.state),
          raidCost: progressionCosts.raidCost - getRaidCost(selected[slotIndex].state) +
            getRaidCost(localChoice.state),
        };
        selected[slotIndex] = localChoice;
        values = localValues;
      }
      if (!changed) break;
    }

    if (!areExactChoicesWithinProgressionBudget(ctx, selected)) continue;
    const combined: GcdCombinedState = { stats: getExactCombinedStats(ctx, selected), changeCost: 0 };
    for (const food of model.foods) {
      const finalStats = getFinalStats(ctx, combined, food);
      const effects = calcEffects(finalStats, ctx.baseStats, ctx.job, ctx.jobLevel, ctx.schema);
      if (effects === undefined) continue;
      const modelDamage = getExactModelDamage(ctx, model, values, food);
      if (Math.abs(modelDamage - effects.damage) > 1e-12 * Math.max(1, effects.damage)) return;
      bestDamage = Math.max(bestDamage, effects.damage);
    }
  }
  return Number.isFinite(bestDamage) || ctx.progressionWeeks !== undefined
    ? { damage: bestDamage, baseWeights }
    : undefined;
}

function createDamageDual(
  ctx: GcdOptimizationContext,
  model: GcdExactDamageModel,
  slots: GcdExactSlot[],
  baseValues: number[],
  weights: number[],
): GcdDamageDual {
  let intercept = -Infinity;
  for (const food of model.foods) {
    let value = model.logConstant;
    for (let index = 0; index < model.damageStats.length; index++) {
      let maximum = -Infinity;
      for (let statValue = model.lowerBounds[index]; statValue <= model.upperBounds[index]; statValue++) {
        const finalValue = getExactFinalStatValue(ctx, statValue, model.damageStats[index], food);
        maximum = Math.max(maximum, model.logFactor(model.damageStats[index], finalValue) -
          weights[index] * statValue);
      }
      value += maximum;
    }
    intercept = Math.max(intercept, value);
  }
  const slotMaximums = slots.map(slot => Math.max(...slot.choices.map(choice =>
    model.damageIndexes.reduce((score, statIndex, index) =>
      score + weights[index] * choice.values[statIndex], 0))));
  const root = intercept + slotMaximums.reduce((total, value) => total + value, 0) +
    model.damageIndexes.reduce((total, statIndex, index) =>
      total + weights[index] * baseValues[statIndex], 0);
  return { weights, intercept, slotMaximums, root };
}

function createDamageDuals(
  ctx: GcdOptimizationContext,
  model: GcdExactDamageModel,
  slots: GcdExactSlot[],
  baseValues: number[],
  baseWeights: number[],
): GcdDamageDual[] {
  // Tangent planes in log-damage space are global upper bounds. Several locally tuned planes make pruning
  // tighter without changing correctness: a state is removed only when every possible completion is worse.
  let best = createDamageDual(ctx, model, slots, baseValues, baseWeights);
  const candidates = [best];
  for (let round = 0; round < 4; round++) {
    for (let dimension = 0; dimension < model.damageStats.length; dimension++) {
      if (best.weights[dimension] === 0) continue;
      let low = Math.max(1e-12, best.weights[dimension] / 3);
      let high = best.weights[dimension] * 3;
      for (let iteration = 0; iteration < 14; iteration++) {
        const left = (2 * low + high) / 3;
        const right = (low + 2 * high) / 3;
        const leftWeights = best.weights.slice();
        const rightWeights = best.weights.slice();
        leftWeights[dimension] = left;
        rightWeights[dimension] = right;
        const leftDual = createDamageDual(ctx, model, slots, baseValues, leftWeights);
        const rightDual = createDamageDual(ctx, model, slots, baseValues, rightWeights);
        candidates.push(leftDual, rightDual);
        if (leftDual.root <= rightDual.root) high = right;
        else low = left;
      }
      const weights = best.weights.slice();
      weights[dimension] = (low + high) / 2;
      const candidate = createDamageDual(ctx, model, slots, baseValues, weights);
      candidates.push(candidate);
      if (candidate.root < best.root) best = candidate;
    }
  }
  return candidates.sort((a, b) => a.root - b.root).slice(0, 16);
}

function updateDamageDualSupports(
  duals: GcdDamageDual[],
  model: GcdExactDamageModel,
  slots: GcdExactSlot[],
  baseValues: number[],
): void {
  for (const dual of duals) {
    dual.slotMaximums = slots.map(slot => Math.max(...slot.choices.map(choice =>
      model.damageIndexes.reduce((score, statIndex, index) =>
        score + dual.weights[index] * choice.values[statIndex], 0))));
    dual.root = dual.intercept + dual.slotMaximums.reduce((total, value) => total + value, 0) +
      model.damageIndexes.reduce((total, statIndex, index) =>
        total + dual.weights[index] * baseValues[statIndex], 0);
  }
}

function filterExactSlotChoices(
  slots: GcdExactSlot[],
  model: GcdExactDamageModel,
  duals: GcdDamageDual[],
  bestDamage: number,
): void {
  const threshold = Math.log(Math.max(Number.MIN_VALUE, bestDamage - gcdOptimizationDamageTolerance));
  for (let slotIndex = 0; slotIndex < slots.length; slotIndex++) {
    slots[slotIndex].choices = slots[slotIndex].choices.filter(choice => {
      let upper = Infinity;
      for (const dual of duals) {
        const score = model.damageIndexes.reduce((total, statIndex, index) =>
          total + dual.weights[index] * choice.values[statIndex], 0);
        upper = Math.min(upper, dual.root - dual.slotMaximums[slotIndex] + score);
      }
      // Retain equality plus a floating-point tolerance; pruning a true optimum would make the DP inexact.
      return upper + gcdOptimizationBoundTolerance >= threshold;
    });
  }
}

function exactStateToCombinedState(ctx: GcdOptimizationContext, state: GcdExactState): GcdCombinedState {
  const choices: GcdGearState[] = [];
  for (let node = state.plan; node !== undefined; node = node.previous) choices.push(node.state);
  choices.reverse();
  let stats = ctx.baseStats;
  let plan: GcdPlanNode | undefined;
  for (const choice of choices) {
    stats = addStats(stats, choice.stats);
    plan = appendGearStatePlan(plan, choice);
  }
  return {
    stats,
    plan,
    changeCost: state.changeCost,
    tomestoneCost: getTomestoneCost(state),
    raidCost: getRaidCost(state),
  };
}

function evaluateExactGcdContenders(
  ctx: GcdOptimizationContext,
  speedStat: G.Stat,
  requiredSpeed: number,
  contenders: GcdCombinedState[],
  maximumDamage: number,
  customSkipped: boolean,
): GcdOptimizationResult {
  let best: {
    state: GcdCombinedState,
    effects: EquippedEffects,
    stats: G.Stats,
    food?: G.Food,
    changeCost: number,
  } | undefined;
  const foods = getFoodCandidates(ctx, speedStat);
  for (const state of contenders) {
    for (const food of foods) {
      const stats = getFinalStats(ctx, state, food);
      const effects = calcEffects(stats, ctx.baseStats, ctx.job, ctx.jobLevel, ctx.schema);
      if (
        effects === undefined ||
        effects.gcd > ctx.targetGcd ||
        !isSpeedWithinRange(ctx, stats[speedStat] ?? 0) ||
        effects.damage + gcdOptimizationDamageTolerance < maximumDamage
      ) continue;
      const changeCost = state.changeCost + getFoodChangeCost(ctx, food);
      if (best !== undefined) {
        const overflow = getSpeedOverflow(stats, speedStat, requiredSpeed);
        const bestOverflow = getSpeedOverflow(best.stats, speedStat, requiredSpeed);
        if (overflow > bestOverflow) continue;
        if (overflow === bestOverflow && changeCost > best.changeCost) continue;
        if (
          overflow === bestOverflow &&
          changeCost === best.changeCost &&
          (food?.id ?? 0) >= (best.food?.id ?? 0)
        ) continue;
      }
      best = { state, effects, stats, food, changeCost };
    }
  }
  if (best === undefined) return { status: 'error', message: '没有可用于计算的装备状态。' };
  return {
    mode: ctx.mode,
    targetGcd: ctx.targetGcd,
    speedStat,
    requiredSpeed,
    speedRange: ctx.speedRange,
    customSkipped,
    status: 'ok',
    stats: best.stats,
    effects: best.effects,
    foodId: best.food?.id,
    foodName: best.food?.name ?? '不吃食物',
    speed: best.stats[speedStat] ?? 0,
    damageDelta: best.effects.damage - ctx.currentDamage,
    plan: materializePlan(ctx, best.state.plan),
  };
}

function optimizeAllGearExactly(
  ctx: GcdOptimizationContext,
  speedStat: G.Stat,
  requiredSpeed: number,
  relevantStats: G.Stat[],
  slotStateSets: GcdSlotStateSet[],
  customSkipped: boolean,
): GcdOptimizationResult | undefined {
  const model = createExactDamageModel(ctx, relevantStats, slotStateSets, speedStat);
  if (model === undefined) return;
  const baseValues = relevantStats.map(stat => ctx.baseStats[stat] ?? 0);
  const speedIndex = relevantStats.indexOf(speedStat);
  const slots: GcdExactSlot[] = slotStateSets.map(slot => ({
    schemaIndex: slot.schemaIndex,
    choices: slot.states.map(state => ({
      state,
      values: relevantStats.map(stat => state.stats[stat] ?? 0),
    })),
  }));
  const incumbent = findExactDamageIncumbent(ctx, model, slots, relevantStats);
  if (incumbent === undefined) return;
  const duals = createDamageDuals(ctx, model, slots, baseValues, incumbent.baseWeights);
  filterExactSlotChoices(slots, model, duals, incumbent.damage);
  if (slots.some(slot => slot.choices.length === 0)) return;

  // Exact-key DP grows monotonically. Process large choice sets first so the small sets multiply the already
  // deduplicated frontier; each key contains every damage dimension and both progression resources.
  slots.sort((a, b) => b.choices.length - a.choices.length || a.schemaIndex - b.schemaIndex);
  updateDamageDualSupports(duals, model, slots, baseValues);
  filterExactSlotChoices(slots, model, duals, incumbent.damage);
  if (slots.some(slot => slot.choices.length === 0)) return;
  updateDamageDualSupports(duals, model, slots, baseValues);

  const suffixes = duals.map(dual => {
    const suffix = Array.from({ length: slots.length + 1 }, () => 0);
    for (let depth = slots.length - 1; depth >= 0; depth--) {
      suffix[depth] = suffix[depth + 1] + dual.slotMaximums[depth];
    }
    return suffix;
  });
  for (const slot of slots) {
    for (const choice of slot.choices) {
      choice.dualScores = duals.map(dual => model.damageIndexes.reduce((total, statIndex, index) =>
        total + dual.weights[index] * choice.values[statIndex], 0));
    }
  }
  const threshold = Math.log(Math.max(Number.MIN_VALUE, incumbent.damage - gcdOptimizationDamageTolerance));
  let frontier: GcdExactState[] = [{
    values: baseValues,
    dualScores: duals.map(dual => model.damageIndexes.reduce((total, statIndex, index) =>
      total + dual.weights[index] * baseValues[statIndex], 0)),
    changeCost: 0,
    tomestoneCost: 0,
    raidCost: 0,
  }];
  for (let depth = 0; depth < slots.length; depth++) {
    const next = new Map<string, GcdExactState>();
    for (const partial of frontier) {
      for (const choice of slots[depth].choices) {
        const dualScores = partial.dualScores.map((score, index) => score + choice.dualScores![index]);
        let upper = Infinity;
        for (let index = 0; index < duals.length; index++) {
          upper = Math.min(upper, duals[index].intercept + suffixes[index][depth + 1] + dualScores[index]);
        }
        if (upper + gcdOptimizationBoundTolerance < threshold) continue;
        const values = addStatValues(partial.values, choice.values);
        const tomestoneCost = getTomestoneCost(partial) + getTomestoneCost(choice.state);
        const raidCost = getRaidCost(partial) + getRaidCost(choice.state);
        if (!isWithinProgressionBudget(ctx, { tomestoneCost, raidCost })) continue;
        const key = `${model.damageIndexes.map(index => values[index]).join(',')};` +
          `${tomestoneCost},${raidCost}`;
        const changeCost = partial.changeCost + choice.state.changeCost;
        const existing = next.get(key);
        if (
          existing === undefined ||
          values[speedIndex] < existing.values[speedIndex] ||
          values[speedIndex] === existing.values[speedIndex] && changeCost < existing.changeCost
        ) {
          next.set(key, {
            values,
            dualScores,
            changeCost,
            tomestoneCost,
            raidCost,
            plan: { previous: partial.plan, state: choice.state },
          });
          if (next.size > gcdOptimizationExactStateLimit) {
            throw new ParetoFrontierLimitError('计算范围过大，请缩小品级范围。');
          }
        }
      }
    }
    frontier = Array.from(next.values());
  }

  const damages = new Float64Array(frontier.length);
  let maximumDamage = incumbent.damage;
  for (let index = 0; index < frontier.length; index++) {
    const damage = getMaximumExactModelDamage(ctx, model, frontier[index].values);
    damages[index] = damage;
    maximumDamage = Math.max(maximumDamage, damage);
  }
  const contenders: GcdCombinedState[] = [];
  for (let index = 0; index < frontier.length; index++) {
    if (damages[index] + gcdOptimizationDamageTolerance < maximumDamage) continue;
    contenders.push(exactStateToCombinedState(ctx, frontier[index]));
  }
  return evaluateExactGcdContenders(
    ctx,
    speedStat,
    requiredSpeed,
    contenders,
    maximumDamage,
    customSkipped,
  );
}

function getRequiredExactBaseSpeed(
  ctx: GcdOptimizationContext,
  speedStat: G.Stat,
  requiredSpeed: number,
  food: G.Food | undefined,
): number {
  let low = 0;
  let high = requiredSpeed;
  while (low < high) {
    const middle = floor((low + high) / 2);
    if (getExactFinalStatValue(ctx, middle, speedStat, food) >= requiredSpeed) high = middle;
    else low = middle + 1;
  }
  return low;
}

function getMaximumExactBaseSpeed(
  ctx: GcdOptimizationContext,
  speedStat: G.Stat,
  maximumSpeed: number,
  food: G.Food | undefined,
): number {
  if (getExactFinalStatValue(ctx, 0, speedStat, food) > maximumSpeed) return -1;
  let low = 0;
  let high = maximumSpeed;
  while (low < high) {
    const middle = low + floor((high - low + 1) / 2);
    if (getExactFinalStatValue(ctx, middle, speedStat, food) <= maximumSpeed) low = middle;
    else high = middle - 1;
  }
  return low;
}

function getConstrainedChoiceScore(
  choice: GcdExactChoice,
  model: GcdExactDamageModel,
  weights: number[],
  speedIndex: number,
  speedWeight: number,
): number {
  return model.damageIndexes.reduce((score, statIndex, index) =>
    score + weights[index] * choice.values[statIndex], speedWeight * choice.values[speedIndex]);
}

function getConstrainedDualIntercept(
  ctx: GcdOptimizationContext,
  model: GcdExactDamageModel,
  weights: number[],
  food: G.Food | undefined,
): number {
  let intercept = model.logConstant;
  for (let index = 0; index < model.damageStats.length; index++) {
    let maximum = -Infinity;
    for (let value = model.lowerBounds[index]; value <= model.upperBounds[index]; value++) {
      const finalValue = getExactFinalStatValue(ctx, value, model.damageStats[index], food);
      maximum = Math.max(maximum, model.logFactor(model.damageStats[index], finalValue) -
        weights[index] * value);
    }
    intercept += maximum;
  }
  return intercept;
}

function createConstrainedDamageDual(
  model: GcdExactDamageModel,
  slots: GcdExactSlot[],
  baseValues: number[],
  speedIndex: number,
  requiredBaseSpeed: number,
  weights: number[],
  intercept: number,
  speedWeight: number,
): GcdConstrainedDamageDual {
  const slotMaximums = slots.map(slot => Math.max(...slot.choices.map(choice =>
    getConstrainedChoiceScore(choice, model, weights, speedIndex, speedWeight))));
  const baseScore = model.damageIndexes.reduce((score, statIndex, index) =>
    score + weights[index] * baseValues[statIndex], speedWeight * baseValues[speedIndex]);
  return {
    weights,
    intercept,
    speedWeight,
    slotMaximums,
    root: intercept - speedWeight * requiredBaseSpeed + baseScore +
      slotMaximums.reduce((total, value) => total + value, 0),
  };
}

function createConstrainedDamageDuals(
  ctx: GcdOptimizationContext,
  model: GcdExactDamageModel,
  slots: GcdExactSlot[],
  baseValues: number[],
  speedIndex: number,
  requiredBaseSpeed: number,
  food: G.Food | undefined,
  weightCandidates: number[][],
): GcdConstrainedDamageDual[] {
  const duals: GcdConstrainedDamageDual[] = [];
  for (const weights of weightCandidates) {
    const intercept = getConstrainedDualIntercept(ctx, model, weights, food);
    const evaluate = (speedWeight: number) => createConstrainedDamageDual(
      model,
      slots,
      baseValues,
      speedIndex,
      requiredBaseSpeed,
      weights,
      intercept,
      speedWeight,
    );
    let low = 0;
    let high = Math.max(1e-10, ...weights) * 4;
    let best = evaluate(0);
    let highDual = evaluate(high);
    while (highDual.root < best.root && high < 1) {
      best = highDual;
      high *= 2;
      highDual = evaluate(high);
    }
    if (highDual.root < best.root) best = highDual;
    for (let iteration = 0; iteration < 24; iteration++) {
      const left = (2 * low + high) / 3;
      const right = (low + 2 * high) / 3;
      const leftDual = evaluate(left);
      const rightDual = evaluate(right);
      if (leftDual.root < best.root) best = leftDual;
      if (rightDual.root < best.root) best = rightDual;
      if (leftDual.root <= rightDual.root) high = right;
      else low = left;
    }
    duals.push(best);
  }
  return duals.sort((a, b) => a.root - b.root).slice(0, 16);
}

function updateConstrainedDamageDualSupports(
  duals: GcdConstrainedDamageDual[],
  model: GcdExactDamageModel,
  slots: GcdExactSlot[],
  baseValues: number[],
  speedIndex: number,
  requiredBaseSpeed: number,
): void {
  for (const dual of duals) {
    dual.slotMaximums = slots.map(slot => Math.max(...slot.choices.map(choice =>
      getConstrainedChoiceScore(choice, model, dual.weights, speedIndex, dual.speedWeight))));
    const baseScore = model.damageIndexes.reduce((score, statIndex, index) =>
      score + dual.weights[index] * baseValues[statIndex], dual.speedWeight * baseValues[speedIndex]);
    dual.root = dual.intercept - dual.speedWeight * requiredBaseSpeed + baseScore +
      dual.slotMaximums.reduce((total, value) => total + value, 0);
  }
}

function filterConstrainedExactSlotChoices(
  slots: GcdExactSlot[],
  model: GcdExactDamageModel,
  duals: GcdConstrainedDamageDual[],
  speedIndex: number,
  bestDamage: number,
): void {
  const threshold = Math.log(Math.max(Number.MIN_VALUE, bestDamage - gcdOptimizationDamageTolerance));
  for (let slotIndex = 0; slotIndex < slots.length; slotIndex++) {
    slots[slotIndex].choices = slots[slotIndex].choices.filter(choice => {
      let upper = Infinity;
      for (const dual of duals) {
        const score = getConstrainedChoiceScore(
          choice,
          model,
          dual.weights,
          speedIndex,
          dual.speedWeight,
        );
        upper = Math.min(upper, dual.root - dual.slotMaximums[slotIndex] + score);
      }
      return upper + gcdOptimizationBoundTolerance >= threshold;
    });
  }
}

function improveConstrainedExactChoices(
  ctx: GcdOptimizationContext,
  model: GcdExactDamageModel,
  slots: GcdExactSlot[],
  selected: GcdExactChoice[],
  baseValues: number[],
  speedIndex: number,
  requiredBaseSpeed: number,
  food: G.Food | undefined,
): { choices: GcdExactChoice[], values: number[], damage: number } | undefined {
  const choices = selected.slice();
  let values = choices.reduce((total, choice) => addStatValues(total, choice.values), baseValues);
  let progressionCosts = getExactChoicesProgressionCosts(choices);
  if (!isWithinProgressionBudget(ctx, progressionCosts)) return;
  if (values[speedIndex] < requiredBaseSpeed) return;
  for (let round = 0; round < 3; round++) {
    let changed = false;
    for (let slotIndex = 0; slotIndex < slots.length; slotIndex++) {
      const without = subtractStatValues(values, choices[slotIndex].values);
      let bestChoice = choices[slotIndex];
      let bestValues = values;
      let bestDamage = getExactModelDamage(ctx, model, values, food);
      for (const choice of slots[slotIndex].choices) {
        const candidateProgressionCosts = {
          tomestoneCost: progressionCosts.tomestoneCost - getTomestoneCost(choices[slotIndex].state) +
            getTomestoneCost(choice.state),
          raidCost: progressionCosts.raidCost - getRaidCost(choices[slotIndex].state) +
            getRaidCost(choice.state),
        };
        if (!isWithinProgressionBudget(ctx, candidateProgressionCosts)) continue;
        const candidateValues = addStatValues(without, choice.values);
        if (candidateValues[speedIndex] < requiredBaseSpeed) continue;
        const damage = getExactModelDamage(ctx, model, candidateValues, food);
        if (damage > bestDamage) {
          bestChoice = choice;
          bestValues = candidateValues;
          bestDamage = damage;
        }
      }
      changed ||= bestChoice !== choices[slotIndex];
      progressionCosts = {
        tomestoneCost: progressionCosts.tomestoneCost - getTomestoneCost(choices[slotIndex].state) +
          getTomestoneCost(bestChoice.state),
        raidCost: progressionCosts.raidCost - getRaidCost(choices[slotIndex].state) +
          getRaidCost(bestChoice.state),
      };
      choices[slotIndex] = bestChoice;
      values = bestValues;
    }
    if (!changed) break;
  }
  return { choices, values, damage: getExactModelDamage(ctx, model, values, food) };
}

function findConstrainedExactIncumbent(
  ctx: GcdOptimizationContext,
  model: GcdExactDamageModel,
  slots: GcdExactSlot[],
  baseValues: number[],
  speedIndex: number,
  requiredBaseSpeed: number,
  food: G.Food | undefined,
  baseWeights: number[],
): { choices: GcdExactChoice[], values: number[], damage: number } | undefined {
  const maximumSpeedChoices = selectExactChoicesWithinProgressionBudget(
    ctx,
    slots,
    choice => choice.values[speedIndex],
  );
  if (maximumSpeedChoices === undefined) return;
  const maximumSpeed = maximumSpeedChoices.reduce((total, choice) => total + choice.values[speedIndex],
    baseValues[speedIndex]);
  if (maximumSpeed < requiredBaseSpeed) return;
  let best = improveConstrainedExactChoices(
    ctx,
    model,
    slots,
    maximumSpeedChoices,
    baseValues,
    speedIndex,
    requiredBaseSpeed,
    food,
  );
  if (best !== undefined && !areExactChoicesWithinProgressionBudget(ctx, best.choices)) best = undefined;
  let seed = 0x9e3779b9;
  const random = () => {
    seed = (Math.imul(1664525, seed) + 1013904223) >>> 0;
    return seed / 0x100000000;
  };
  for (let attempt = 0; attempt < 24; attempt++) {
    const weights = baseWeights.map(weight => weight * Math.exp((random() - 0.5) * (attempt === 0 ? 0 : 4)));
    let selected = selectExactChoicesWithinProgressionBudget(
      ctx,
      slots,
      choice => getConstrainedChoiceScore(choice, model, weights, speedIndex, 0),
    );
    if (selected === undefined) continue;
    let speed = selected.reduce((total, choice) => total + choice.values[speedIndex], baseValues[speedIndex]);
    if (speed < requiredBaseSpeed) {
      let low = 0;
      let high = Math.max(1e-10, ...weights);
      for (let iteration = 0; iteration < 60; iteration++) {
        selected = selectExactChoicesWithinProgressionBudget(
          ctx,
          slots,
          choice => getConstrainedChoiceScore(choice, model, weights, speedIndex, high),
        )!;
        speed = selected.reduce((total, choice) => total + choice.values[speedIndex], baseValues[speedIndex]);
        if (speed >= requiredBaseSpeed) break;
        high *= 2;
      }
      if (speed < requiredBaseSpeed) continue;
      for (let iteration = 0; iteration < 32; iteration++) {
        const middle = (low + high) / 2;
        const candidate = selectExactChoicesWithinProgressionBudget(
          ctx,
          slots,
          choice => getConstrainedChoiceScore(choice, model, weights, speedIndex, middle),
        )!;
        const candidateSpeed = candidate.reduce((total, choice) =>
          total + choice.values[speedIndex], baseValues[speedIndex]);
        if (candidateSpeed >= requiredBaseSpeed) {
          high = middle;
          selected = candidate;
        } else {
          low = middle;
        }
      }
    }
    const improved = improveConstrainedExactChoices(
      ctx,
      model,
      slots,
      selected,
      baseValues,
      speedIndex,
      requiredBaseSpeed,
      food,
    );
    if (
      improved !== undefined &&
      areExactChoicesWithinProgressionBudget(ctx, improved.choices) &&
      (best === undefined || improved.damage > best.damage)
    ) best = improved;
  }
  return best;
}

function exactChoicesToCombinedState(
  ctx: GcdOptimizationContext,
  choices: GcdExactChoice[],
): GcdCombinedState {
  let stats = ctx.baseStats;
  let plan: GcdPlanNode | undefined;
  let changeCost = 0;
  let tomestoneCost = 0;
  let raidCost = 0;
  for (const choice of choices) {
    stats = addStats(stats, choice.state.stats);
    changeCost += choice.state.changeCost;
    tomestoneCost += getTomestoneCost(choice.state);
    raidCost += getRaidCost(choice.state);
    plan = appendGearStatePlan(plan, choice.state);
  }
  return { stats, plan, changeCost, tomestoneCost, raidCost };
}

function searchConstrainedExactFood(
  ctx: GcdOptimizationContext,
  model: GcdExactDamageModel,
  originalSlots: GcdExactSlot[],
  baseValues: number[],
  speedIndex: number,
  requiredBaseSpeed: number,
  maximumBaseSpeed: number,
  food: G.Food | undefined,
  weightCandidates: number[][],
  getBestDamage: () => number,
  consider: (choices: GcdExactChoice[], food: G.Food | undefined) => void,
): void {
  const slots = originalSlots.map(slot => ({ ...slot, choices: slot.choices.slice() }));
  const duals = createConstrainedDamageDuals(
    ctx,
    model,
    slots,
    baseValues,
    speedIndex,
    requiredBaseSpeed,
    food,
    weightCandidates,
  );
  if (duals.length === 0 || Math.exp(duals[0].root) + gcdOptimizationDamageTolerance < getBestDamage()) return;
  filterConstrainedExactSlotChoices(slots, model, duals, speedIndex, getBestDamage());
  if (slots.some(slot => slot.choices.length === 0)) return;
  slots.sort((a, b) => a.choices.length - b.choices.length || a.schemaIndex - b.schemaIndex);
  updateConstrainedDamageDualSupports(duals, model, slots, baseValues, speedIndex, requiredBaseSpeed);
  filterConstrainedExactSlotChoices(slots, model, duals, speedIndex, getBestDamage());
  if (slots.some(slot => slot.choices.length === 0)) return;
  updateConstrainedDamageDualSupports(duals, model, slots, baseValues, speedIndex, requiredBaseSpeed);

  for (const slot of slots) {
    for (const choice of slot.choices) {
      choice.dualScores = duals.map(dual => model.damageIndexes.reduce((score, statIndex, index) =>
        score + dual.weights[index] * choice.values[statIndex], 0));
    }
    slot.choices.sort((a, b) => b.dualScores![0] - a.dualScores![0]);
  }
  const requiredGearSpeed = Math.max(0, requiredBaseSpeed - baseValues[speedIndex]);
  const dualSuffixes = duals.map((_, dualIndex) => {
    const exactSuffixes: Float64Array[] = Array.from({ length: slots.length + 1 }, () =>
      new Float64Array(requiredGearSpeed + 1).fill(-Infinity));
    const suffixes: Float64Array[] = Array.from({ length: slots.length + 1 }, () =>
      new Float64Array(requiredGearSpeed + 1).fill(-Infinity));
    exactSuffixes[slots.length][0] = 0;
    suffixes[slots.length][0] = 0;
    for (let depth = slots.length - 1; depth >= 0; depth--) {
      const exact = new Float64Array(requiredGearSpeed + 1).fill(-Infinity);
      for (const choice of slots[depth].choices) {
        const choiceSpeed = choice.values[speedIndex];
        const choiceScore = choice.dualScores![dualIndex];
        for (let suffixSpeed = 0; suffixSpeed <= requiredGearSpeed; suffixSpeed++) {
          const suffixScore = exactSuffixes[depth + 1][suffixSpeed];
          if (suffixScore === -Infinity) continue;
          const speed = Math.min(requiredGearSpeed, choiceSpeed + suffixSpeed);
          exact[speed] = Math.max(exact[speed], choiceScore + suffixScore);
        }
      }
      exactSuffixes[depth] = exact;
      let maximum = -Infinity;
      for (let speed = requiredGearSpeed; speed >= 0; speed--) {
        maximum = Math.max(maximum, exact[speed]);
        suffixes[depth][speed] = maximum;
      }
    }
    return suffixes;
  });
  const speedSuffix = Array.from({ length: slots.length + 1 }, () => 0);
  for (let depth = slots.length - 1; depth >= 0; depth--) {
    speedSuffix[depth] = speedSuffix[depth + 1] + Math.max(...slots[depth].choices.map(choice =>
      choice.values[speedIndex]));
  }
  const values = baseValues.slice();
  const dualScores = duals.map(dual => model.damageIndexes.reduce((score, statIndex, index) =>
    score + dual.weights[index] * baseValues[statIndex], 0));
  const selected: GcdExactChoice[] = [];
  const seen = Array.from({ length: slots.length + 1 }, () => new Map<string, { speed: number, cost: number }>());
  const visit = (
    depth: number,
    changeCost: number,
    tomestoneCost: number,
    raidCost: number,
  ): void => {
    if (depth === slots.length) {
      if (values[speedIndex] >= requiredBaseSpeed && values[speedIndex] <= maximumBaseSpeed) {
        consider(selected, food);
      }
      return;
    }
    for (const choice of slots[depth].choices) {
      const nextTomestoneCost = tomestoneCost + getTomestoneCost(choice.state);
      const nextRaidCost = raidCost + getRaidCost(choice.state);
      if (!isWithinProgressionBudget(ctx, {
        tomestoneCost: nextTomestoneCost,
        raidCost: nextRaidCost,
      })) continue;
      const nextSpeed = values[speedIndex] + choice.values[speedIndex];
      if (nextSpeed > maximumBaseSpeed) continue;
      if (nextSpeed + speedSuffix[depth + 1] < requiredBaseSpeed) continue;
      let upper = Infinity;
      const neededSpeed = Math.max(0, requiredBaseSpeed - nextSpeed);
      for (let index = 0; index < duals.length; index++) {
        upper = Math.min(upper, duals[index].intercept + dualScores[index] + choice.dualScores![index] +
          dualSuffixes[index][depth + 1][neededSpeed]);
      }
      const threshold = Math.log(Math.max(Number.MIN_VALUE,
        getBestDamage() - gcdOptimizationDamageTolerance));
      if (upper + gcdOptimizationBoundTolerance < threshold) continue;
      for (let index = 0; index < values.length; index++) values[index] += choice.values[index];
      for (let index = 0; index < dualScores.length; index++) dualScores[index] += choice.dualScores![index];
      const nextCost = changeCost + choice.state.changeCost;
      const speedKey = Math.min(values[speedIndex], requiredBaseSpeed);
      const key = `${model.damageIndexes.map(index => values[index]).join(',')},${speedKey};` +
        `${nextTomestoneCost},${nextRaidCost}`;
      const existing = seen[depth + 1].get(key);
      if (
        existing === undefined ||
        values[speedIndex] < existing.speed ||
        values[speedIndex] === existing.speed && nextCost < existing.cost
      ) {
        seen[depth + 1].set(key, { speed: values[speedIndex], cost: nextCost });
        selected.push(choice);
        visit(depth + 1, nextCost, nextTomestoneCost, nextRaidCost);
        selected.pop();
      }
      for (let index = 0; index < dualScores.length; index++) dualScores[index] -= choice.dualScores![index];
      for (let index = 0; index < values.length; index++) values[index] -= choice.values[index];
    }
  };
  visit(0, 0, 0, 0);
}

function optimizeAllGearExactlyWithSpeed(
  ctx: GcdOptimizationContext,
  speedStat: G.Stat,
  requiredSpeed: number,
  relevantStats: G.Stat[],
  slotStateSets: GcdSlotStateSet[],
  customSkipped: boolean,
): GcdOptimizationResult | undefined {
  const model = createExactDamageModel(ctx, relevantStats, slotStateSets, speedStat);
  if (model === undefined) return;
  const baseValues = relevantStats.map(stat => ctx.baseStats[stat] ?? 0);
  const speedIndex = relevantStats.indexOf(speedStat);
  const slots: GcdExactSlot[] = slotStateSets.map(slot => ({
    schemaIndex: slot.schemaIndex,
    choices: slot.states.map(state => ({
      state,
      values: relevantStats.map(stat => state.stats[stat] ?? 0),
    })),
  }));
  const baseWeights = getExactDamageBaseWeights(model);
  const genericDuals = createDamageDuals(ctx, model, slots, baseValues, baseWeights);
  const weightCandidates = genericDuals.map(dual => dual.weights);
  if (!weightCandidates.some(weights => weights.every((value, index) => value === baseWeights[index]))) {
    weightCandidates.push(baseWeights);
  }
  const availableMaximumBaseSpeed = baseValues[speedIndex] + slots.reduce((total, slot) => total +
    Math.max(...slot.choices.map(choice => choice.values[speedIndex])), 0);
  const foods = getFoodCandidates(ctx, speedStat).map(food => ({
    food,
    requiredBaseSpeed: getRequiredExactBaseSpeed(ctx, speedStat, requiredSpeed, food),
    maximumBaseSpeed: ctx.speedRange === undefined
      ? Infinity
      : getMaximumExactBaseSpeed(ctx, speedStat, ctx.speedRange.max, food),
    incumbentDamage: -Infinity,
  })).filter(search =>
    search.requiredBaseSpeed <= search.maximumBaseSpeed &&
    search.requiredBaseSpeed <= availableMaximumBaseSpeed &&
    baseValues[speedIndex] <= search.maximumBaseSpeed);
  if (foods.length === 0) return;

  let best: GcdExactBest | undefined;
  const consider = (choices: GcdExactChoice[], food: G.Food | undefined): void => {
    const combined = exactChoicesToCombinedState(ctx, choices);
    if (!isWithinProgressionBudget(ctx, combined)) return;
    const stats = getFinalStats(ctx, combined, food);
    const effects = calcEffects(stats, ctx.baseStats, ctx.job, ctx.jobLevel, ctx.schema);
    if (
      effects === undefined ||
      effects.gcd > ctx.targetGcd ||
      !isSpeedWithinRange(ctx, stats[speedStat] ?? 0)
    ) return;
    const changeCost = combined.changeCost + getFoodChangeCost(ctx, food);
    if (isBetterGcdOptimization(
      { effects, stats, changeCost, foodId: food?.id },
      best && {
        effects: best.effects,
        stats: best.stats,
        changeCost: best.changeCost,
        foodId: best.food?.id,
      },
      speedStat,
      requiredSpeed,
    )) {
      best = { choices: choices.slice(), effects, stats, food, changeCost };
    }
  };
  for (const search of foods) {
    const incumbent = findConstrainedExactIncumbent(
      ctx,
      model,
      slots,
      baseValues,
      speedIndex,
      search.requiredBaseSpeed,
      search.food,
      baseWeights,
    );
    if (incumbent === undefined) continue;
    search.incumbentDamage = incumbent.damage;
    consider(incumbent.choices, search.food);
  }
  if (best === undefined && ctx.progressionWeeks === undefined && ctx.speedRange === undefined) return;
  foods.sort((a, b) => b.incumbentDamage - a.incumbentDamage);
  for (const search of foods) {
    searchConstrainedExactFood(
      ctx,
      model,
      slots,
      baseValues,
      speedIndex,
      search.requiredBaseSpeed,
      search.maximumBaseSpeed,
      search.food,
      weightCandidates,
      () => best?.effects.damage ?? -Infinity,
      consider,
    );
  }
  if (best === undefined) return;
  const combined = exactChoicesToCombinedState(ctx, best.choices);
  return {
    mode: ctx.mode,
    targetGcd: ctx.targetGcd,
    speedStat,
    requiredSpeed,
    speedRange: ctx.speedRange,
    customSkipped,
    status: 'ok',
    stats: best.stats,
    effects: best.effects,
    foodId: best.food?.id,
    foodName: best.food?.name ?? '不吃食物',
    speed: best.stats[speedStat] ?? 0,
    damageDelta: best.effects.damage - ctx.currentDamage,
    plan: materializePlan(ctx, combined.plan),
  };
}

export function optimizeGcd(input: GcdOptimizationInput): GcdOptimizationResult {
  const schema = G.jobSchemas[input.job];
  const ctx: GcdOptimizationContext = {
    ...input,
    schema,
    gearById: new Map(input.gears.map(gear => [ gear.id, gear ])),
    equippedGearIdBySlot: new Map(input.equippedGearIdsBySlot),
  };
  if (
    ctx.progressionWeeks !== undefined &&
    (ctx.mode !== 'all' || !Number.isInteger(ctx.progressionWeeks) ||
      ctx.progressionWeeks < 0 || ctx.progressionWeeks > 10)
  ) {
    return { status: 'error', message: '准备周数目前仅支持 0–10 周。' };
  }
  if (
    !Number.isFinite(ctx.targetGcd) ||
    ctx.targetGcd < gcdOptimizationMinTargetGcd ||
    ctx.targetGcd > gcdOptimizationMaxTargetGcd
  ) {
    return { status: 'error', message: `目标 GCD 只能在 ${gcdOptimizationMinTargetGcd.toFixed(2)}s - ${gcdOptimizationMaxTargetGcd.toFixed(2)}s 之间。` };
  }
  if (
    ctx.speedRange !== undefined &&
    (!Number.isSafeInteger(ctx.speedRange.min) || !Number.isSafeInteger(ctx.speedRange.max) ||
      ctx.speedRange.min < 0 || ctx.speedRange.max < ctx.speedRange.min ||
      ctx.speedRange.max > gcdOptimizationMaxSpeed)
  ) {
    return {
      status: 'error',
      message: `速度属性范围必须是 0–${gcdOptimizationMaxSpeed} 内的整数，且最小值不能大于最大值。`,
    };
  }
  const speedStat = getSpeedStat(schema);
  if (schema.mainStat === undefined || speedStat === undefined) {
    return { status: 'error', message: '该职业不支持伤害期望配速优化。' };
  }
  const baseSpeed = ctx.baseStats[speedStat] ?? G.jobLevelModifiers[ctx.jobLevel].sub;
  if (ctx.speedRange !== undefined && ctx.speedRange.max < baseSpeed) {
    return {
      status: 'error',
      message: `${G.statNames[speedStat]}范围上限不能低于当前等级的基础值 ${baseSpeed}。`,
    };
  }
  const targetRequiredSpeed = calcRequiredSpeed(ctx.targetGcd, ctx.jobLevel, schema.statModifiers);
  if (targetRequiredSpeed === Infinity) {
    return { status: 'error', message: '目标 GCD 超出可计算范围。' };
  }
  if (ctx.speedRange !== undefined && targetRequiredSpeed > ctx.speedRange.max) {
    return {
      status: 'error',
      message: `目标 GCD 至少需要${G.statNames[speedStat]} ${targetRequiredSpeed}，超过了范围上限 ${ctx.speedRange.max}。`,
    };
  }
  const requiredSpeed = Math.max(targetRequiredSpeed, ctx.speedRange?.min ?? 0);
  const relevantStats = getRelevantStats(schema, speedStat);
  try {
    if (ctx.mode === 'current') {
      const { frontier, customSkipped } = createCurrentGearFrontier(ctx, speedStat, requiredSpeed, relevantStats);
      return evaluateGcdFrontier(ctx, speedStat, requiredSpeed, frontier, customSkipped);
    }

    const allGearStates = createAllGearStateSets(ctx, speedStat, requiredSpeed, relevantStats);
    if (allGearStates.error !== undefined) {
      return { status: 'error', message: allGearStates.error };
    }
    const runExactSearch = () => allGearStates.guaranteedBaseSpeed >= requiredSpeed && ctx.speedRange === undefined
      ? optimizeAllGearExactly(
        ctx,
        speedStat,
        requiredSpeed,
        relevantStats,
        allGearStates.slotStates,
        allGearStates.customSkipped,
      )
      : optimizeAllGearExactlyWithSpeed(
        ctx,
        speedStat,
        requiredSpeed,
        relevantStats,
        allGearStates.slotStates,
        allGearStates.customSkipped,
      );
    if (ctx.searchStrategy === 'exact') {
      return runExactSearch() ?? { status: 'error', message: '当前输入无法使用精确搜索。' };
    }
    try {
      const frontier = combineAllGearStateSets(
        ctx,
        allGearStates.slotStates,
        speedStat,
        requiredSpeed,
        relevantStats,
      );
      return evaluateGcdFrontier(ctx, speedStat, requiredSpeed, frontier, allGearStates.customSkipped);
    } catch (e) {
      if (e instanceof ParetoFrontierLimitError) {
        // Capacity is the only automatic fallback trigger. Exact search either proves the optimum or propagates
        // a range-too-large error; it never returns a heuristic approximation.
        const exactResult = runExactSearch();
        if (exactResult !== undefined) return exactResult;
      }
      throw e;
    }
  } catch (e) {
    return { status: 'error', message: e instanceof Error ? e.message : '计算失败。' };
  }
}
