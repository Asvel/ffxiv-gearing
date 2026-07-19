import * as G from '../game';

export type GcdOptimizationMode = 'current' | 'all';

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

export interface GcdOptimizationGearInput {
  id: G.GearId,
  slot: number,
  data: G.Gear,
  materias: GcdOptimizationMateriaPlan[],
  customStats?: G.Stats,
}

export interface GcdOptimizationInput {
  mode: GcdOptimizationMode,
  targetGcd: number,
  job: G.Job,
  jobLevel: G.JobLevel,
  syncLevel?: number,
  baseStats: G.Stats,
  currentDamage: number,
  currentFoodId?: G.GearId,
  filteredIds: G.GearId[],
  equippedGearIdsBySlot: [number, G.GearId][],
  gears: GcdOptimizationGearInput[],
  foods: G.Food[],
  fixedConsumables: G.Food[],
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

interface GcdOptimizationContext extends GcdOptimizationInput {
  schema: G.JobSchema,
  gearById: Map<G.GearId, GcdOptimizationGearInput>,
  equippedGearIdBySlot: Map<number, G.GearId>,
}

export const gcdOptimizationMinTargetGcd = 1.80;
export const gcdOptimizationMaxTargetGcd = 2.50;

const gcdOptimizationFrontierLimit = 200000;

function floor(value: number) {
  return Math.trunc(value + 1e-7);
}

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
    (job === 'BLU' ? G.bluMdmgAdditions[(stats.INT ?? 0) - (baseStats.INT ?? 0)] ?? 0 : 0);
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

function getMateriaChangeCost(
  current: GcdOptimizationMateriaPlan[],
  next: GcdOptimizationMateriaPlan[],
): number {
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
): { states: GcdGearState[], customSkipped: boolean } {
  const data = gear.data;
  if (skipUnconfiguredCustomStats && data.customizable && Object.keys(gear.customStats ?? {}).length === 0) {
    return { states: [], customSkipped: true };
  }

  const baseChangeCost = getGearChangeCost(currentGear, gear);
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
      }],
    };
  }

  const candidateMateriaStats = getCandidateMateriaStats(ctx.schema, speedStat);
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
      ctx.schema,
      ctx.jobLevel,
      ctx.syncLevel,
      gear.customStats,
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
  ctx: GcdOptimizationContext,
  speedStat: G.Stat,
  requiredSpeed: number,
  relevantStats: G.Stat[],
): { frontier: GcdCombinedState[], customSkipped: boolean } {
  let frontier: GcdCombinedState[] = [{ stats: ctx.baseStats, plan: [], changeCost: 0 }];
  let customSkipped = false;
  for (const [ slot, gearId ] of ctx.equippedGearIdsBySlot) {
    if (slot === -1 || slot === -2) continue;
    const gear = ctx.gearById.get(gearId);
    if (gear === undefined) continue;
    const { states, customSkipped: skipped } = getGearStates(
      ctx,
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
  ctx: GcdOptimizationContext,
  speedStat: G.Stat,
  requiredSpeed: number,
  relevantStats: G.Stat[],
): { frontier: GcdCombinedState[], customSkipped: boolean, error?: string } {
  let frontier: GcdCombinedState[] = [{ stats: ctx.baseStats, plan: [], changeCost: 0 }];
  let customSkipped = false;
  for (const slot of ctx.schema.slots) {
    if (slot.slot === -1 || slot.slot === -2) continue;
    const gearStates: GcdGearState[] = [];
    for (const gearId of ctx.filteredIds) {
      const gear = ctx.gearById.get(gearId);
      if (gear === undefined || gear.slot !== slot.slot) continue;
      const { states, customSkipped: skipped } = getGearStates(
        ctx,
        gear,
        speedStat,
        requiredSpeed,
        relevantStats,
        getCurrentGearOfSlot(ctx, slot.slot),
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

function getFoodCandidates(ctx: GcdOptimizationContext): (G.Food | undefined)[] {
  const foods: (G.Food | undefined)[] = [undefined, ...ctx.foods];
  foods.sort((a, b) => (a?.id ?? 0) - (b?.id ?? 0));
  return foods;
}

function getFoodChangeCost(ctx: GcdOptimizationContext, food?: G.Food): number {
  return ctx.currentFoodId === food?.id ? 0 : 1;
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
  const foods = getFoodCandidates(ctx);
  for (const state of frontier) {
    for (const food of foods) {
      let finalStats = addStats(state.stats, getFoodEffectiveStats(state.stats, food));
      for (const fixedConsumable of ctx.fixedConsumables) {
        finalStats = addStats(finalStats, getFoodEffectiveStats(state.stats, fixedConsumable));
      }
      const effects = calcEffects(finalStats, ctx.baseStats, ctx.job, ctx.jobLevel, ctx.schema);
      if (effects === undefined) continue;
      if (
        fastest === undefined ||
        effects.gcd < fastest.effects.gcd ||
        (effects.gcd === fastest.effects.gcd && effects.damage > fastest.effects.damage)
      ) {
        fastest = { effects, stats: finalStats };
      }
      if (effects.gcd > ctx.targetGcd) continue;
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

export function optimizeGcd(input: GcdOptimizationInput): GcdOptimizationResult {
  const schema = G.jobSchemas[input.job];
  const ctx: GcdOptimizationContext = {
    ...input,
    schema,
    gearById: new Map(input.gears.map(gear => [ gear.id, gear ])),
    equippedGearIdBySlot: new Map(input.equippedGearIdsBySlot),
  };
  if (
    !Number.isFinite(ctx.targetGcd) ||
    ctx.targetGcd < gcdOptimizationMinTargetGcd ||
    ctx.targetGcd > gcdOptimizationMaxTargetGcd
  ) {
    return { status: 'error', message: `目标 GCD 只能在 ${gcdOptimizationMinTargetGcd.toFixed(2)}s - ${gcdOptimizationMaxTargetGcd.toFixed(2)}s 之间。` };
  }
  const speedStat = getSpeedStat(schema);
  if (schema.mainStat === undefined || speedStat === undefined) {
    return { status: 'error', message: '该职业不支持伤害期望配速优化。' };
  }
  const requiredSpeed = calcRequiredSpeed(ctx.targetGcd, ctx.jobLevel, schema.statModifiers);
  if (requiredSpeed === Infinity) {
    return { status: 'error', message: '目标 GCD 超出可计算范围。' };
  }
  const relevantStats = getRelevantStats(schema, speedStat);
  try {
    const optimization: { frontier: GcdCombinedState[], customSkipped: boolean, error?: string } = ctx.mode === 'current'
      ? createCurrentGearFrontier(ctx, speedStat, requiredSpeed, relevantStats)
      : createAllGearFrontier(ctx, speedStat, requiredSpeed, relevantStats);
    const { frontier, customSkipped, error } = optimization;
    if (error !== undefined) {
      return { status: 'error', message: error };
    }
    return evaluateGcdFrontier(ctx, speedStat, requiredSpeed, frontier, customSkipped);
  } catch (e) {
    return { status: 'error', message: e instanceof Error ? e.message : '计算失败。' };
  }
}
