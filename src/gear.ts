export type GearId = number & { readonly brand: unique symbol };

export interface Gear {
  id: GearId,
  name: string,
  level: number,
  slot: number,
  role: number,
  jobs: Job[],
  materiaSlot: number,
  materiaAdvanced: boolean
  stats: Stats,
  hq: boolean,
  source: string,
  external: {
    lodestone: string,
    xivdb: number,
  },
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
  VIT: '耐力',
  INT: '智力',
  MND: '精神',
  PIE: '信仰',
  TEN: '坚韧',
  DHT: '直击',
  CRT: '暴击',
  DET: '信念',
  SKS: '技速',
  SPS: '咏唱',
  CMS: '作业精度',
  CRL: '加工精度',
  CP: '制作力',
  GTH: '获得力',
  PCP: '鉴别力',
  GP: '采集力',
  WPN: '武器基本性能',
  DLY: '攻击间隔',
};
export type Stat = keyof typeof statNames;
export type Stats = { [index in Stat]?: number };

const levelCaps = require('../data/levelCaps.json') as { [index in Stat | 'level']: number[] };
const slotCaps = require('../data/slotCaps.json') as { [index in Stat]: number[] };
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
      caps[stat] = (stat === 'WPN' || stat === 'DLY') ? Infinity : Math.round(
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

// TODO: 改进装备槽的数据结构和匹配逻辑, levelWeight
const commonSlotSchema = [
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
];
const battleJobSlotSchema = [{ slot: 13, name: '武器' }].concat(commonSlotSchema);
export type Slot = (typeof commonSlotSchema)[number];

const commonBaseStats: Stats = {
  PIE: 292,
  TEN: 364,
  DHT: 364,
  CRT: 364,
  DET: 292,
  SKS: 364,
  SPS: 364,
  CP: 180,
  GP: 400,
};

export const jobSchemas = {
  PLD: {
    name: '骑士',
    stats: statSchemas.tank,
    slots: [{ slot: 1, name: '武器' }, { slot: 2, name: '盾牌' }]
      .concat(commonSlotSchema),
    baseStats: Object.assign({ STR: 292, VIT: 369 }, commonBaseStats),
    hpModifier: 120,
    mpModifier: 59,
  },
  WAR: {
    name: '战士',
    stats: statSchemas.tank,
    slots: battleJobSlotSchema,
    baseStats: Object.assign({ STR: 306, VIT: 369 }, commonBaseStats),
    hpModifier: 125,
    mpModifier: 38,
  },
  DRK: {
    name: '暗黑骑士',
    stats: statSchemas.tank,
    slots: battleJobSlotSchema,
    baseStats: Object.assign({ STR: 306, VIT: 369 }, commonBaseStats),
    hpModifier: 120,
    mpModifier: 79,
  },
  WHM: {
    name: '白魔法师',
    stats: statSchemas.healer,
    slots: battleJobSlotSchema,
    baseStats: Object.assign({ MND: 383, VIT: 292 }, commonBaseStats),
    hpModifier: 105,
    mpModifier: 124,
  },
  SCH: {
    name: '学者',
    stats: statSchemas.healer,
    slots: battleJobSlotSchema,
    baseStats: Object.assign({ MND: 383, VIT: 292 }, commonBaseStats),
    hpModifier: 105,
    mpModifier: 119,
  },
  AST: {
    name: '占星术士',
    stats: statSchemas.healer,
    slots: battleJobSlotSchema,
    baseStats: Object.assign({ MND: 383, VIT: 292 }, commonBaseStats),
    hpModifier: 105,
    mpModifier: 124,
  },
  MNK: {
    name: '武僧',
    stats: statSchemas.dpsStr,
    slots: battleJobSlotSchema,
    baseStats: Object.assign({ STR: 369, VIT: 292 }, commonBaseStats),
    hpModifier: 110,
    mpModifier: 43,
  },
  DRG: {
    name: '龙骑士',
    stats: statSchemas.dpsStr,
    slots: battleJobSlotSchema,
    baseStats: Object.assign({ STR: 383, VIT: 306 }, commonBaseStats),
    hpModifier: 115,
    mpModifier: 49,
  },
  NIN: {
    name: '忍者',
    stats: statSchemas.dpsDex,
    slots: battleJobSlotSchema,
    baseStats: Object.assign({ DEX: 369, VIT: 292 }, commonBaseStats),
    hpModifier: 108,
    mpModifier: 48,
  },
  SAM: {
    name: '武士',
    stats: statSchemas.dpsStr,
    slots: battleJobSlotSchema,
    baseStats: Object.assign({ STR: 375, VIT: 292 }, commonBaseStats),
    hpModifier: 109,
    mpModifier: 40,
  },
  BRD: {
    name: '吟游诗人',
    stats: statSchemas.dpsDex,
    slots: battleJobSlotSchema,
    baseStats: Object.assign({ DEX: 383, VIT: 292 }, commonBaseStats),
    hpModifier: 105,
    mpModifier: 79,
  },
  MCH: {
    name: '机工士',
    stats: statSchemas.dpsDex,
    slots: battleJobSlotSchema,
    baseStats: Object.assign({ DEX: 383, VIT: 292 }, commonBaseStats),
    hpModifier: 105,
    mpModifier: 79,
  },
  BLM: {
    name: '黑魔法师',
    stats: statSchemas.dpsInt,
    slots: battleJobSlotSchema,
    baseStats: Object.assign({ INT: 383, VIT: 292 }, commonBaseStats),
    hpModifier: 105,
    mpModifier: 129,
  },
  SMN: {
    name: '召唤师',
    stats: statSchemas.dpsInt,
    slots: battleJobSlotSchema,
    baseStats: Object.assign({ INT: 383, VIT: 292 }, commonBaseStats),
    hpModifier: 105,
    mpModifier: 111,
  },
  RDM: {
    name: '赤魔法师',
    stats: statSchemas.dpsInt,
    slots: battleJobSlotSchema,
    baseStats: Object.assign({ INT: 383, VIT: 292 }, commonBaseStats),
    hpModifier: 105,
    mpModifier: 120,
  },
};
export type Job = keyof typeof jobSchemas;

export const statHighlight: { [index in Stat]?: boolean } = {
  PIE: true,
  TEN: true,
  DHT: true,
  CRT: true,
  DET: true,
  SKS: true,
  SPS: true,
};

export const materias = {
  VIT: [1, 2, 4, 8, 15, 25],
  STR: [1, 2, 4, 7, 15, 25],
  DEX: [1, 2, 4, 7, 15, 25],
  INT: [1, 2, 4, 7, 15, 25],
  MND: [1, 2, 4, 7, 15, 25],
  PIE: [1, 2, 3, 6, 11, 40],
  DHT: [2, 4, 6, 9, 12, 40],
  CRT: [2, 4, 6, 9, 12, 40],
  DET: [1, 3, 4, 6, 12, 40],
  SPS: [2, 4, 6, 9, 12, 40],
  SKS: [2, 4, 6, 9, 12, 40],
  TEN: [2, 4, 6, 9, 12, 40],
  CMS: [3, 4, 5, 6, 11, 16],
  CRL: [1, 2, 3, 4, 7, 10],
  CP: [1, 2, 3, 4, 6, 8],
  GTH: [3, 4, 5, 6, 10, 15],
  PCP: [3, 4, 5, 6, 10, 15],
  GP: [1, 2, 3, 4, 6, 8],
  WPN: [] as number[],
  DLY: [] as number[],
};
export type MateriaGrade = 1 | 2 | 3 | 4 | 5 | 6;

export function isMeldable(stat: Stat, materiaGrade: MateriaGrade, meldSlot: number, gearSlot: number): boolean {
  let isMainStat = stat === 'VIT' || stat === 'STR' || stat === 'DEX' || stat === 'INT' || stat === 'MND';
  return !(isMainStat && meldSlot > gearSlot || materiaGrade >= 6 && meldSlot > gearSlot + 1);
}

export const races = [
  '中原之民', '高地之民',
  '森林之民', '黑影之民',
  '平原之民', '沙漠之民',
  '逐日之民', '护月之民',
  '北洋之民', '红焰之民',
  '晨曦之民', '暮晖之民',
];

export const raceStats: { [index in Stat]?: number[] } = {
  STR: [22, 23, 20, 20, 19, 19, 22, 19, 22, 20, 19, 23].map(x => x - 20),
  DEX: [19, 20, 23, 20, 23, 21, 23, 22, 19, 18, 22, 20].map(x => x - 20),
  VIT: [20, 22, 19, 19, 19, 18, 20, 18, 23, 23, 19, 22].map(x => x - 20),
  INT: [23, 18, 22, 23, 22, 22, 19, 21, 18, 20, 20, 20].map(x => x - 20),
  MND: [19, 20, 19, 21, 20, 23, 19, 23, 21, 22, 23, 18].map(x => x - 20),
};

export const statEffect = {
  crtRate: (CRT: number) => ((Math.floor(200 * (CRT - 364) / 2170)) / 10 + 5).toFixed(1),
  crtDamage: (CRT: number) => ((Math.floor(200 * (CRT - 364) / 2170)) / 1000 + 1.4).toFixed(3),
  detDamage: (DET: number) => ((Math.floor(130 * (DET - 292) / 2170)) / 1000 + 1).toFixed(3),
  dhtRate: (DHT: number) => ((Math.floor(550 * (DHT - 364) / 2170)) / 10).toFixed(1),
  tenDamage: (DET: number) => ((Math.floor(100 * (DET - 364) / 2170)) / 1000 + 1).toFixed(3),
  gcd: (SS: number) => (Math.floor((1 - (Math.floor(130 * (SS - 364) / 2170)) / 1000) * 250) / 100).toFixed(2),
  ssDamage: (SS: number) => ((Math.floor(130 * (SS - 364) / 2170)) / 1000 + 1).toFixed(3),
  hp: (VIT: number, JobMod: number) => (36 * JobMod + Math.floor(21.5 * (VIT - 292))).toFixed(0),
  mp: (PIE: number, JobMod: number) => Math.floor((6000 * (PIE - 292) / 2170 + 12000) / 100 * JobMod).toFixed(0),
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
