export type GearId = number & { readonly brand: unique symbol };

export interface GearBase {
  id: GearId,
  name: string,
  level: number,
  slot: number,
  jobCategory: number,
  stats: Stats,
}
export interface Gear extends GearBase {
  role: number,
  materiaSlot: number,
  materiaAdvanced: boolean
  hq: boolean,
}
export interface Food extends GearBase {
  statRates: Stats,
  statMain: Stat,
}

export interface Gearset {
  job: Job,
  level: number,
  gears: {
    id: GearId,
    materias: ([Stat, MateriaGrade] | null)[]
  }[],
}

export const statNames = {
  STR: '力量',
  DEX: '灵巧',
  INT: '智力',
  MND: '精神',
  VIT: '耐力',
  CRT: '暴击',
  DHT: '直击',
  DET: '信念',
  SKS: '技速',
  SPS: '咏唱',
  TEN: '坚韧',
  PIE: '信仰',
  CMS: '作业精度',
  CRL: '加工精度',
  CP: '制作力',
  GTH: '获得力',
  PCP: '鉴别力',
  GP: '采集力',
  PDMG: '物理基本性能',
  MDMG: '魔法基本性能',
  DLY: '攻击间隔',
};
export type Stat = keyof typeof statNames;
export type Stats = { [index in Stat]?: number };

const levelCaps = require('../data/levelCaps').default as { [index in Stat | 'level']: number[] };
const slotCaps = require('../data/slotCaps').default as { [index in Stat]: number[] };
const roleCaps = { VIT: [90,100,100,100,100,90,90,100,90,100,100,100,100] } as { [index in Stat]?: number[] };
const levelCapsIndex: { [index: number]: number } = {};
levelCaps.level.forEach((level, i) => levelCapsIndex[level] = i);
const capsCache: { [index: string]: Stats } = {};
export function getCaps(gear: Gear): Stats {
  let { level, slot, role } = gear;
  let cacheKey = `${level},${slot}`;
  if (!(cacheKey in capsCache)) {
    let caps: Stats = {};
    for (const stat of Object.keys(statNames) as Stat[]) {
      caps[stat] = (stat === 'PDMG' || stat === 'MDMG' || stat === 'DLY') ? Infinity : Math.round(
        levelCaps[stat][levelCapsIndex[level]] *
        slotCaps[stat][slot] *
        (roleCaps[stat]?.[role] ?? 100) /
        10000);
    }
    capsCache[cacheKey] = caps;
  }
  return capsCache[cacheKey];
}

const statSchemas: { [index: string]: Stat[] } = {
  tank: ['STR', 'CRT', 'DET', 'DHT', 'SKS', 'TEN', 'VIT'],
  healer: ['MND', 'CRT', 'DET', 'DHT', 'SPS', 'PIE', 'VIT'],
  dpsStr: ['STR', 'CRT', 'DET', 'DHT', 'SKS', 'VIT'],
  dpsDex: ['DEX', 'CRT', 'DET', 'DHT', 'SKS', 'VIT'],
  dpsInt: ['INT', 'CRT', 'DET', 'DHT', 'SPS', 'VIT'],
  hand: ['CMS', 'CRL', 'CP'],
  land: ['GTH', 'PCP', 'GP'],
};

interface SlotSchema {
  slot: number,
  name: string,
  levelWeight?: number,
}
const commonSlotSchema: SlotSchema[] = [
  { slot: 3, name: '头部防具' },
  { slot: 4, name: '身体防具' },
  { slot: 5, name: '手部防具' },
  { slot: 6, name: '腰部防具' },
  { slot: 7, name: '腿部防具' },
  { slot: 8, name: '脚部防具' },
  { slot: 9, name: '耳饰' },
  { slot: 10, name: '项链' },
  { slot: 11, name: '手镯' },
  { slot: 12, name: '戒指' },
  { slot: -12, name: '戒指' },
  { slot: -1, name: '食物', levelWeight: 0 },
];
const battleJobSlotSchema = ([{ slot: 13, name: '武器', levelWeight: 2 }] as SlotSchema[]).concat(commonSlotSchema);
export type Slot = (typeof commonSlotSchema)[number];

export const baseStats: { [index in Stat]?: 'main' | 'sub' | number } = {
  STR: 'main',
  DEX: 'main',
  INT: 'main',
  MND: 'main',
  VIT: 'main',
  CRT: 'sub',
  DHT: 'sub',
  DET: 'main',
  SKS: 'sub',
  SPS: 'sub',
  TEN: 'sub',
  PIE: 'main',
  CP: 180,
  GP: 400,
};

