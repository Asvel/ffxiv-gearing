import * as mobx from 'mobx';
import * as mst from 'mobx-state-tree';
import * as G from '../game';
import * as share from '../share';
import { floor, ceil, Setting, Promotion, GearUnion, GearUnionReference,
  gearData, gearDataOrdered, gearDataLoading, loadGearDataOfGearId, loadGearDataOfLevelRange } from '.';
import type { IGear, IFood, IGearUnion, IMateria } from '.';
import { cancelGcdOptimizationInWorker, optimizeGcdInWorker } from './gcdOptimizationWorkerClient';
import { optimizeGcd as optimizeGcdCore } from './gcdOptimizationCore';
import type { GcdOptimizationGearInput, GcdOptimizationInput } from './gcdOptimizationCore';
import { optimizeProductionMateria } from './productionMateriaOptimizationCore';
import type { ProductionMateriaOptimizationInput, ProductionMateriaOptimizationResult,
  ProductionMateriaStat } from './productionMateriaOptimizationCore';
import { cancelProductionMateriaOptimizationInWorker,
  optimizeProductionMateriaInWorker } from './productionMateriaOptimizationWorkerClient';

const clanStorageKey = 'ffxiv-gearing.dt.clan';
const tiersShownStorageKey = 'ffxiv-gearing.dt.tiers-shown';

export type Mode = 'edit' | 'view';

export type FilterFocus = 'no' | 'melded' | 'comparable';

export type GcdOptimizationMode = 'current' | 'all';

export interface GcdOptimizationSpeedRange {
  min: number,
  max: number,
}

export interface EquippedEffects {
  crtChance: number,
  crtDamage: number,
  detDamage: number,
  dhtChance: number,
  tenDamage: number,
  tenMitigation: number,
  damage: number,
  gcd: number,
  ssDamage: number,
  hp: number,
  mp: number,
}

export interface GcdOptimizationResultBase {
  mode: GcdOptimizationMode,
  targetGcd: number,
  speedStat: G.Stat,
  requiredSpeed: number,
  speedRange?: GcdOptimizationSpeedRange,
  customSkipped?: boolean,
}

export interface GcdOptimizationOkResult extends GcdOptimizationResultBase {
  status: 'ok',
  stats: G.Stats,
  effects: EquippedEffects,
  foodId?: G.GearId,
  foodName: string,
  speed: number,
  damageDelta: number,
  plan: GcdOptimizationGearPlan[],
}

export interface GcdOptimizationUnreachableResult extends GcdOptimizationResultBase {
  status: 'unreachable',
  fastestGcd: number,
  fastestSpeed: number,
  fastestDamage: number,
  closestGcd?: number,
  closestSpeed?: number,
}

export interface GcdOptimizationErrorResult {
  status: 'error',
  message: string,
}

export type GcdOptimizationResult =
  GcdOptimizationOkResult | GcdOptimizationUnreachableResult | GcdOptimizationErrorResult;

export interface GcdOptimizationGearPlan {
  slot: number,
  gearId: G.GearId,
  materias?: GcdOptimizationMateriaPlan[],
}

export interface GcdOptimizationMateriaPlan {
  stat?: G.Stat,
  grade?: G.MateriaGrade,
}

interface GcdGearState {
  slot: number,
  gearId: G.GearId,
  stats: G.Stats,
  materias?: GcdOptimizationMateriaPlan[],
  changeCost: number,
}

interface GcdCombinedState {
  stats: G.Stats,
  plan: GcdOptimizationGearPlan[],
  changeCost: number,
}

export const gcdOptimizationMinTargetGcd = 1.80;
export const gcdOptimizationMaxTargetGcd = 2.50;
export const gcdOptimizationMaxSpeed = 100000;

const gcdOptimizationFrontierLimit = 200000;

export function calcGcd(
  speedValue: number,
  jobLevel: G.JobLevel,
  statModifiers: G.JobSchema['statModifiers'],
): number {
  const { sub, div } = G.jobLevelModifiers[jobLevel];
  return floor(floor((1000 - floor(130 * (speedValue - sub) / div)) * 2500 / 1000) *
    (jobLevel >= 80 && statModifiers?.gcd || 100) / 1000) / 100;
}

export function calcRequiredSpeed(
  targetGcd: number,
  jobLevel: G.JobLevel,
  statModifiers: G.JobSchema['statModifiers'],
): number {
  if (!Number.isFinite(targetGcd) || targetGcd <= 0) return Infinity;
  let low = 0;
  let high = 1000;
  while (calcGcd(high, jobLevel, statModifiers) > targetGcd && high < 100000) {
    high *= 2;
  }
  if (high >= 100000 && calcGcd(high, jobLevel, statModifiers) > targetGcd) {
    return Infinity;
  }
  while (low < high) {
    const mid = floor((low + high) / 2);
    if (calcGcd(mid, jobLevel, statModifiers) <= targetGcd) {
      high = mid;
    } else {
      low = mid + 1;
    }
  }
  return low;
}

