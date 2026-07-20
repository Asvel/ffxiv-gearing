import * as G from '../game';
import type { EquippedEffects } from './gcdOptimizationTypes';

export function floor(value: number): number {
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
  while (calcGcd(high, jobLevel, statModifiers) > targetGcd && high < 100000) high *= 2;
  if (high >= 100000 && calcGcd(high, jobLevel, statModifiers) > targetGcd) return Infinity;
  while (low < high) {
    const mid = floor((low + high) / 2);
    if (calcGcd(mid, jobLevel, statModifiers) <= targetGcd) high = mid;
    else low = mid + 1;
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