export const jobSchemas = {
  PLD: {
    name: '骑士',
    stats: statSchemas.tank,
    slots: ([{ slot: 1, name: '武器' }, { slot: 2, name: '盾牌' }] as SlotSchema[]).concat(commonSlotSchema),
    statModifiers: { STR: 100, VIT: 110, hp: 120, ap: 115 },
    mainStat: 'VIT',
    traitDamageMultiplier: 1,
  },
  WAR: {
    name: '战士',
    stats: statSchemas.tank,
    slots: battleJobSlotSchema,
    statModifiers: { STR: 105, VIT: 110, hp: 125, ap: 115 },
    mainStat: 'VIT',
    traitDamageMultiplier: 1,
  },
  DRK: {
    name: '暗黑骑士',
    stats: statSchemas.tank,
    slots: battleJobSlotSchema,
    statModifiers: { STR: 105, VIT: 110, hp: 120, ap: 115 },
    mainStat: 'VIT',
    traitDamageMultiplier: 1,
  },
  GNB: {
    name: '绝枪战士',
    stats: statSchemas.tank,
    slots: battleJobSlotSchema,
    statModifiers: { STR: 100, VIT: 110, hp: 120, ap: 115 },
    mainStat: 'VIT',
    traitDamageMultiplier: 1,
  },
  WHM: {
    name: '白魔法师',
    stats: statSchemas.healer,
    slots: battleJobSlotSchema,
    statModifiers: { MND: 115, VIT: 100, hp: 105, ap: 165 },
    mainStat: 'MND',
    traitDamageMultiplier: 1.3,
  },
  SCH: {
    name: '学者',
    stats: statSchemas.healer,
    slots: battleJobSlotSchema,
    statModifiers: { MND: 115, VIT: 100, hp: 105, ap: 165 },
    mainStat: 'MND',
    traitDamageMultiplier: 1.3,
  },
  AST: {
    name: '占星术士',
    stats: statSchemas.healer,
    slots: battleJobSlotSchema,
    statModifiers: { MND: 115, VIT: 100, hp: 105, ap: 165 },
    mainStat: 'MND',
    traitDamageMultiplier: 1.3,
  },
  MNK: {
    name: '武僧',
    stats: statSchemas.dpsStr,
    slots: battleJobSlotSchema,
    statModifiers: { STR: 110, VIT: 100, hp: 110, ap: 165 },
    mainStat: 'STR',
    traitDamageMultiplier: 1,
  },
  DRG: {
    name: '龙骑士',
    stats: statSchemas.dpsStr,
    slots: battleJobSlotSchema,
    statModifiers: { STR: 115, VIT: 105, hp: 115, ap: 165 },
    mainStat: 'STR',
    traitDamageMultiplier: 1,
  },
  NIN: {
    name: '忍者',
    stats: statSchemas.dpsDex,
    slots: battleJobSlotSchema,
    statModifiers: { DEX: 110, VIT: 100, hp: 108, ap: 165 },
    mainStat: 'DEX',
    traitDamageMultiplier: 1,
  },
  SAM: {
    name: '武士',
    stats: statSchemas.dpsStr,
    slots: battleJobSlotSchema,
    statModifiers: { STR: 112, VIT: 100, hp: 109, ap: 165 },
    mainStat: 'STR',
    traitDamageMultiplier: 1,
  },
  BRD: {
    name: '吟游诗人',
    stats: statSchemas.dpsDex,
    slots: battleJobSlotSchema,
    statModifiers: { DEX: 115, VIT: 100, hp: 105, ap: 165 },
    mainStat: 'DEX',
    traitDamageMultiplier: 1.2,
  },
  MCH: {
    name: '机工士',
    stats: statSchemas.dpsDex,
    slots: battleJobSlotSchema,
    statModifiers: { DEX: 115, VIT: 100, hp: 105, ap: 165 },
    mainStat: 'DEX',
    traitDamageMultiplier: 1.2,
  },
  DNC: {
    name: '舞者',
    stats: statSchemas.dpsDex,
    slots: battleJobSlotSchema,
    statModifiers: { DEX: 115, VIT: 100, hp: 105, ap: 165 },
    mainStat: 'DEX',
    traitDamageMultiplier: 1.2,
  },
  BLM: {
    name: '黑魔法师',
    stats: statSchemas.dpsInt,
    slots: battleJobSlotSchema,
    statModifiers: { INT: 115, VIT: 100, hp: 105, ap: 165 },
    mainStat: 'INT',
    traitDamageMultiplier: 1.3,
  },
  SMN: {
    name: '召唤师',
    stats: statSchemas.dpsInt,
    slots: battleJobSlotSchema,
    statModifiers: { INT: 115, VIT: 100, hp: 105, ap: 165 },
    mainStat: 'INT',
    traitDamageMultiplier: 1.3,
  },
  RDM: {
    name: '赤魔法师',
    stats: statSchemas.dpsInt,
    slots: battleJobSlotSchema,
    statModifiers: { INT: 115, VIT: 100, hp: 105, ap: 165 },
    mainStat: 'INT',
    traitDamageMultiplier: 1.3,
  },
  BLU: {
    name: '青魔法师',
    stats: statSchemas.dpsInt,
    slots: battleJobSlotSchema,
    statModifiers: { INT: 115, VIT: 100, hp: 105, ap: 165 },
    mainStat: 'INT',
    traitDamageMultiplier: 1.3,
  },
};
export type Job = keyof typeof jobSchemas;

