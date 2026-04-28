/* eslint-disable no-debugger, no-return-assign, array-callback-return */
/* eslint no-implicit-coercion: ['error', { number: false }] */
import fs from 'node:fs';
import JSON5 from 'json5';
import Papa from 'papaparse';
import type * as G from '../src/game.ts';

declare function Boolean<T>(value: T | undefined): value is T;

process.chdir(import.meta.dirname);

function stringify(obj: any) {
  return `export default ${JSON5.stringify(obj, null, 2)};`;
}

function loadExd(filename: string) {
  const data = Papa.parse<string[]>(fs.readFileSync('./in/' + filename, 'utf8')).data;
  const fields = data[0];
  return data.slice(1, -1).map(line => {
    const ret: Record<string, string> = {};
    for (let i = 0; i < line.length; i++) {
      if (fields[i] !== '') {
        ret[fields[i]] = line[i];
      }
      ret[i] = line[i];
    }
    return ret;
  });
}

const statAbbrs: Record<string, G.Stat> = {
  1: 'STR', 2: 'DEX', 4: 'INT', 5: 'MND', 3: 'VIT',
  27: 'CRT', 22: 'DHT', 44: 'DET', 45: 'SKS', 46: 'SPS', 19: 'TEN', 6: 'PIE',
  70: 'CMS', 71: 'CRL', 11: 'CP',
  72: 'GTH', 73: 'PCP', 10: 'GP',
  12: 'PDMG', 13: 'MDMG',
  55: 'main', 56: 'secondary',
};

const jobs: G.Job[] = [
  'PLD', 'WAR', 'DRK', 'GNB',
  'WHM', 'SCH', 'AST', 'SGE',
  'MNK', 'DRG', 'NIN', 'SAM', 'RPR', 'VPR',
  'BRD', 'MCH', 'DNC',
  'BLM', 'SMN', 'RDM', 'PCT', 'BLU',
  'CRP', 'BSM', 'ARM', 'GSM', 'LTW', 'WVR', 'ALC', 'CUL',
  'MIN', 'BTN', 'FSH',
];