export function calcEffects(
  stats: G.Stats,
  baseStats: G.Stats,
  job: G.Job,
  jobLevel: G.JobLevel,
  schema: G.JobSchema,
): EquippedEffects | undefined {
  const { statModifiers, mainStat, traitDamageMultiplier, partyBonus } = schema;
  if (statModifiers === undefined || mainStat === undefined || traitDamageMultiplier === undefined) return;
  const levelMod = G.jobLevelModifiers[jobLevel];
  const { main, sub, div, det, detTrunc } = levelMod;
  const { CRT, DET, DHT, TEN, SKS, SPS, VIT, PIE, PDMG, MDMG } = stats;
  const attackMainStat = mainStat === 'VIT' ? 'STR' : mainStat;
  const bluAetherialMimicry = job === 'BLU' ? 200 : 0;
  const crtChance = floor(200 * ((CRT ?? sub) - sub) / div + 50 + bluAetherialMimicry) / 1000;
  const crtDamage = floor(200 * ((CRT ?? sub) - sub) / div + 1400) / 1000;
  const detDamage = floor((140 * ((DET ?? main) - main) / det + 1000) / detTrunc) * detTrunc / 1000;
  const dhtChance = floor(550 * ((DHT ?? sub) - sub) / div + bluAetherialMimicry) / 1000;
  const tenDamage = floor(112 * ((TEN ?? sub) - sub) / div + 1000) / 1000;
  const tenMitigation = floor(200 * ((TEN ?? sub) - sub) / div) / 1000;
  const weaponDamage = floor(main * statModifiers[attackMainStat]! / 1000) +
    ((mainStat === 'MND' || mainStat === 'INT' ? MDMG : PDMG) ?? 0) +
    (job === 'BLU' ? G.bluMdmgAdditions[(stats['INT'] ?? 0) - (baseStats['INT'] ?? 0)] ?? 0 : 0);
  const mainDamage = floor((mainStat === 'VIT' ? levelMod.apTank : levelMod.ap) *
    (floor((stats[attackMainStat] ?? 0) * (partyBonus ?? 1.05)) - main) / main + 100) / 100;
  const damage = 0.01 * weaponDamage * mainDamage * detDamage * tenDamage * traitDamageMultiplier *
    ((crtDamage - 1) * crtChance + 1) * (0.25 * dhtChance + 1);
  const speedValue = SKS ?? SPS ?? sub;
  const gcd = calcGcd(speedValue, jobLevel, statModifiers);
  const ssDamage = floor(130 * (speedValue - sub) / div + 1000) / 1000;
  const hp = levelMod.hp * statModifiers.hp +
    floor((mainStat === 'VIT' ? levelMod.vitTank : levelMod.vit) * ((VIT ?? main) - main));
  const mp = floor(150 * ((PIE ?? main) - main) / div + 200);
  return { crtChance, crtDamage, detDamage, dhtChance, tenDamage, tenMitigation, damage, gcd, ssDamage, hp, mp };
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

function getCandidateMateriaStats(schema: G.JobSchema, speedStat: G.Stat): G.Stat[] {
  const stats = ['CRT', 'DET', 'DHT', speedStat] as G.Stat[];
  if (schema.stats.includes('TEN')) {
    stats.push('TEN');
  }
  return Array.from(new Set(stats)).filter(stat => schema.stats.includes(stat) && stat in G.materias);
}

function getGearStatsWithMaterias(
  gear: G.Gear,
  schema: G.JobSchema,
  jobLevel: G.JobLevel,
  syncLevel: number | undefined,
  customStats: G.Stats | undefined,
  materias: GcdOptimizationMateriaPlan[] | undefined,
): { stats: G.Stats, syncedLevel?: number } {
  const { stats, syncedLevel } = getGearBaseStats(gear, schema, jobLevel, syncLevel, customStats);
  if (syncedLevel !== undefined || materias === undefined || gear.materiaSlot === 0) {
    return { stats, syncedLevel };
  }
  const materiaStats: G.Stats = {};
  for (const materia of materias) {
    if (materia.stat !== undefined && materia.grade !== undefined) {
      materiaStats[materia.stat] = (materiaStats[materia.stat] ?? 0) + G.materias[materia.stat]![materia.grade - 1];
    }
  }
  const caps = G.getCaps(gear);
  for (const [ stat, value ] of Object.entries(materiaStats) as G.StatPairs) {
    const base = stats[stat] ?? 0;
    stats[stat] = Math.min(base + value, Math.max(base, caps[stat] ?? Infinity));
  }
  return { stats };
}

function getCurrentMateriaPlans(gear: IGear): GcdOptimizationMateriaPlan[] {
  return gear.materias.map(materia => ({ stat: materia.stat, grade: materia.grade }));
}

function getMateriaChangeCost(current: GcdOptimizationMateriaPlan[], next: GcdOptimizationMateriaPlan[]): number {
  let cost = 0;
  for (let i = 0; i < next.length; i++) {
    if (current[i]?.stat !== next[i]?.stat || current[i]?.grade !== next[i]?.grade) {
      cost++;
    }
  }
  return cost;
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

function dominates<T extends { stats: G.Stats, changeCost: number }>(
  a: T,
  b: T,
  relevantStats: G.Stat[],
  speedStat: G.Stat,
  requiredSpeed: number,
): boolean {
  if (a.changeCost > b.changeCost) return false;

  let better = false;
  for (const stat of relevantStats) {
    const av = getComparableStatValue(a.stats, stat, speedStat, requiredSpeed);
    const bv = getComparableStatValue(b.stats, stat, speedStat, requiredSpeed);
    if (av < bv) return false;
    // Speed is a constraint, so more pre-food speed must not discard a lower-speed state before food is applied.
    if (stat === speedStat && av > bv) return false;
    if (av > bv) better = true;
  }
  const overflowDiff = getSpeedOverflow(a.stats, speedStat, requiredSpeed) -
    getSpeedOverflow(b.stats, speedStat, requiredSpeed);
  if (overflowDiff > 0) return false;
  if (overflowDiff < 0) better = true;
  if (a.changeCost < b.changeCost) better = true;
  return better;
}

function pruneStates<T extends { stats: G.Stats, changeCost: number }>(
  states: T[],
  relevantStats: G.Stat[],
  speedStat: G.Stat,
  requiredSpeed: number,
): T[] {
  const unique = new Map<string, T>();
  for (const state of states) {
    const key = getPruneKey(state.stats, relevantStats, speedStat, requiredSpeed);
    const existing = unique.get(key);
    if (
      existing === undefined ||
      getSpeedOverflow(state.stats, speedStat, requiredSpeed) <
        getSpeedOverflow(existing.stats, speedStat, requiredSpeed) ||
      (getSpeedOverflow(state.stats, speedStat, requiredSpeed) ===
        getSpeedOverflow(existing.stats, speedStat, requiredSpeed) && state.changeCost < existing.changeCost)
    ) {
      unique.set(key, state);
    }
  }
  const sorted = Array.from(unique.values()).sort((a, b) => {
    for (const stat of relevantStats) {
      const diff = getComparableStatValue(b.stats, stat, speedStat, requiredSpeed) -
        getComparableStatValue(a.stats, stat, speedStat, requiredSpeed);
      if (diff !== 0) return diff;
    }
    return a.changeCost - b.changeCost;
  });
  const ret: T[] = [];
  for (const state of sorted) {
    let dominated = false;
    for (const kept of ret) {
      if (dominates(kept, state, relevantStats, speedStat, requiredSpeed)) {
        dominated = true;
        break;
      }
    }
    if (dominated) continue;
    for (let i = ret.length - 1; i >= 0; i--) {
      if (dominates(state, ret[i], relevantStats, speedStat, requiredSpeed)) {
        ret.splice(i, 1);
      }
    }
    ret.push(state);
    if (ret.length > gcdOptimizationFrontierLimit) {
      throw Error('计算范围过大，请缩小品级范围。');
    }
  }
  return ret;
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

function getCurrentGearOfSlot(self: any, slot: number): IGear | undefined {
  const gear = self.equippedGears.get(slot.toString());
  return gear !== undefined && !gear.isFood ? gear : undefined;
}

function getGearChangeCost(currentGear: IGear | undefined, gear: IGear): number {
  return currentGear?.id === gear.id ? 0 : 100000;
}

function getGearStates(
  self: any,
  gear: IGear,
  speedStat: G.Stat,
  requiredSpeed: number,
  relevantStats: G.Stat[],
  currentGear: IGear | undefined,
  skipUnconfiguredCustomStats: boolean,
): { states: GcdGearState[], customSkipped: boolean } {
  const data = gear.data as G.Gear;
  if (skipUnconfiguredCustomStats && data.customizable && !(gear.customStats !== undefined && gear.customStats.size > 0)) {
    return { states: [], customSkipped: true };
  }

  const customStats = data.customizable ? gear.customStats?.toJSON() as G.Stats : undefined;
  const baseChangeCost = getGearChangeCost(currentGear, gear);
  const { stats: syncedStats, syncedLevel } = getGearBaseStats(
    data,
    self.schema,
    self.jobLevel,
    self.syncLevel,
    customStats,
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
      }],
    };
  }

  const candidateMateriaStats = getCandidateMateriaStats(self.schema, speedStat);
  const currentMaterias = currentGear?.id === gear.id ? getCurrentMateriaPlans(currentGear).slice(0, materiaSlotCount) : [];
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
  const materias: GcdOptimizationMateriaPlan[] = [];
  const states: GcdGearState[] = [];
  const search = (index: number) => {
    if (index < options.length) {
      for (const option of options[index]) {
        materias[index] = option;
        search(index + 1);
      }
      return;
    }

    const materiaPlan = materias.map(materia => ({ stat: materia.stat, grade: materia.grade }));
    const { stats } = getGearStatsWithMaterias(
      data,
      self.schema,
      self.jobLevel,
      self.syncLevel,
      customStats,
      materiaPlan,
    );
    states.push({
      slot: gear.slot,
      gearId: gear.id,
      stats,
      materias: materiaPlan,
      changeCost: baseChangeCost + getMateriaChangeCost(currentMaterias, materiaPlan),
    });
  };
  search(0);

  return {
    customSkipped: false,
    states: pruneStates(states, relevantStats, speedStat, requiredSpeed),
  };
}

function combineFrontier(
  frontier: GcdCombinedState[],
  gearStates: GcdGearState[],
  relevantStats: G.Stat[],
  speedStat: G.Stat,
  requiredSpeed: number,
): GcdCombinedState[] {
  if (frontier.length * gearStates.length > gcdOptimizationFrontierLimit * 20) {
    throw Error('计算范围过大，请缩小品级范围。');
  }
  const combined: GcdCombinedState[] = [];
  for (const frontierState of frontier) {
    for (const gearState of gearStates) {
      combined.push({
        stats: addStats(frontierState.stats, gearState.stats),
        plan: frontierState.plan.concat({
          slot: gearState.slot,
          gearId: gearState.gearId,
          materias: gearState.materias,
        }),
        changeCost: frontierState.changeCost + gearState.changeCost,
      });
    }
  }
  return pruneStates(combined, relevantStats, speedStat, requiredSpeed);
}

function createCurrentGearFrontier(
  self: any,
  speedStat: G.Stat,
  requiredSpeed: number,
  relevantStats: G.Stat[],
): { frontier: GcdCombinedState[], customSkipped: boolean } {
  let frontier: GcdCombinedState[] = [{ stats: self.baseStats, plan: [], changeCost: 0 }];
  let customSkipped = false;
  for (const gear of self.equippedGears.values()) {
    if (gear === undefined || gear.isFood) continue;
    const { states, customSkipped: skipped } = getGearStates(
      self,
      gear,
      speedStat,
      requiredSpeed,
      relevantStats,
      gear,
      false,
    );
    customSkipped ||= skipped;
    frontier = combineFrontier(frontier, states, relevantStats, speedStat, requiredSpeed);
  }
  return { frontier, customSkipped };
}