export const jobCategories = require('../data/jobCategories').default as { [index in Job]?: boolean }[];

export const statHighlight: { [index in Stat]?: boolean } = {
  PIE: true,
  TEN: true,
  DHT: true,
  CRT: true,
  DET: true,
  SKS: true,
  SPS: true,
};

export const materias: { [index in Stat]?: number[] } = {
  PIE: [1, 2, 3, 6, 11, 40, 20, 60],
  DHT: [2, 4, 6, 9, 12, 40, 20, 60],
  CRT: [2, 4, 6, 9, 12, 40, 20, 60],
  DET: [1, 3, 4, 6, 12, 40, 20, 60],
  SPS: [2, 4, 6, 9, 12, 40, 20, 60],
  SKS: [2, 4, 6, 9, 12, 40, 20, 60],
  TEN: [2, 4, 6, 9, 12, 40, 20, 60],
  CMS: [3, 4, 5, 6, 11, 16, 14, 21],
  CRL: [1, 2, 3, 4, 7, 10, 9, 13],
  CP: [1, 2, 3, 4, 6, 8, 7, 9],
  GTH: [3, 4, 5, 6, 10, 15, 12, 20],
  PCP: [3, 4, 5, 6, 10, 15, 12, 20],
  GP: [1, 2, 3, 4, 6, 8, 7, 9],
};
export type MateriaGrade = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
export const materiaGrades: MateriaGrade[] = [8, 7, 6, 5, 4, 3, 2, 1];
export const materiaGradesAdvanced: MateriaGrade[] = [7, 5, 4, 3, 2, 1];

export const levelModifiers = {
  50: { main: 202, sub: 341, div: 341, hp: 1700, vit: 10.2, vitTank: 14.5 },
  60: { main: 218, sub: 354, div: 858, hp: 2600, vit: 15.4, vitTank: 20.5 },
  70: { main: 292, sub: 364, div: 2170, hp: 3600, vit: 15.9, vitTank: 21.5 },
  80: { main: 340, sub: 380, div: 3300, hp: 4400, vit: 22.1, vitTank: 31.5 },
};

export const races = [
  '人族',
  '精灵族',
  '拉拉菲尔族',
  '猫魅族',
  '鲁加族',
  '敖龙族',
  '维埃拉族',
  '硌狮族',
];

export const clans = [
  '中原之民', '高地之民',
  '森林之民', '黑影之民',
  '平原之民', '沙漠之民',
  '逐日之民', '护月之民',
  '北洋之民', '红焰之民',
  '晨曦之民', '暮晖之民',
  '掠日之民', '迷踪之民',
  '密林之民', '山林之民',
];

export const clanStats: { [index in Stat]?: number[] } = {
  STR: [22, 23, 20, 20, 19, 19, 22, 19, 22, 20, 19, 23, 23, 23, 20, 19].map(x => x - 20),
  DEX: [19, 20, 23, 20, 23, 21, 23, 22, 19, 18, 22, 20, 17, 17, 23, 20].map(x => x - 20),
  VIT: [20, 22, 19, 19, 19, 18, 20, 18, 23, 23, 19, 22, 23, 23, 18, 19].map(x => x - 20),
  INT: [23, 18, 22, 23, 22, 22, 19, 21, 18, 20, 20, 20, 17, 17, 21, 23].map(x => x - 20),
  MND: [19, 20, 19, 21, 20, 23, 19, 23, 21, 22, 23, 18, 23, 23, 21, 22].map(x => x - 20),
};

export const sources = [
  [18969, 19046, '生产制作'],
  [19203, 19280, '万物神典石'],
  [19281, 19358, '万物神典石'],
  [19359, 19436, '零式德尔塔'],
  [19437, 19498, '普通德尔塔'],
  [19499, 19505, '天书奇谈'],
  [19601, 19726, '生产制作'],
  [19757, 19766, '天书奇谈'],
  [19771, 19786, '讨伐歼灭战'/*豪神*/],
  [19787, 19806, '讨伐歼灭战'/*美神*/],
  [20881, 20922, '团队任务'],
  [20943, 20958, '讨伐歼灭战'/*神龙*/],
  [20959, 20974, '绝境战'/*巴哈姆特*/],
  [21208, 21258, '巧手黄票'],
  [21259, 21273, '大地黄票'],
  [21321, 21398, '虚构神典石'],
  [21399, 21476, '虚构神典石'],
  [21477, 21492, '讨伐歼灭战'/*白虎*/],
  [21493, 21570, '零式西格玛'],
  [21571, 21632, '普通西格玛'],
  [21633, 21694, '迷宫挑战'],
  [21695, 21772, '生产制作'],
  [21804, 21810, '天书奇谈'],
  [21942, 22305, '优雷卡'],
];
