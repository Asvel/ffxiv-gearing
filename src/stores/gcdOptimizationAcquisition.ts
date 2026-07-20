export type GearAcquisitionKind = 'tomestone' | 'augmentedTomestone' | 'raid' | 'other';

export interface GearAcquisitionPolicy {
  kind: GearAcquisitionKind,
  ringExclusivityGroup?: Exclude<GearAcquisitionKind, 'other'>,
  tomestoneCost: number,
  raidCost: number,
}

interface GearAcquisitionRule {
  kind: Exclude<GearAcquisitionKind, 'other'>,
  sourcePrefix: string,
  ringExclusive: boolean,
}

const acquisitionRules: readonly GearAcquisitionRule[] = [
  { kind: 'tomestone', sourcePrefix: '点数/', ringExclusive: true },
  { kind: 'augmentedTomestone', sourcePrefix: '点数强化/', ringExclusive: true },
  { kind: 'raid', sourcePrefix: '大型任务/', ringExclusive: false },
  { kind: 'raid', sourcePrefix: '零式/', ringExclusive: true },
];

const tomestoneCostsBySlot: Readonly<Record<number, number>> = {
  3: 495,
  4: 825,
  5: 495,
  7: 825,
  8: 495,
  9: 375,
  10: 375,
  11: 375,
  12: 375,
};

const raidCostsBySlot: Readonly<Record<number, number>> = {
  3: 2,
  4: 4,
  5: 2,
  7: 4,
  8: 2,
  9: 1,
  10: 1,
  11: 1,
  12: 1,
};

export const progressionBudget = {
  tomestonesPerWeek: 450,
  raidTokensPerWeek: 4,
  pointWeaponCost: 500,
} as const;

/** Unknown or renamed sources are deliberately treated as repeatable, zero-cost gear. */
export function getGearAcquisitionPolicy(
  source: string | undefined,
  slot: number,
  isWeapon: boolean,
  isChargedPointWeapon: boolean,
): GearAcquisitionPolicy {
  const rule = acquisitionRules.find(candidate => source?.startsWith(candidate.sourcePrefix));
  if (rule === undefined) return { kind: 'other', tomestoneCost: 0, raidCost: 0 };
  const absoluteSlot = Math.abs(slot);
  const tomestoneCost = rule.kind === 'tomestone'
    ? isWeapon ? isChargedPointWeapon ? progressionBudget.pointWeaponCost : 0 : tomestoneCostsBySlot[absoluteSlot] ?? 0
    : 0;
  const raidCost = rule.kind === 'raid' ? raidCostsBySlot[absoluteSlot] ?? 0 : 0;
  return {
    kind: rule.kind,
    ringExclusivityGroup: rule.ringExclusive ? rule.kind : undefined,
    tomestoneCost,
    raidCost,
  };
}