function createAllGearFrontier(
  self: any,
  speedStat: G.Stat,
  requiredSpeed: number,
  relevantStats: G.Stat[],
  candidateGearIds?: readonly G.GearId[],
): { frontier: GcdCombinedState[], customSkipped: boolean, error?: string } {
  let frontier: GcdCombinedState[] = [{ stats: self.baseStats, plan: [], changeCost: 0 }];
  let customSkipped = false;
  for (const slot of self.schema.slots) {
    if (slot.slot === -1 || slot.slot === -2) continue;
    const gearStates: GcdGearState[] = [];
    for (const gearId of candidateGearIds ?? self.filteredIds as G.GearId[]) {
      const gear = self.gears.get(gearId.toString()) as IGearUnion | undefined;
      if (gear === undefined || gear.isFood || gear.slot !== slot.slot) continue;
      const { states, customSkipped: skipped } = getGearStates(
        self,
        gear,
        speedStat,
        requiredSpeed,
        relevantStats,
        getCurrentGearOfSlot(self, slot.slot),
        true,
      );
      customSkipped ||= skipped;
      gearStates.push(...states);
    }
    if (gearStates.length === 0) {
      return {
        frontier,
        customSkipped,
        error: `${slot.name}没有可用装备，无法生成完整配装。`,
      };
    }
    frontier = combineFrontier(
      frontier,
      pruneStates(gearStates, relevantStats, speedStat, requiredSpeed),
      relevantStats,
      speedStat,
      requiredSpeed,
    );
  }
  return { frontier, customSkipped };
}

function getFoodCandidates(self: any): (G.Food | undefined)[] {
  const foods: (G.Food | undefined)[] = [undefined];
  const job = self.job as G.Job;
  for (const item of gearData.values()) {
    if (item.slot === -1 && G.jobCategories[item.jobCategory][job]) {
      foods.push(item as G.Food);
    }
  }
  foods.sort((a, b) => (a?.id ?? 0) - (b?.id ?? 0));
  return foods;
}