const sourceOfId: Record<number, string | undefined> = {};
{
  const sourcesLines = fs.readFileSync('./in/sources.txt', 'utf8').split(/\r?\n/);
  let source: string | undefined;
  for (let line of sourcesLines) {
    if (line === '') {
      source = undefined;
      continue;
    }
    line = line.replace(/\s*[#@].*/, '');
    if (source === undefined) {
      source = line;
      continue;
    }
    const parts = line.split('-');
    const begin = +parts[0];
    const end = +parts.at(-1)!;
    for (let i = begin; i <= end; i++) {
      if (i in sourceOfId) throw Error(`装备 ${i} 来源存在冲突。`);
      sourceOfId[i] = source;
    }
  }
}

const BaseParam = loadExd('BaseParam.csv');
const ClassJobCategory = loadExd('ClassJobCategory.csv');
const ContentFinderCondition = loadExd('ContentFinderCondition.csv');
const Item = loadExd('Item.csv');
const ItemAction = loadExd('ItemAction.csv');
const ItemFood = loadExd('ItemFood.csv');
const ItemLevel = loadExd('ItemLevel.csv');

const slotComposite: Record<number, number[]> = {
  15: [4, 3],
  16: [4, 5, 7, 8],
  // 17: 职业水晶
  18: [7, 8],
  19: [4, 3, 5, 7, 8],
  20: [4, 5, 7],
  21: [4, 7, 8],
  22: [4, 5],
};

const jobCategories = ClassJobCategory.map(line => {
  const ret: Partial<Record<G.Job, true>> = {};
  for (const classjob of jobs) {
    if (line[classjob] === 'True') {
      ret[classjob] = true;
    }
  }
  return ret;
});
jobCategories[2] = { PLD: true, WAR: true, DRK: true, GNB: true, MNK: true, DRG: true, SAM: true, RPR: true };
const jobCategoryOfMainStats: Record<string, number> = {
  'STR': 2,
  'DEX': 105,
  'INT': 63,
  'MND': 64,
  'STR,DEX': 30,
  'INT,MND': 31,
};

const lodestoneIds = [undefined, ...fs.readFileSync('./in/lodestone-item-id.txt', 'utf8')
  .split(/\r?\n/).map(x => x || undefined)];

const slotsUsed: true[] = [];
const jobCategoriesUsed: Partial<Record<G.Job, true>>[] = [];
const levelsUsed: Record<number, true> = {};
const lodestoneIdsUsed: (string | undefined)[] = [];
const sourcesMissing: Record<string, string> = {};

const gears = Item
  .map(x => {
    if (x['ClassJobCategory'] === '0') return;

    const ret = {} as G.Gear;
    ret.id = +x['#'] as G.GearId;
    ret.name = x['Name'];
    ret.level = +x['LevelItem'];
    ret.rarity = +x['Rarity'];
    ret.slot = +x['EquipSlotCategory'];
    if (ret.slot in slotComposite) {
      ret.rawSlot = ret.slot;
      // ret.occupiedSlots = slotComposite[ret.slot].slice(1);
      ret.slot = slotComposite[ret.slot][0];
    }
    ret.role = +x['BaseParamModifier'];
    ret.jobCategory = +x['ClassJobCategory'];
    ret.equipLevel = +x['LevelEquip'];
    // ret.equipLevelVariable = x['Description'] === 'IL and attributes synced to current job level.'
    ret.equipLevelVariable = x['Description'] === '此装备的品级与附加的属性数值会随着装备时的等级发生变化。'
      ? true : undefined;  // FIXME: 是否有更标识字段的判定方式
    ret.materiaSlot = +x['MateriaSlotCount'];
    ret.materiaAdvanced = x['IsAdvancedMeldingPermitted'] === 'True' ? true : undefined;
    ret.stats = {};
    ret.hq = x['CanBeHq'] === 'True' ? true : undefined;
    ret.source = sourceOfId[ret.id];
    ret.obsolete = (ret.rarity === 7 && ret.source !== '危命任务' && !(ret.slot >= 9 && ret.slot <= 12)) ||
      ret.source?.endsWith('已废弃') || ret.source === '旧空岛' ? true : undefined;

    // stats
    const rawStats: Record<string, number> = {};
    for (let i = 0; i < 6; i++) {
      rawStats[x[`BaseParam[${i}]`]] ??= 0;
      rawStats[x[`BaseParam[${i}]`]] += +x[`BaseParamValue[${i}]`];
      if (ret.hq) {  // 可 HQ 装备的 BaseParamSpecial 为 HQ 附加值
        rawStats[x[`BaseParamSpecial[${i}]`]] ??= 0;
        rawStats[x[`BaseParamSpecial[${i}]`]] += +x[`BaseParamValueSpecial[${i}]`];
      }
    }
    rawStats[12] = (rawStats[12] ?? 0) + +x['DamagePhys'];
    rawStats[13] = (rawStats[13] ?? 0) + +x['DamageMag'];
    for (const [ k, v ] of Object.entries(rawStats)) {
      if (v >= 0 && k in statAbbrs && k !== '12' && k !== '13') {
        ret.stats[statAbbrs[k]] = v;
      }
    }
    if (ret.rarity === 4 && ret.level > 1 && 'VIT' in ret.stats && Object.keys(ret.stats).length === 2) {
      ret.customizable = true;
    }
    if (rawStats[12] > 0 && ('STR' in ret.stats || 'DEX' in ret.stats)) {
      ret.stats['PDMG'] = rawStats[12];
      ret.stats['DLY'] = +x['Delayms'];  // 攻击间隔不会有 HQ 附加值
    }
    if (rawStats[13] > 0 && ('INT' in ret.stats || 'MND' in ret.stats)) {
      ret.stats['MDMG'] = rawStats[13];
    }
    if (ret.slot === 13 && ret.jobCategory === 129) {  // 青魔武器没有属性
      ret.stats['MDMG'] = rawStats[13];
    }
    if (Object.keys(ret.stats).length === 0) return;

    if (x['ItemSpecialBonus'] === '9' || x['ItemSpecialBonus'] === '10') {  // 新月岛补正
      ret.occultStats = {};
      for (let i = 0; i < 6; i++) {
        const stat = statAbbrs[x[`BaseParamSpecial[${i}]`]];
        if (stat !== undefined) {
          ret.occultStats[stat] = +x[`BaseParamValueSpecial[${i}]`];
        }
      }
    }

    // jobCategory
    if ((ret.jobCategory === 1 || ret.jobCategory === 34 || ret.jobCategory === 30 || ret.jobCategory === 31) &&
        !('main' in ret.stats)) {
      const existMainStats = ['STR', 'DEX', 'INT', 'MND'].filter(x => x in ret.stats).join(',');
      if (existMainStats !== '') {
        ret.jobCategory = jobCategoryOfMainStats[existMainStats] ?? 34;
      } else {
        const craft = 'CMS' in ret.stats || 'CRL' in ret.stats || 'CP' in ret.stats;
        const gather = 'GTH' in ret.stats || 'PCP' in ret.stats || 'GP' in ret.stats;
        if (craft && !gather) ret.jobCategory = 33;
        if (!craft && gather) ret.jobCategory = 32;
        if (craft && gather) ret.jobCategory = 35;
        if (!craft && !gather) ret.jobCategory = 34;
      }
    }
    if (ret.jobCategory === 63 && ret.equipLevel > 80) {  // 青魔并不能装备高等级装备
      ret.jobCategory = 147;
    }

    if (ret.source?.startsWith('巧手大地')) {
      const craft = 'CMS' in ret.stats || 'CRL' in ret.stats || 'CP' in ret.stats;
      ret.source = (craft ? '巧手' : '大地') + ret.source.slice(4);
    }

    slotsUsed[ret.rawSlot ?? ret.slot] = true;
    jobCategoriesUsed[ret.jobCategory] = jobCategories[ret.jobCategory];
    levelsUsed[ret.level] = true;
    lodestoneIdsUsed[ret.id] = lodestoneIds[ret.id];
    if (ret.source === undefined && ret.slot !== 17 && ret.equipLevel >= 50) {
      sourcesMissing[ret.id] = `${ret.level}${ret.hq ? 'HQ' : ''}  ${ret.name}`;
    }
    return ret;
  })
  .filter(Boolean)
  .sort((a, b) => {
    const k = a.level - b.level;
    return k !== 0 ? k : a.id - b.id;
  });

const jobCategoryMap = Object.fromEntries(jobCategoriesUsed
  .map((x, i) => [Object.keys(x).sort().join(','), i]).filter(Boolean));
const foods = Item
  .map(x => {
    const itemAction = ItemAction[+x['ItemAction']];
    const actionType = +itemAction['Action'];
    const isFood = actionType === 844 || actionType === 845;  // 844=战斗食物, 845=生产采集食物
    const isPotion = actionType === 846;  // 846=加属性值的药水
    if (!(isFood || isPotion) || x['CanBeHq'] !== 'True') return;
    const itemFood = ItemFood[+itemAction['Data[1]']];

    const ret = {} as G.Food;
    ret.id = +x['#'] as G.GearId;
    ret.name = x['Name'];
    ret.level = +x['LevelItem'];
    ret.slot = isFood ? -1 : -2;
    ret.jobCategory = undefined as any;
    ret.stats = {};
    ret.statRates = {};
    ret.statMain = statAbbrs[itemFood['BaseParam[0]']];

    // stats
    for (const i of [0, 1, 2]) {
      const stat = statAbbrs[itemFood[`BaseParam[${i}]`]];
      if (stat !== undefined) {
        if (itemFood[`IsRelative[${i}]`] === 'True') {
          ret.stats[stat] = +itemFood[`MaxHQ[${i}]`];
          ret.statRates[stat] = +itemFood[`ValueHQ[${i}]`];
        } else {
          ret.stats[stat] = +itemFood[`ValueHQ[${i}]`];
        }
      }
    }
    if (Object.keys(ret.stats).length === 0) return;

    // jobCategory
    const jobs: Record<string, true> = {};
    if ('CMS' in ret.stats || 'CRL' in ret.stats || 'CP' in ret.stats) {
      ['CRP', 'BSM', 'ARM', 'GSM', 'LTW', 'WVR', 'ALC', 'CUL'].forEach(j => jobs[j] = true);
    } else {
      if (isPotion) return;
    }
    if ('GTH' in ret.stats || 'PCP' in ret.stats || 'GP' in ret.stats) {
      ['MIN', 'BTN', 'FSH'].forEach(j => jobs[j] = true);
    }
    if ('TEN' in ret.stats) {
      ['PLD', 'WAR', 'DRK', 'GNB'].forEach(j => jobs[j] = true);
    }
    if ('PIE' in ret.stats) {
      ['WHM', 'SCH', 'AST', 'SGE'].forEach(j => jobs[j] = true);
    }
    if (Object.keys(jobs).length === 0) {
      if (!('SPS' in ret.stats)) {
        ['PLD', 'WAR', 'DRK', 'GNB', 'MNK', 'DRG', 'NIN', 'SAM', 'RPR', 'VPR', 'BRD', 'MCH', 'DNC']
          .forEach(j => jobs[j] = true);
      }
      if (!('SKS' in ret.stats)) {
        ['WHM', 'SCH', 'AST', 'SGE', 'BLM', 'SMN', 'RDM', 'PCT', 'BLU'].forEach(j => jobs[j] = true);
      }
    }
    ret.jobCategory = jobCategoryMap[Object.keys(jobs).sort().join(',')];
    if (ret.jobCategory === undefined) debugger;
    lodestoneIdsUsed[ret.id] = lodestoneIds[ret.id];
    // if (!ItemCn[index]?.['Name'] && sourceOfId[ret.id] === undefined) {
    //   sourcesMissing[ret.id] = `food  ${ret.name}`;
    // }
    return ret;
  })
  .filter(Boolean);

const bestFoods: G.Food[] = [];
for (const food of foods.slice().reverse()) {
  if (food.id === 4745) continue;  // 唯一的直击信仰食物，各只加1，应该并不会有人想吃它
  if (!bestFoods.some(bestFood => food.slot === bestFood.slot &&
    Object.keys(food.stats).every(stat => food.stats[stat as G.Stat]! <= bestFood.stats[stat as G.Stat]!))) {
    food.best = true;
    bestFoods.push(food);
  }
}

const syncLevelOfJobLevel: Record<string, number> = {};
for (const x of ContentFinderCondition) {
  const jobLevelRequired = +x['ClassJobLevelRequired'];
  if (jobLevelRequired % 10 === 0 && jobLevelRequired >= 50) {
    syncLevelOfJobLevel[x['ItemLevelRequired']] = jobLevelRequired;
    syncLevelOfJobLevel[x['ItemLevelSync']] = jobLevelRequired;
  }
}
delete syncLevelOfJobLevel['0'];
const syncLevels: Record<number, number[]> = {};
for (const l of Object.keys(syncLevelOfJobLevel).map(Number).sort((a, b) => a - b)) {
  const jobLevel = syncLevelOfJobLevel[l];
  syncLevels[jobLevel] ??= [];
  syncLevels[jobLevel].push(l);
  levelsUsed[l] = true;
}

// 它俩不会被直接算上限
delete statAbbrs[55];
delete statAbbrs[56];

const levelCaps = {
  level: Object.keys(levelsUsed).map(Number).sort((a, b) => a - b),
} as Record<'level' | G.Stat, number[]>;
for (const i of Object.keys(statAbbrs)) {
  levelCaps[statAbbrs[i]] = levelCaps.level.map(l => +ItemLevel[l][i]);
}

delete slotsUsed[0];
const slotCaps = {} as Record<G.Stat, number[]>;
for (const i of Object.keys(statAbbrs)) {
  slotCaps[statAbbrs[i]] = Array.from(slotsUsed, (used, j) => used ? +BaseParam[+i][2 + j] : 0);
}

const roleCaps = {} as Record<G.Stat, number[]>;
for (const i of Object.keys(statAbbrs)) {
  roleCaps[statAbbrs[i]] = Array.from({ length: 13 }, (_, j) => +BaseParam[+i][`MeldParam[${j}]`]);
}

const levelGroupBasis = [
  1, 70, 136,
  210, 255, 271,
  340, 385, 401,
  470, 515, 531,
  600, 645, 661,
  730, 750,
];
const levelGroups: number[] = [];
const levelGroupLast = levelGroupBasis.at(-1)!;
let groupId = 0;
for (let level = 1; level <= levelGroupLast + 200; level++) {
  if (levelGroupBasis.includes(level)){
    groupId = level;
  }
  levelGroups[level] = groupId;
}
const gearGroups: number[] = [];
const groupedGears: G.Gear[][] = [];
for (const gear of gears) {
  let groupId = levelGroups[gear.level];
  if ((gear.id >= 10337 && gear.id <= 10344) || gear.id === 17726) {  // 专家证、渔叉跟随最新分组加载
    groupId = levelGroupLast;
  }
  gearGroups[gear.id] = groupId;
  groupedGears[groupId] ??= [];
  groupedGears[groupId].push(gear);
}

const bluMdmgAdditions = fs.readFileSync('./in/bluMdmgAdditions.txt', 'utf8')
  .trim().split(/\r?\n/).map(Number);


for (const filename of fs.readdirSync('./out')) {
  fs.unlinkSync(`./out/${filename}`);
}

const sourcesMissingIds = Object.keys(sourcesMissing).map(Number).sort((a, b) => a - b);
if (sourcesMissingIds.length > 0) {
  const output = ['-----'];
  sourcesMissingIds.forEach((x, i) => {
    output.push(`${x}  ${sourcesMissing[x]}`);
    if (x + 1 !== sourcesMissingIds[i + 1]) output.push(output[0]);
  });
  fs.writeFileSync('./out/sourcesMissing.txt', output.join('\n'));
}

fs.writeFileSync('./out/gearGroupBasis.js', stringify(levelGroupBasis).replace(/null,/g, ','));
fs.writeFileSync('./out/gearGroups.js', stringify(gearGroups).replace(/null,/g, ','));
for (const groupId of levelGroupBasis) {
  fs.writeFileSync(`./out/gears-${groupId === levelGroupLast ? 'recent' : groupId}.js`,
    stringify(groupedGears[groupId]));
}
fs.writeFileSync('./out/foods.js', stringify(foods));
fs.writeFileSync('./out/jobCategories.js', stringify(jobCategoriesUsed).replace(/null,/g, ','));
fs.writeFileSync('./out/levelCaps.js', stringify(levelCaps));
fs.writeFileSync('./out/slotCaps.js', stringify(slotCaps));
fs.writeFileSync('./out/roleCaps.js', stringify(roleCaps));
fs.writeFileSync('./out/syncLevels.js', stringify(syncLevels).replace(/'/g, ''));
fs.writeFileSync('./out/lodestoneIds.js', stringify(lodestoneIdsUsed).replace(/null,/g, ','));
fs.writeFileSync('./out/bluMdmgAdditions.js', stringify(bluMdmgAdditions));
