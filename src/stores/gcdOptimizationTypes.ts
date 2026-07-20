import type * as G from '../game';

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
  /** Used by deterministic regression tests and diagnostics; production callers should keep `auto`. */
  searchStrategy?: 'auto' | 'exact',
  speedRange?: GcdOptimizationSpeedRange,
  progressionWeeks?: number,
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