function getFoodChangeCost(self: any, food?: G.Food): number {
  const currentFood = self.equippedGears.get('-1') as IFood | undefined;
  return currentFood?.id === food?.id ? 0 : 1;
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

function evaluateGcdFrontier(
  self: any,
  mode: GcdOptimizationMode,
  targetGcd: number,
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
  const foods = getFoodCandidates(self);
  for (const state of frontier) {
    for (const food of foods) {
      const finalStats = addStats(state.stats, getFoodEffectiveStats(state.stats, food));
      const effects = calcEffects(finalStats, self.baseStats, self.job, self.jobLevel, self.schema);
      if (effects === undefined) continue;
      if (
        fastest === undefined ||
        effects.gcd < fastest.effects.gcd ||
        (effects.gcd === fastest.effects.gcd && effects.damage > fastest.effects.damage)
      ) {
        fastest = { effects, stats: finalStats };
      }
      if (effects.gcd > targetGcd) continue;
      const candidate = {
        effects,
        stats: finalStats,
        changeCost: state.changeCost + getFoodChangeCost(self, food),
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

  const baseResult = { mode, targetGcd, speedStat, requiredSpeed, customSkipped };
  if (best !== undefined) {
    return {
      ...baseResult,
      status: 'ok',
      stats: best.finalStats,
      effects: best.effects,
      foodId: best.food?.id,
      foodName: best.food?.name ?? '不吃食物',
      speed: best.finalStats[speedStat] ?? 0,
      damageDelta: best.effects.damage - (self.equippedEffects?.damage ?? 0),
      plan: best.plan,
    };
  }
  if (fastest !== undefined) {
    return {
      ...baseResult,
      status: 'unreachable',
      fastestGcd: fastest.effects.gcd,
      fastestSpeed: fastest.stats[speedStat] ?? 0,
      fastestDamage: fastest.effects.damage,
    };
  }
  return { status: 'error', message: '没有可用于计算的装备状态。' };
}

function optimizeGcdForStore(
  self: any,
  targetGcd: number,
  mode: GcdOptimizationMode,
  candidateGearIds?: readonly G.GearId[],
): GcdOptimizationResult {
  if (self.job === undefined) return { status: 'error', message: '请先选择职业。' };
  if (self.loadingStatus !== 'ready') return { status: 'error', message: '装备数据仍在加载。' };
  if (
    !Number.isFinite(targetGcd) ||
    targetGcd < gcdOptimizationMinTargetGcd ||
    targetGcd > gcdOptimizationMaxTargetGcd
  ) {
    return { status: 'error', message: `目标 GCD 只能在 ${gcdOptimizationMinTargetGcd.toFixed(2)}s - ${gcdOptimizationMaxTargetGcd.toFixed(2)}s 之间。` };
  }
  const speedStat = getSpeedStat(self.schema);
  if (self.schema.mainStat === undefined || speedStat === undefined) {
    return { status: 'error', message: '该职业不支持伤害期望配速优化。' };
  }
  const requiredSpeed = calcRequiredSpeed(targetGcd, self.jobLevel, self.schema.statModifiers);
  if (requiredSpeed === Infinity) {
    return { status: 'error', message: '目标 GCD 超出可计算范围。' };
  }
  const relevantStats = getRelevantStats(self.schema, speedStat);
  try {
    const optimization: { frontier: GcdCombinedState[], customSkipped: boolean, error?: string } = mode === 'current'
      ? createCurrentGearFrontier(self, speedStat, requiredSpeed, relevantStats)
      : createAllGearFrontier(self, speedStat, requiredSpeed, relevantStats, candidateGearIds);
    const { frontier, customSkipped, error } = optimization;
    if (error !== undefined) {
      return { status: 'error', message: error };
    }
    return evaluateGcdFrontier(self, mode, targetGcd, speedStat, requiredSpeed, frontier, customSkipped);
  } catch (e) {
    return { status: 'error', message: e instanceof Error ? e.message : '计算失败。' };
  }
}

function createGcdOptimizationGearInput(gear: IGear): GcdOptimizationGearInput {
  return {
    id: gear.id,
    slot: gear.slot,
    data: gear.data as G.Gear,
    materias: gear.materias.map(materia => ({ stat: materia.stat, grade: materia.grade })),
    customStats: gear.customStats?.toJSON() as G.Stats | undefined,
  };
}

function createGcdOptimizationInput(
  self: any,
  targetGcd: number,
  mode: GcdOptimizationMode,
  candidateGearIds?: readonly G.GearId[],
  progressionWeeks?: number,
  speedRange?: GcdOptimizationSpeedRange,
): GcdOptimizationInput {
  const filteredIds = candidateGearIds ?? self.filteredIds as G.GearId[];
  const gears = new Map<G.GearId, GcdOptimizationGearInput>();
  const addGear = (gear: IGearUnion | undefined) => {
    if (gear === undefined || gear.isFood) return;
    gears.set(gear.id, createGcdOptimizationGearInput(gear));
  };

  for (const gearId of filteredIds) {
    addGear(self.gears.get(gearId.toString()) as IGearUnion | undefined);
  }

  const equippedGearIdsBySlot: [number, G.GearId][] = [];
  let currentFoodId: G.GearId | undefined;
  const fixedConsumables: G.Food[] = [];
  for (const [ slotKey, gear ] of self.equippedGears.entries()) {
    if (gear === undefined) continue;
    const slot = Number(slotKey);
    if (gear.isFood) {
      if (slot === -1) currentFoodId = gear.id;
      else fixedConsumables.push(gear.data as G.Food);
      continue;
    }
    addGear(gear);
    equippedGearIdsBySlot.push([ slot, gear.id ]);
  }

  const foods: G.Food[] = [];
  for (const item of gearData.values()) {
    if (item.slot === -1 && G.jobCategories[item.jobCategory][self.job as G.Job]) {
      foods.push(item as G.Food);
    }
  }

  return {
    mode,
    targetGcd,
    speedRange,
    progressionWeeks,
    job: self.job,
    jobLevel: self.jobLevel,
    syncLevel: self.syncLevel,
    baseStats: self.baseStats,
    currentDamage: self.equippedEffects?.damage ?? 0,
    currentFoodId,
    filteredIds: Array.from(filteredIds),
    equippedGearIdsBySlot,
    gears: Array.from(gears.values()),
    foods,
    fixedConsumables,
  };
}

function createProductionMateriaOptimizationInput(
  self: any,
  targets: G.Stats,
): ProductionMateriaOptimizationInput | ProductionMateriaOptimizationResult {
  if (self.job === undefined) return { status: 'error', message: '请先选择职业。' };
  const stats = self.schema.stats as ProductionMateriaStat[];
  if (stats.length !== 3 || !stats.every(stat => ['CMS', 'CRL', 'CP', 'GTH', 'PCP', 'GP'].includes(stat))) {
    return { status: 'error', message: '该职业不支持生产采集三维计算。' };
  }
  const input: ProductionMateriaOptimizationInput = {
    stats: stats as ProductionMateriaOptimizationInput['stats'],
    baseStats: self.productionMateriaBaseStats,
    targets,
    gears: [],
  };
  for (const gear of self.equippedGears.values() as Iterable<IGearUnion | undefined>) {
    if (gear === undefined || gear.isFood || gear.syncedLevel !== undefined || gear.materias.length === 0) continue;
    const baseStats: G.Stats = {};
    for (const stat of stats) {
      baseStats[stat] = gear.customizable
        ? gear.customStats?.get(stat) ?? gear.bareStats[stat] ?? 0
        : gear.bareStats[stat] ?? 0;
    }
    input.gears.push({
      gearId: gear.id,
      slot: gear.slot,
      baseStats,
      caps: gear.caps,
      slots: gear.materias.map(materia => ({
        allowedGrades: G.materiaGrades.filter(grade =>
          gear.level >= G.materiaGradeRequiredLevels[grade - 1] &&
          (materia.canRestricted || !G.materiaGradeIsRestricted[grade])),
      })),
    });
  }
  return input;
}

function isProductionMateriaResult(
  value: ProductionMateriaOptimizationInput | ProductionMateriaOptimizationResult,
): value is ProductionMateriaOptimizationResult {
  return 'status' in value;
}

export const Store = mst.types
  .model('Store', {
    mode: mst.types.optional(mst.types.string as mst.ISimpleType<Mode>, 'edit'),
    job: mst.types.maybe(mst.types.string as mst.ISimpleType<G.Job>),
    jobLevel: mst.types.optional(mst.types.number as mst.ISimpleType<G.JobLevel>, 100),
    minLevel: mst.types.optional(mst.types.number, 0),
    maxLevel: mst.types.optional(mst.types.number, 0),
    minLevelIncoming: mst.types.maybe(mst.types.number),
    maxLevelIncoming: mst.types.maybe(mst.types.number),
    syncLevel: mst.types.maybe(mst.types.number),
    filterFocus: mst.types.optional(mst.types.string as mst.ISimpleType<FilterFocus>, 'no'),
    showAllMaterias: mst.types.optional(mst.types.boolean, false),
    showAllFoods: mst.types.optional(mst.types.boolean, false),
    showAllPotions: mst.types.optional(mst.types.boolean, false),
    duplicateToolMateria: mst.types.optional(mst.types.boolean, true),
    gears: mst.types.map(GearUnion),
    equippedGears: mst.types.map(GearUnionReference),
  })
  .volatile(() => ({
    setting: Setting.create(),
    promotion: Promotion.create(),
    clan: Number(localStorage.getItem(clanStorageKey)) || 0,
    tiersShown: localStorage.getItem(tiersShownStorageKey) === 'true',
    materiaOverallActiveTab: 0,
    autoSelectScheduled: false,
    gcdOptimizationGearSelectionActive: false,
    gcdOptimizationSelectedGearIds: [] as G.GearId[],
  }))
  .views(self => ({
    get filteredIds(): G.GearId[] {
      console.debug('filteredIds');
      if (self.job === undefined) return [];
      if (self.mode === 'view') {
        return Array.from(self.gears.keys(), id => Number(id) as G.GearId);
      }
      const unobservableEquippedGears = mobx.untracked(() => self.equippedGears.toJSON());
      const ret: G.GearId[] = [];
      for (const gear of gearDataOrdered.get()) {
        const { job, minLevel, maxLevel } = self;
        if (
          G.jobCategories[gear.jobCategory][job!] &&
          (gear.slot === -1 ? (self.showAllFoods || 'best' in gear) :  // Foods
            gear.slot === -2 ? (self.showAllPotions || 'best' in gear) :  // Potions
              gear.slot === 17 || (gear.slot === 2 && job === 'FSH') ||  // Soul crystal and spearfishing gig
              (gear.level >= minLevel && gear.level <= maxLevel &&
                !(gear.obsolete && this.setting.hideObsoleteGears))
          )
        ) {
          ret.push(gear.id);
          if (gear.slot === 12) {
            ret.push(-gear.id as G.GearId);
          }
        } else {
          if (unobservableEquippedGears[gear.slot] === gear.id) {
            ret.push(gear.id);
          }
          if (unobservableEquippedGears[-gear.slot] === -gear.id) {
            ret.push(-gear.id as G.GearId);
          }
        }
      }
      return ret;
    },
  }))
  .views(self => ({
    get loadingStatus() {
      return gearDataLoading.get()
        ? self.minLevelIncoming !== undefined || self.maxLevelIncoming !== undefined
          ? 'appending'  // keep rendered when loading
          : 'loading'
        : 'ready';
    },
    get isViewing(): boolean {
      return self.mode === 'view';
    },
    get schema(): G.JobSchema {
      if (self.job === undefined) throw new ReferenceError();
      return G.jobSchemas[self.job];
    },
    get groupedGears(): { [index: number]: IGearUnion[] } {
      console.debug('groupedGears');
      const ret: { [index: number]: IGearUnion[] } = {};
      for (const gearId of self.filteredIds) {
        const gear = self.gears.get(gearId.toString())!;
        if (!gear.isFood && !gear.isMelded) {
          if (self.filterFocus === 'melded' && !gear.isEquipped) continue;
          if (self.filterFocus === 'comparable') continue;
        }
        if (!(gear.slot in ret)) {
          ret[gear.slot] = [];
        }
        ret[gear.slot].push(gear);
      }
      return ret;
    },
    get baseStats(): G.Stats {
      if (self.job === undefined) return {};
      const levelModifier = G.jobLevelModifiers[self.jobLevel];
      const stats: G.Stats = { PDMG: 0, MDMG: 0, DLY: 0 };
      for (const stat of this.schema.stats as G.Stat[]) {
        const baseStat = G.baseStats[stat] ?? 0;
        if (typeof baseStat === 'number') {
          stats[stat] = baseStat;
        } else {
          stats[stat] = floor(levelModifier[baseStat] * (this.schema.statModifiers[stat] ?? 100) / 100) +
            (G.clanStats[stat]?.[self.clan] ?? 0);
        }
      }
      return stats;
    },
    get equippedStatsWithoutFood(): G.Stats {
      if (self.job === undefined) return {};
      const stats: G.Stats = { ...this.baseStats };
      for (const gear of self.equippedGears.values()) {
        if (gear === undefined) continue;
        if (!gear.isFood) {
          for (const stat of Object.keys(gear.stats) as G.Stat[]) {
            stats[stat] = stats[stat]! + gear.stats[stat]!;
          }
        }
      }
      return stats;
    },
    get productionMateriaBaseStats(): G.Stats {
      if (self.job === undefined) return {};
      const stats: G.Stats = { ...this.baseStats };
      for (const gear of self.equippedGears.values()) {
        if (gear === undefined || gear.isFood) continue;
        for (const stat of this.schema.stats as G.Stat[]) {
          const value = gear.customizable
            ? gear.customStats?.get(stat) ?? gear.bareStats[stat] ?? 0
            : gear.bareStats[stat] ?? 0;
          stats[stat] = (stats[stat] ?? 0) + value;
        }
      }
      return stats;
    },
    get productionMateriaMaximumStats(): G.Stats {
      const stats: G.Stats = { ...this.productionMateriaBaseStats };
      if (self.job === undefined) return stats;
      for (const stat of this.schema.stats as G.Stat[]) {
        if (!(stat in G.materias)) continue;
        for (const gear of self.equippedGears.values()) {
          if (gear === undefined || gear.isFood || gear.syncedLevel !== undefined) continue;
          const base = gear.customizable
            ? gear.customStats?.get(stat) ?? gear.bareStats[stat] ?? 0
            : gear.bareStats[stat] ?? 0;
          let raw = 0;
          for (const materia of gear.materias) {
            const grade = G.materiaGrades.find(candidate =>
              gear.level >= G.materiaGradeRequiredLevels[candidate - 1] &&
              (materia.canRestricted || !G.materiaGradeIsRestricted[candidate]));
            if (grade !== undefined) raw += G.materias[stat]![grade - 1];
          }
          stats[stat] = (stats[stat] ?? 0) + Math.max(0, Math.min(raw, (gear.caps[stat] ?? 0) - base));
        }
      }
      return stats;
    },
    get equippedStats(): G.Stats {
      console.debug('equippedStats');
      if (self.job === undefined) return {};
      const stats = { ...this.equippedStatsWithoutFood };
      for (const slot of ['-1', '-2']) {
        const equippedFood = self.equippedGears.get(slot) as IFood;
        if (equippedFood === undefined) continue;
        for (const stat of Object.keys(this.equippedStatsWithoutFood) as G.Stat[]) {
          stats[stat] += equippedFood.effectiveStats[stat] ?? 0;
        }
      }
      return stats;
    },
    get equippedLevel(): number {
      let level = 0;
      let weight = 0;
      for (const slot of this.schema.slots) {
        level += (self.equippedGears.get(slot.slot)?.level ?? 0) * (slot.levelWeight ?? 1);
        weight += (slot.levelWeight ?? 1);
      }
      return floor(level / weight);
    },
    get isMateriaNamesSameWidth(): boolean {
      let lastWidth = -1;
      for (const gear of self.equippedGears.values()) {
        if (gear === undefined || gear.isFood) continue;
        for (const { name } of gear.materias) {
          if (name.length === 0) continue;
          let width = 0;
          for (let i = 0; i < name.length; i++) {
            width += name.charCodeAt(i) < 0x100 ? 1 : 2;
          }
          if (lastWidth !== -1 && width !== lastWidth) return false;
          lastWidth = width;
        }
      }
      return true;
    },
    get materiaConsumption() {
      const consumption: { [index in G.Stat]?: { [index in G.MateriaGrade]?:
          { safe: number, expectation: number, confidence90: number, confidence99: number, rates: number[] } } } = {};
      for (const gear of self.equippedGears.values()) {
        if (gear === undefined || gear.isFood) continue;
        const duplicates = self.duplicateToolMateria &&
          (gear.slot === 1 || gear.slot === 2) && this.schema.toolMateriaDuplicates || 1;
        for (const materia of gear.materias) {
          if (materia.stat === undefined) continue;
          const consumptionStat = consumption[materia.stat] ??= {};
          const consumptionItem = consumptionStat[materia.grade!] ??=
            { safe: 0, expectation: 0, confidence90: 0, confidence99: 0, rates: [] };
          for (let i = 0; i < duplicates; i++) {
            if (materia.successRate === 100) {
              consumptionItem.safe += 1;
            } else {
              consumptionItem.expectation += 100 / materia.successRate!;
              consumptionItem.rates.push(materia.successRate! / 100);
            }
          }
        }
      }
      let advancedItemCount = 0;
      for (const consumptionOfStat of Object.values(consumption)) {
        for (const consumptionItem of Object.values(consumptionOfStat!)) {
          if (consumptionItem!.rates.length > 0) {
            advancedItemCount++;
          }
        }
      }
      const p90 = .90 ** (1 / advancedItemCount);
      const p99 = .99 ** (1 / advancedItemCount);
      const thresholds90: { pBelow: number, pAbove: number, increase: () => void }[] = [];
      const thresholds99: { pBelow: number, pAbove: number, increase: () => void }[] = [];
      for (const consumptionOfStat of Object.values(consumption)) {
        for (const consumptionItem of Object.values(consumptionOfStat!)) {
          consumptionItem!.expectation = consumptionItem!.safe + Math.round(consumptionItem!.expectation);
          const p = consumptionItem!.rates;
          if (p.length === 0) {
            consumptionItem!.confidence90 = consumptionItem!.confidence99 = consumptionItem!.safe;
            continue;
          }
          const pp: number[][] = p.map(pi => [1, 1 - pi]);  // pp[i][j] = (1 - p[i]) ** j, for caching
          const ps: Float64Array[] = [];  // ps[n][i]: success rate of using n materias to meld slots p[i..]
          let n = 1;
          let n90 = 0;
          while (true) {
            for (let i = 0; i < p.length; i++) {
              pp[i][n] = pp[i][n - 1] * pp[i][1];
            }
            ps[n] = new Float64Array(p.length);
            ps[n][p.length - 1] = 1 - pp[p.length - 1][n];
            for (let i = p.length - 2; i >= 0; i--) {
              if (p.length - i > n) break;
              ps[n][i] = 0;
              for (let j = 1; j <= n - (p.length - i) + 1; j++) {
                ps[n][i] += pp[i][j - 1] * p[i] * ps[n - j][i + 1];
              }
            }
            if (ps[n][0] > p90 && n90 === 0) n90 = n;
            if (ps[n][0] > p99) break;
            n++;
          }
          consumptionItem!.confidence90 = consumptionItem!.safe + n90 - 1;
          consumptionItem!.confidence99 = consumptionItem!.safe + n - 1;
          thresholds90.push({ pBelow: ps[n90 - 1][0], pAbove: ps[n90][0],
            increase: () => consumptionItem!.confidence90++ });
          thresholds99.push({ pBelow: ps[n - 1][0], pAbove: ps[n][0],
            increase: () => consumptionItem!.confidence99++ });
        }
      }
      for (const [ threshold, pTarget ] of [[thresholds90, .90], [thresholds99, .99]] as const) {
        threshold.sort((a, b) => a.pBelow - b.pBelow);
        let pOverall = 1;
        for (const entry of threshold) {
          pOverall *= entry.pBelow;
        }
        for (const entry of threshold) {
          entry.increase();
          pOverall = pOverall / entry.pBelow * entry.pAbove;
          if (pOverall > pTarget) break;
        }
      }
      return consumption;
    },
    get syncLevelText(): number | string | undefined {
      if (self.syncLevel !== undefined) {
        return self.syncLevel.toString();
      }
      if (self.jobLevel !== this.schema.jobLevel) {
        return self.jobLevel + '级';
      }
    },
    get clanText(): string {
      return `${G.races[floor(self.clan / 2)]} - ${G.clans[self.clan]}`;
    },
  }))
  .views(self => ({
    get equippedStatsText(): string {
      let stats = self.schema.stats;
      if (stats[0] === 'STR' || stats[0] === 'DEX') {
        stats = stats.concat('PDMG', 'DLY');
      }
      if (stats[0] === 'INT' || stats[0] === 'MND') {
        stats = stats.concat('MDMG');
      }
      return stats.map(stat => {
        const value = self.equippedStats[stat]!;
        return `${G.statNames[stat]} ${stat !== 'DLY' ? value : (value / 1000).toFixed(2)}`;
      }).join('\n');
    },
    get equippedEffects() {
      console.debug('equippedEffects');
      if (self.job === undefined) return;
      return calcEffects(self.equippedStats, self.baseStats, self.job, self.jobLevel, self.schema);
    },
    get equippedTiers(): { [index in G.Stat]?: { prev: number, next: number } } | undefined {
      const { statModifiers } = self.schema;
      if (statModifiers === undefined) return;
      const { main, sub, div, det, detTrunc } = G.jobLevelModifiers[self.jobLevel];
      const { CRT, DET, DHT, TEN, SKS, SPS, PIE } = self.equippedStats;
      function calcTier(value: number, multiplier: number) {
        if (Number.isNaN(value)) return undefined;
        const quotient = floor(value / multiplier);
        const prev = ceil(quotient * multiplier) - 1 - value;
        const next = ceil((quotient + 1) * multiplier) - value;
        return { prev, next };
      }
      function calcGcdTier(value: number, multiplier: number, modifier: number) {
        if (Number.isNaN(value)) return undefined;
        const gcdc = floor(floor((1000 - floor(value / multiplier)) * 2.5) * modifier);
        const prev = ceil((floor(1000 - ceil((gcdc + 1) / modifier) / 2.5) + 1) * multiplier) - 1 - value;
        const next = ceil((floor(1000 - ceil(gcdc / modifier) / 2.5) + 1) * multiplier) - value;
        return { prev, next };
      }
      return {
        CRT: calcTier(CRT! - sub, div / 200),
        DET: calcTier(DET! - main, det / 140 * detTrunc),
        DHT: calcTier(DHT! - sub, div / 550),
        TEN: calcTier(TEN! - sub, div / 112),
        SKS: calcGcdTier(SKS! - sub, div / 130, (statModifiers.gcd ?? 100) / 1000),
        SPS: calcGcdTier(SPS! - sub, div / 130, (statModifiers.gcd ?? 100) / 1000),
        PIE: calcTier(PIE! - main, div / 150),
      };
    },
    get materiaDetDhtOptimized() {
      console.debug('materiaDetDhtOptimized');
      type Pair = number;  // a packed DET,DHT pair
      type Meld = [number, number];  // a meld assignment, [DET major materia amount, DET minor materia amount]
      type OriginalMelds = { DET: Meld, DHT: Meld, all: Meld };  // eslint-disable-line
      type Route = Pair[];  // a selection from possible pairs of every gear

      const pack = (stats: G.Stats): Pair => ((stats.DET ?? 0) << 16) | (stats.DHT ?? 0);
      const unpack = (pair: Pair) => ([ pair >> 16, pair & ~(-1 << 16) ]);
      const mapPush = <TKey, TItem>(map: Map<TKey, TItem[]>, key: TKey, item: TItem) => {
        const items = map.get(key) ?? [];
        items.push(item);
        map.set(key, items);
      };

      const gearOriginalMelds = new Map<G.GearId, OriginalMelds>();
      let food: IFood | undefined;
      let fixedPair = pack(self.baseStats);
      const freeGears: IGear[] = [];
      const freeMajorSlots: IMateria[] = [];
      const freeMinorSlots: IMateria[] = [];
      const freePossiblePairMelds = new Map<Pair, Meld[]>();
      const crucialGears: IGear[] = [];
      const crucialGearPossiblePairMelds: Map<Pair, Meld[]>[] = [];
      mobx.runInAction(() => {  // this action only modifies the replica
        const replica = Store.create(mst.getSnapshot(self));
        replica.unprotect();

        for (const gear of replica.equippedGears.values()) {
          if (gear === undefined) continue;
          if (gear.isFood) {
            food = gear;
            continue;
          }

          const slots = gear.materias.filter(m => m.stat === 'DET' || m.stat === 'DHT' || m.stat === undefined);
          const originalMelds: OriginalMelds = { DET: [0, 0], DHT: [0, 0], all: [0, 0] };
          for (const materia of slots) {
            materia.grade = materia.meldableGrades[0];
            const meldType = materia.canRestricted ? 0 : 1;
            if (materia.stat === 'DET') originalMelds['DET'][meldType]++;
            if (materia.stat === 'DHT') originalMelds['DHT'][meldType]++;
            originalMelds['all'][meldType]++;
          }
          gearOriginalMelds.set(gear.id, originalMelds);

          for (const materia of slots) materia.stat = 'DET';
          const pairAllDet = pack(gear.stats);
          const overcapAllDet = gear.currentMeldableStats.DET! < 0;
          for (const materia of slots) materia.stat = 'DHT';
          const pairAllDht = pack(gear.stats);
          const overcapAllDht = gear.currentMeldableStats.DHT! < 0;
          if (pairAllDet === pairAllDht) {
            // this gear is unaffected by DET/DHT materias, preserve stat value only
            fixedPair += pairAllDet;
          } else if (!overcapAllDet && !overcapAllDht && (freeGears.length === 0 ||
              gear.materias[0].meldableGrades[0] === freeGears[0].materias[0].meldableGrades[0])) {
            // this gear is free to meld from over cap, treat all these gears as one joint gear for better performance
            freeGears.push(gear);
            for (const materia of slots) {
              (materia.canRestricted ? freeMajorSlots : freeMinorSlots).push(materia);
            }
          } else {
            // this gear might over cap, need to enumerate respectively
            crucialGears.push(gear);
            const majorSlots = slots.filter(m => m.canRestricted);
            const minorSlots = slots.filter(m => !m.canRestricted);
            const pairMelds = new Map<Pair, Meld[]>();
            for (let majorDetAmount = 0; majorDetAmount <= majorSlots.length; majorDetAmount++) {
              if (majorDetAmount > 0) majorSlots[majorDetAmount - 1].stat = 'DET';
              for (const minorSlot of minorSlots) minorSlot.stat = 'DHT';
              for (let minorDetAmount = 0; minorDetAmount <= minorSlots.length; minorDetAmount++) {
                if (minorDetAmount > 0) minorSlots[minorDetAmount - 1].stat = 'DET';
                const pair = pack(gear.stats);
                mapPush(pairMelds, pair, [majorDetAmount, minorDetAmount]);
              }
            }
            for (const pair of pairMelds.keys()) {  // prune completely inferior pairs
              const [ DET, DHT ] = unpack(pair);
              for (const pair2 of pairMelds.keys()) {
                if (pair === pair2) continue;
                const [ DET2, DHT2 ] = unpack(pair2);
                if (DET <= DET2 && DHT <= DHT2) {
                  pairMelds.delete(pair);
                  break;
                }
              }
            }
            crucialGearPossiblePairMelds.push(pairMelds);
          }
        }

        for (let majorDetAmount = 0; majorDetAmount <= freeMajorSlots.length; majorDetAmount++) {
          if (majorDetAmount > 0) freeMajorSlots[majorDetAmount - 1].stat = 'DET';
          for (const minorSlot of freeMinorSlots) minorSlot.stat = 'DHT';
          for (let minorDetAmount = 0; minorDetAmount <= freeMinorSlots.length; minorDetAmount++) {
            if (minorDetAmount > 0) freeMinorSlots[minorDetAmount - 1].stat = 'DET';
            const pair = freeGears.reduce((sc, gear) => sc + pack(gear.stats), 0);
            mapPush(freePossiblePairMelds, pair, [majorDetAmount, minorDetAmount]);
          }
        }
      });

      const { main, sub, div, det, detTrunc } = G.jobLevelModifiers[self.jobLevel];
      const bluAetherialMimicry = self.job === 'BLU' ? 200 : 0;
      const foodDet = food?.stats?.['DET'] ?? 0;
      const foodDetRate = food?.statRates?.['DET'] ?? Infinity;
      const foodDht = food?.stats?.['DHT'] ?? 0;
      const foodDhtRate = food?.statRates?.['DHT'] ?? Infinity;

      let maxDamage = 0;
      let acceptableDamage = 0;
      const damagePossibleTotalPairs = new Map<number, Pair[]>();
      const totalPairPossibleRoutes = new Map<Pair, Route[]>();
      const combinedPossiblePairMelds = [freePossiblePairMelds].concat(crucialGearPossiblePairMelds);
      const route: Route = [];
      const search = (currentPair: Pair, gearIndex: number) => {
        if (gearIndex < combinedPossiblePairMelds.length) {
          for (const pair of combinedPossiblePairMelds[gearIndex].keys()) {
            route[gearIndex] = pair;
            search(currentPair + pair, gearIndex + 1);
          }
        } else {
          let [ DET, DHT ] = unpack(currentPair);
          DET += Math.min(foodDet, floor(DET * foodDetRate / 100));
          DHT += Math.min(foodDht, floor(DHT * foodDhtRate / 100));

          const detDamage = floor((140 * (DET - main) / det + 1000) / detTrunc) * detTrunc / 1000;
          const dhtChance = floor(550 * (DHT - sub) / div + bluAetherialMimicry) / 1000;
          const damage = detDamage * (0.25 * dhtChance + 1);
          if (damage > maxDamage) {
            maxDamage = damage;
            acceptableDamage = damage * 0.9997;
          }
          if (damage > acceptableDamage) {
            const totalPair = pack({ DET, DHT });
            mapPush(damagePossibleTotalPairs, damage, totalPair);
            mapPush(totalPairPossibleRoutes, totalPair, route.slice());
          }
        }
      };
      search(fixedPair, 0);
      for (const damage of damagePossibleTotalPairs.keys()) {
        if (damage <= acceptableDamage) {
          damagePossibleTotalPairs.delete(damage);
        }
      }
      const damages = new Float64Array(damagePossibleTotalPairs.keys()).sort().reverse();
      const goodTotalPairs: Pair[] = [];
      for (const damage of damages) {
        goodTotalPairs.push(...new Set(damagePossibleTotalPairs.get(damage)!).values());
      }

      // ↑ determine good DET/DHT distribution
      // ↓ determine corresponding materia assignment

      const freeOriginalMelds: OriginalMelds = { DET: [0, 0], DHT: [0, 0], all: [0, 0] };
      const freeOriginalMaterias: IMateria[] = [];
      const freeGearMateriaPositions: Map<G.GearId, number[]> = new Map();
      for (const gear of freeGears) {
        for (const [ stat, meld ] of Object.entries(freeOriginalMelds)) {
          meld[0] += gearOriginalMelds.get(gear.id)![stat as keyof OriginalMelds][0];
          meld[1] += gearOriginalMelds.get(gear.id)![stat as keyof OriginalMelds][1];
        }
        freeGearMateriaPositions.set(gear.id, []);
      }
      for (let materiaIndex = 0; materiaIndex < 5; materiaIndex++) {
        for (const gear of freeGears) {
          const originalGead = self.gears.get(gear.id) as IGear;
          if (materiaIndex < originalGead.materias.length) {
            freeGearMateriaPositions.get(gear.id)![materiaIndex] = freeOriginalMaterias.length;
            freeOriginalMaterias.push(originalGead.materias[materiaIndex]);
          }
        }
      }

      const combinedPossiblePairDistance: Map<Pair, number>[] =
        Array.from({ length: combinedPossiblePairMelds.length }, () => new Map());
      const combinedPossiblePairMateriaStats: Map<Pair, G.Stat[]>[] =
        Array.from({ length: combinedPossiblePairMelds.length }, () => new Map());
      const solutions = goodTotalPairs.map(totalPair => {
        const routes = totalPairPossibleRoutes.get(totalPair)!;
        let bestDistance = Infinity;
        let bestRoute: Route | undefined;
        for (const route of routes) {
          let routeDistance = 0;
          for (let gearIndex = 0; gearIndex < route.length; gearIndex++) {
            const pair = route[gearIndex];
            let distance = combinedPossiblePairDistance[gearIndex].get(pair);
            if (distance === undefined) {
              distance = Infinity;
              let bestMateriaStats: G.Stat[] = [];
              const melds = combinedPossiblePairMelds[gearIndex].get(pair)!;
              for (const meld of melds) {
                let currentDistance = 0;
                const originalMaterias = gearIndex === 0 ? freeOriginalMaterias :
                  (self.gears.get(crucialGears[gearIndex - 1].id) as IGear).materias;
                const originalMelds = gearIndex === 0 ? freeOriginalMelds :
                  gearOriginalMelds.get(crucialGears[gearIndex - 1].id)!;
                const materiaStats = originalMaterias.map(m => m.stat);
                for (const meldType of [0, 1]) {
                  const statMeld = { DET: meld[meldType], DHT: originalMelds['all'][meldType] - meld[meldType] };
                  for (const stat of ['DET', 'DHT'] as const) {
                    let retrieveAmount = originalMelds[stat][meldType] - statMeld[stat];
                    let materiaIndex = originalMaterias.length - 1;
                    while (retrieveAmount > 0) {
                      const materia = originalMaterias[materiaIndex];
                      if (materia.stat === stat && (materia.canRestricted === (meldType === 0))) {
                        currentDistance += 1000 + materia.gear.materias.length - materia.index;
                        materiaStats[materiaIndex] = undefined;
                        retrieveAmount--;
                      }
                      materiaIndex--;
                    }
                  }
                  for (const stat of ['DET', 'DHT'] as const) {
                    let meldAmount = statMeld[stat] - originalMelds[stat][meldType];
                    let materiaIndex = 0;
                    while (meldAmount > 0) {
                      if (materiaStats[materiaIndex] === undefined) {
                        materiaStats[materiaIndex] = stat;
                        meldAmount--;
                      }
                      materiaIndex++;
                    }
                  }
                }
                if (currentDistance < distance) {
                  distance = currentDistance;
                  bestMateriaStats = materiaStats.slice() as G.Stat[];
                }
              }
              combinedPossiblePairDistance[gearIndex].set(pair, distance);
              combinedPossiblePairMateriaStats[gearIndex].set(pair, bestMateriaStats);
            }
            routeDistance += distance;
          }
          if (routeDistance < bestDistance) {
            bestDistance = routeDistance;
            bestRoute = route;
          }
        }
        const gearMateriaStats: Map<G.GearId, G.Stat[]> = new Map();
        for (let gearIndex = 0; gearIndex < bestRoute!.length; gearIndex++) {
          const pair = bestRoute![gearIndex];
          const materiaStats = combinedPossiblePairMateriaStats[gearIndex].get(pair)!;
          if (gearIndex === 0) {
            for (const [ gearId, positions ] of freeGearMateriaPositions.entries()) {
              gearMateriaStats.set(gearId, positions.map(p => materiaStats[p]));
            }
          } else {
            gearMateriaStats.set(crucialGears[gearIndex - 1].id, materiaStats);
          }
        }
        const [ DET, DHT ] = unpack(totalPair);
        return { DET, DHT, gearMateriaStats };
      });
      return solutions;
    },
    get share(): string {
      if (self.job === undefined) return '';
      const gears: G.Gearset['gears'] = [];
      for (const slot of self.schema.slots) {
        const gear = self.equippedGears.get(slot.slot.toString());
        if (gear === undefined) continue;
        gears.push({
          id: gear.data.id,
          materias: gear.isFood || gear.syncedLevel !== undefined ? [] :
            gear.materias.map(m => m.stat !== undefined ? [m.stat, m.grade!] : null),
          customStats: (gear as IGear).customStats?.toJSON(),
        });
      }
      return share.stringify({
        job: self.job,
        jobLevel: self.jobLevel,
        syncLevel: self.syncLevel,
        gears,
      });
    },
    get shareUrl(): string {
      return window.location.origin + window.location.pathname + '?' + this.share;
    },
    get garlandGroup(): string {
      if (self.job === undefined) return '';
      const parts = [self.schema.name, self.equippedLevel, ' ', (new Date()).toLocaleString(), '{'];
      for (const slot of self.schema.slots) {
        if (slot.slot === 17 || (slot.slot === 2 && self.job === 'FSH')) continue;
        const gear = self.equippedGears.get(slot.slot.toString());
        if (gear === undefined) continue;
        if (gear.data.id === parts.at(-2)) {  // same rings
          parts.splice(-1, 0, '+2');
        } else {
          parts.push('item/');
          parts.push(gear.data.id);
          parts.push('|');
        }
      }
      parts[parts.length - 1] = '}';
      return `#group/${encodeURI(parts.join(''))}`;
    },
    get title(): string | undefined {
      const suffix = '最终幻想14配装器';
      if (self.job === undefined) return suffix;
      if (self.loadingStatus !== 'ready') return undefined;
      const glance = self.schema.mainStat !== undefined
        ? `il${self.equippedLevel}/${this.equippedEffects.gcd.toFixed(2)}s`
        : self.schema.stats.map(s => self.equippedStats[s]).join('/');
      return `${self.schema.name}(${glance}) - ${suffix}`;
    },
  }))
  .actions(self => ({
    createGears(): void {
      console.debug('createGears');
      for (const gearId of self.filteredIds) {
        if (!self.gears.has(gearId.toString())) {
          self.gears.put(GearUnion.create({ id: gearId }));
        }
      }
    },
    setMode(mode: Mode): void {
      self.mode = mode;
    },
    setJob(job: G.Job): void {
      const oldSchema = self.job && G.jobSchemas[self.job];
      const newSchema = G.jobSchemas[job];
      self.job = job;
      if (newSchema.jobLevel !== oldSchema?.jobLevel || !newSchema.levelSyncable) {
        self.jobLevel = newSchema.jobLevel;
        self.syncLevel = undefined;
      }
      if (newSchema.defaultItemLevel !== oldSchema?.defaultItemLevel) {
        self.minLevel = newSchema.defaultItemLevel[0];
        self.maxLevel = newSchema.defaultItemLevel[1];
        self.minLevelIncoming = undefined;
        self.maxLevelIncoming = undefined;
      }
      for (const [ key, gear ] of self.equippedGears.entries()) {
        if (gear !== undefined && !gear.jobs[job]) {
          self.equippedGears.delete(key);
        }
      }
      self.autoSelectScheduled = newSchema.skeletonGears ?? false;
    },
    setMinLevel(level: number): void {
      self.minLevelIncoming = level;
    },
    setMaxLevel(level: number): void {
      self.maxLevelIncoming = level;
    },
    submitIncomingLevels(): void {
      if (self.minLevelIncoming !== undefined) {
        self.minLevel = self.minLevelIncoming;
        self.minLevelIncoming = undefined;
      }
      if (self.maxLevelIncoming !== undefined) {
        self.maxLevel = self.maxLevelIncoming;
        self.maxLevelIncoming = undefined;
      }
    },
    setSyncLevel(level: number | undefined, jobLevel: G.JobLevel | undefined): void {
      self.syncLevel = level;
      self.jobLevel = jobLevel ?? self.schema.jobLevel;
    },
    setFilterFocus(filterFocus: FilterFocus) {
      self.filterFocus = filterFocus;
    },
    setMateriaOverallActiveTab(activeTab: number) {
      self.materiaOverallActiveTab = activeTab;
    },
    startGcdOptimizationGearSelection(gearIds: G.GearId[]) {
      self.gcdOptimizationSelectedGearIds = gearIds;
      self.gcdOptimizationGearSelectionActive = true;
    },
    stopGcdOptimizationGearSelection() {
      self.gcdOptimizationGearSelectionActive = false;
    },
    setGcdOptimizationSelectedGearIds(gearIds: G.GearId[]) {
      self.gcdOptimizationSelectedGearIds = gearIds;
    },
    toggleGcdOptimizationGearSelection(gearId: G.GearId) {
      if (self.gcdOptimizationSelectedGearIds.includes(gearId)) {
        self.gcdOptimizationSelectedGearIds = self.gcdOptimizationSelectedGearIds.filter(id => id !== gearId);
      } else {
        const selectedIds = new Set(self.gcdOptimizationSelectedGearIds.concat(gearId));
        self.gcdOptimizationSelectedGearIds = self.filteredIds.filter(id => selectedIds.has(id));
      }
    },
    setMateriaDetDhtOptimization(gearMateriaStats: Map<G.GearId, G.Stat[]>): void {
      for (const [ gearId, materiaStats ] of gearMateriaStats.entries()) {
        const gear = self.gears.get(gearId as any) as IGear;
        for (let i = 0; i < gear.materias.length; i++) {
          const materia = gear.materias[i];
          materia.stat = materiaStats[i];
          if (materia.stat === 'DET' || materia.stat === 'DHT') {
            materia.grade = materia.meldableGrades[0];
          }
        }
      }
    },
    optimizeGcd(
      targetGcd: number,
      mode: GcdOptimizationMode,
      candidateGearIds?: G.GearId[],
      progressionWeeks?: number,
      speedRange?: GcdOptimizationSpeedRange,
    ): GcdOptimizationResult {
      if (progressionWeeks !== undefined || speedRange !== undefined) {
        return optimizeGcdCore(createGcdOptimizationInput(
          self,
          targetGcd,
          mode,
          candidateGearIds,
          progressionWeeks,
          speedRange,
        )) as GcdOptimizationResult;
      }
      return optimizeGcdForStore(self, targetGcd, mode, candidateGearIds);
    },
    optimizeGcdAsync(
      targetGcd: number,
      mode: GcdOptimizationMode,
      candidateGearIds?: G.GearId[],
      progressionWeeks?: number,
      speedRange?: GcdOptimizationSpeedRange,
    ): Promise<GcdOptimizationResult> {
      if (self.job === undefined) return Promise.resolve({ status: 'error', message: '请先选择职业。' });
      if (self.loadingStatus !== 'ready') return Promise.resolve({ status: 'error', message: '装备数据仍在加载。' });
      const input = createGcdOptimizationInput(
        self,
        targetGcd,
        mode,
        candidateGearIds,
        progressionWeeks,
        speedRange,
      );
      console.log('optimizeGcdAsync params:', JSON.stringify(input));
      return optimizeGcdInWorker(input) as Promise<GcdOptimizationResult>;
    },
    cancelGcdOptimization(): void {
      cancelGcdOptimizationInWorker();
    },
    optimizeProductionMateria(targets: G.Stats): ProductionMateriaOptimizationResult {
      const input = createProductionMateriaOptimizationInput(self, targets);
      if (isProductionMateriaResult(input)) return input;
      return optimizeProductionMateria(input);
    },
    optimizeProductionMateriaAsync(targets: G.Stats): Promise<ProductionMateriaOptimizationResult> {
      const input = createProductionMateriaOptimizationInput(self, targets);
      if (isProductionMateriaResult(input)) return Promise.resolve(input);
      return optimizeProductionMateriaInWorker(input);
    },
    cancelProductionMateriaOptimization(): void {
      cancelProductionMateriaOptimizationInWorker();
    },
    applyProductionMateriaOptimization(result: ProductionMateriaOptimizationResult): void {
      if (result.status !== 'ok') return;
      for (const gearPlan of result.plan) {
        const gear = self.gears.get(gearPlan.gearId.toString()) as IGear | undefined;
        if (gear === undefined) continue;
        for (let i = 0; i < gear.materias.length; i++) {
          gear.materias[i].meld(gearPlan.materias[i].stat, gearPlan.materias[i].grade);
        }
      }
    },
    applyGcdOptimization(result: GcdOptimizationResult): void {
      if (result.status !== 'ok') return;
      for (const gearPlan of result.plan) {
        let gear = self.gears.get(gearPlan.gearId.toString()) as IGear | undefined;
        if (gear === undefined) {
          self.gears.put(GearUnion.create({ id: gearPlan.gearId }));
          gear = self.gears.get(gearPlan.gearId.toString()) as IGear;
        }
        if (result.mode === 'all') {
          self.equippedGears.set(gearPlan.slot.toString(), gear);
        }
        if (gearPlan.materias === undefined) continue;
        for (let i = 0; i < gearPlan.materias.length && i < gear.materias.length; i++) {
          const materia = gear.materias[i];
          const materiaPlan = gearPlan.materias[i];
          materia.stat = materiaPlan.stat;
          materia.grade = materiaPlan.grade;
        }
      }
      if (result.foodId === undefined) {
        self.equippedGears.delete('-1');
      } else {
        let food = self.gears.get(result.foodId.toString()) as IFood | undefined;
        if (food === undefined) {
          self.gears.put(GearUnion.create({ id: result.foodId }));
          food = self.gears.get(result.foodId.toString()) as IFood;
        }
        self.equippedGears.set('-1', food);
      }
    },
    clearMaterias(slots?: number[]): void {
      const slotSet = slots === undefined ? undefined : new Set(slots);
      for (const [ slot, gear ] of self.equippedGears.entries()) {
        if (gear === undefined || gear.isFood) continue;
        if (slotSet !== undefined && !slotSet.has(Number(slot))) continue;
        for (const materia of gear.materias) {
          materia.stat = undefined;
          materia.grade = undefined;
        }
      }
    },
    toggleShowAllMaterias(): void {
      self.showAllMaterias = !self.showAllMaterias;
    },
    toggleShowAllFoods(): void {
      self.showAllFoods = !self.showAllFoods;
    },
    toggleShowAllPotions(): void {
      self.showAllPotions = !self.showAllPotions;
    },
    toggleDuplicateToolMateria(): void {
      self.duplicateToolMateria = !self.duplicateToolMateria;
    },
    startEditing(): void {
      self.mode = 'edit';
      let minLevel = Infinity;
      let maxLevel = -Infinity;
      for (const slot of self.schema.slots) {
        const gear = self.equippedGears.get(slot.slot.toString());
        if (gear !== undefined && slot.levelWeight !== 0 && gear.id !== 17726) {  // 17726: Spearfishing Gig
          if (gear.level < minLevel) minLevel = gear.level;
          if (gear.level > maxLevel) maxLevel = gear.level;
        }
      }
      self.minLevel = minLevel;
      self.maxLevel = maxLevel;
      self.minLevelIncoming = undefined;
      self.maxLevelIncoming = undefined;
    },
    equip(gear: IGearUnion): void {
      const key = gear.slot.toString();
      if (self.equippedGears.get(key) === gear) {
        self.equippedGears.delete(key);
      } else {
        self.equippedGears.set(key, gear);
      }
    },
    setClan(clan: number): void {
      self.clan = clan;
      localStorage.setItem(clanStorageKey, clan.toString());
    },
    toggleTiersShown(): void {
      self.tiersShown = !self.tiersShown;
      localStorage.setItem(tiersShownStorageKey, self.tiersShown.toString());
    },
    autoSelect(): void {
      if (self.loadingStatus === 'loading') return;
      if (!self.autoSelectScheduled) return;
      self.autoSelectScheduled = false;
      for (const [ slot, gears ] of Object.entries(self.groupedGears)) {
        if (self.equippedGears.get(slot) !== undefined) continue;
        let lastMeldable = gears[gears.length - 1];
        if (lastMeldable === undefined || lastMeldable.isFood || lastMeldable.slot === 17) continue;
        for (let i = gears.length - 1; i >= 0; i--) {
          if ((gears[i] as IGear).materiaAdvanced) {
            lastMeldable = gears[i];
            break;
          }
        }
        if (!lastMeldable.isEquipped) {
          this.equip(lastMeldable);
        }
      }
    },
    unprotect(): void {
      mst.unprotect(self);
    },
  }))
  .actions(self => ({
    afterCreate(): void {
      for (const gearId of Object.values(self.equippedGears.toJSON())) {
        loadGearDataOfGearId(Math.abs(gearId as G.GearId));
      }
      self.submitIncomingLevels();  // if user refreshs during appending, we should switch to hard loading
      mobx.autorun(() => loadGearDataOfLevelRange(self.minLevel, self.maxLevel));
      mobx.autorun(() => {
        if (self.minLevelIncoming !== undefined || self.maxLevelIncoming !== undefined) {
          loadGearDataOfLevelRange(
            self.minLevelIncoming ?? self.minLevel,
            self.maxLevelIncoming ?? self.maxLevel,
          );
          mobx.when(() => !gearDataLoading.get(), self.submitIncomingLevels);
        }
      });
      mobx.reaction(() => self.filteredIds, self.createGears, { fireImmediately: true });
      mobx.reaction(() => self.autoSelectScheduled && self.groupedGears, self.autoSelect);
    },
  }));

export interface IStore extends mst.Instance<typeof Store> {}
