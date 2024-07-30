/* eslint-disable no-debugger, no-return-assign, array-callback-return */
process.chdir(__dirname);

const fs = require('fs');
const JSON5 = require('json5');
const Papa = require('papaparse');

function stringify(obj) {
  return `export default ${JSON5.stringify(obj, null, 2)};`;
}

function loadExd(filename) {
  const data = Papa.parse(fs.readFileSync('./in/' + filename, 'utf8')).data;
  const fields = data[1];
  return data.slice(3, -1).map(line => {
    const ret = {};
    for (let i = 0; i < line.length; i++) {
      if (fields[i] in ret) console.log(fields[i]);
      ret[fields[i] || i] = line[i];
      ret[i] = line[i];
    }
    return ret;
  });
}

const statAbbrs = {
  1: 'STR', 2: 'DEX', 4: 'INT', 5: 'MND', 3: 'VIT',
  27: 'CRT', 22: 'DHT', 44: 'DET', 45: 'SKS', 46: 'SPS', 19: 'TEN', 6: 'PIE',
  70: 'CMS', 71: 'CRL', 11: 'CP',
  72: 'GTH', 73: 'PCP', 10: 'GP',
  12: 'PDMG', 13: 'MDMG',
};

const jobs = [
  'PLD', 'WAR', 'DRK', 'GNB',
  'WHM', 'SCH', 'AST', 'SGE',
  'MNK', 'DRG', 'NIN', 'SAM', 'RPR', 'VPR',
  'BRD', 'MCH', 'DNC',
  'BLM', 'SMN', 'RDM', 'PCT', 'BLU',
  'CRP', 'BSM', 'ARM', 'GSM', 'LTW', 'WVR', 'ALC', 'CUL',
  'MIN', 'BTN', 'FSH',
];

const patches = {
  data: '7.05',  // 主数据的版本，即国际服游戏版本
  next: '7.0',  // 对国服来说，下一个有装备更新的版本
  current: '6.99',  // 国服当前游戏版本
};

const sourceOfId = {};
const patchOfId = {};
{
  const sourcesLines = fs.readFileSync('./in/sources.txt', 'utf8').split(/\r?\n/);
  let source;
  let patch;
  for (let line of sourcesLines) {
    if (line === '') {
      source = undefined;
      patch = undefined;
      continue;
    }
    const patchMark = /@([\d.]+)/.exec(line)?.[1];
    if (patchMark > patches.current) {
      patch = patchMark;
    }
    line = line.replace(/\s*[#@].*/, '');
    if (source === undefined) {
      source = line;
      continue;
    }
    const parts = line.split('-');
    const begin = Number(parts[0]);
    const end = Number(parts[parts.length - 1]);
    for (let i = begin; i <= end; i++) {
      if (i in sourceOfId) throw Error(`装备 ${i} 来源存在冲突。`);
      sourceOfId[i] = source;
      patchOfId[i] = patch;
    }
  }
}

const BaseParam = loadExd('BaseParam.csv');
const ClassJobCategory = loadExd('ClassJobCategory.csv');
const ContentFinderCondition = loadExd('ContentFinderCondition.csv');
const Item = loadExd('Item.csv');
const ItemCn = loadExd('Item.cn.csv');
const ItemAction = loadExd('ItemAction.csv');
const ItemFood = loadExd('ItemFood.csv');
const ItemLevel = loadExd('ItemLevel.csv');

const slotComposite = {
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
  const ret = {};
  for (const classjob of jobs) {
    if (line[classjob] === 'True') {
      ret[classjob] = true;
    }
  }
  return Object.keys(ret).length > 0 ? ret : undefined;
});
jobCategories[2] = { PLD: true, WAR: true, DRK: true, GNB: true, MNK: true, DRG: true, SAM: true, RPR: true };
const jobCategoryOfMainStats = {
  'STR': 2,
  'DEX': 105,
  'INT': 63,
  'MND': 64,
  'STR,DEX': 30,
  'INT,MND': 31,
};

const lodestoneIds = [undefined, ...fs.readFileSync('./in/lodestone-item-id.txt', 'utf8')
  .split(/\r?\n/).map(x => x || undefined)];

const slotsUsed = [];
const jobCategoriesUsed = [];
const levelsUsed = {};
const lodestoneIdsUsed = [];
const sourcesMissing = {};

const gears = Item
  .map((x, index) => {
    if (jobCategories[x['ClassJobCategory']] === undefined) return;

    const ret = {};
    ret.id = Number(x['#']);
    ret.name = ItemCn[index]?.['Name'] || x['Name'];
    ret.level = Number(x['Level{Item}']);
    ret.rarity = Number(x['Rarity']);
    ret.slot = Number(x['EquipSlotCategory']);
    if (ret.slot in slotComposite) {
      ret.rawSlot = ret.slot;
      // ret.occupiedSlots = slotComposite[ret.slot].slice(1);
      ret.slot = slotComposite[ret.slot][0];
    }
    ret.role = Number(x['BaseParamModifier']);
    ret.jobCategory = Number(x['ClassJobCategory']);
    ret.equipLevel = Number(x['Level{Equip}']);
    ret.materiaSlot = Number(x['MateriaSlotCount']);
    ret.materiaAdvanced = x['IsAdvancedMeldingPermitted'] === 'True' ? true : undefined;
    ret.stats = {};
    ret.hq = x['CanBeHq'] === 'True' ? true : undefined;
    ret.source = sourceOfId[x['#']];
    ret.obsolete = (ret.rarity === 7 && ret.source !== '危命任务' && !(ret.slot >= 9 && ret.slot <= 12)) ||
      ret.source?.endsWith('已废弃') || ret.source === '旧空岛' ? true : undefined;
    ret.patch = patchOfId[x['#']];

    // stats
    const rawStats = {};
    for (let i = 0; i < 6; i++) {
      rawStats[x[`BaseParam[${i}]`]] = (rawStats[x[`BaseParam[${i}]`]] || 0) + Number(x[`BaseParamValue[${i}]`]);
      if (ret.hq) {  // 不能 HQ 的装备 {Special} 属性有值可能是有套装效果
        rawStats[x[`BaseParam{Special}[${i}]`]] = (rawStats[x[`BaseParam{Special}[${i}]`]] ?? 0) +
          Number(x[`BaseParamValue{Special}[${i}]`]);
      }
    }
    rawStats[12] = (rawStats[12] ?? 0) + Number(x['Damage{Phys}']);
    rawStats[13] = (rawStats[13] ?? 0) + Number(x['Damage{Mag}']);
    for (const k of Object.keys(rawStats)) {
      if (rawStats[k] >= 0 && k in statAbbrs && k !== '12' && k !== '13') {
        ret.stats[statAbbrs[k]] = rawStats[k];
      }
    }
    if (ret.rarity === 4 && ret.level > 1 && ret.stats['VIT'] > 0 && Object.keys(ret.stats).length === 2) {
      ret.customizable = true;
    }
    if (rawStats[12] > 0 && ('STR' in ret.stats || 'DEX' in ret.stats)) {
      ret.stats['PDMG'] = rawStats[12];
      ret.stats['DLY'] = Number(x['Delay<ms>']);  // 攻击间隔不会有 HQ 附加值
    }
    if (rawStats[13] > 0 && ('INT' in ret.stats || 'MND' in ret.stats)) {
      ret.stats['MDMG'] = rawStats[13];
    }
    if (ret.slot === 13 && ret.jobCategory === 129) {  // 青魔武器没有属性
      ret.stats['MDMG'] = rawStats[13];
    }
    if (Object.keys(ret.stats).length === 0) return;

    // jobCategory
    if (ret.jobCategory === 1 || ret.jobCategory === 34 || ret.jobCategory === 30 || ret.jobCategory === 31) {
      const existMainStats = ['STR', 'DEX', 'INT', 'MND'].filter(x => x in ret.stats).join(',');
      if (existMainStats !== '') {
        ret.jobCategory = jobCategoryOfMainStats[existMainStats] || 34;
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
  .map((x, index) => {
    const itemAction = ItemAction[x['ItemAction']];
    if ((itemAction['Type'] !== '844' && itemAction['Type'] !== '845') || x['CanBeHq'] !== 'True') return;
    const itemFood = ItemFood[itemAction['Data[1]']];

    const ret = {};
    ret.id = Number(x['#']);
    ret.name = ItemCn[index]?.['Name'] || x['Name'];
    ret.level = Number(x['Level{Item}']);
    ret.slot = -1;
    ret.jobCategory = undefined;
    ret.stats = {};
    ret.statRates = {};
    ret.statMain = statAbbrs[itemFood['BaseParam[0]']];
    ret.patch = patchOfId[x['#']];

    // stats
    for (const i of [0, 1, 2]) {
      const stat = statAbbrs[itemFood[`BaseParam[${i}]`]];
      if (stat !== undefined) {
        if (itemFood[`IsRelative[${i}]`] === 'True') {
          ret.stats[stat] = Number(itemFood[`Max{HQ}[${i}]`]);
          ret.statRates[stat] = Number(itemFood[`Value{HQ}[${i}]`]);
        } else {
          ret.stats[stat] = Number(itemFood[`Value{HQ}[${i}]`]);
        }
      }
    }
    if (Object.keys(ret.stats).length === 0) return;

    // jobCategory
    const jobs = {};
    if ('CMS' in ret.stats || 'CRL' in ret.stats || 'CP' in ret.stats) {
      ['CRP', 'BSM', 'ARM', 'GSM', 'LTW', 'WVR', 'ALC', 'CUL'].forEach(j => jobs[j] = true);
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
    if (!ItemCn[index]?.['Name'] && sourceOfId[ret.id] === undefined) {
      sourcesMissing[ret.id] = `food  ${ret.name}`;
    }
    return ret;
  })
  .filter(Boolean);

const bestFoods = [];
for (const food of foods.slice().reverse()) {
  if (food.id === 4745) continue;  // 唯一的直击信仰食物，各只加1，应该并不会有人想吃它
  if (food.patch > '7.0' /* patches.current */) {  // 不强制显示7.0版本的新食物和7.0之前的国服已实装范围内的最优食物
    food.best = true;
    continue;
  }
  if (!bestFoods.some(bestFood => Object.keys(food.stats).every(stat => food.stats[stat] <= bestFood.stats[stat]))) {
    food.best = true;
    bestFoods.push(food);
  }
}

const syncLevelOfJobLevel = {};
for (const x of ContentFinderCondition) {
  if (x['ClassJobLevel{Required}'] % 10 === 0 && Number(x['ClassJobLevel{Required}']) >= 50) {
    syncLevelOfJobLevel[x['ItemLevel{Required}']] = x['ClassJobLevel{Required}'];
    syncLevelOfJobLevel[x['ItemLevel{Sync}']] = x['ClassJobLevel{Required}'];
  }
}
delete syncLevelOfJobLevel['0'];
const syncLevels = {};
for (const l of Object.keys(syncLevelOfJobLevel).map(x => Number(x)).sort((a, b) => a - b)) {
  const jobLevel = syncLevelOfJobLevel[l];
  if (!(jobLevel in syncLevels)) {
    syncLevels[jobLevel] = [];
  }
  syncLevels[jobLevel].push(l);
  levelsUsed[l] = true;
}

const levelCaps = {
  level: Object.keys(levelsUsed).map(x => parseInt(x, 10)).sort((a, b) => a - b),
};
for (const i of Object.keys(statAbbrs)) {
  levelCaps[statAbbrs[i]] = levelCaps.level.map(l => parseInt(ItemLevel[l][i], 10));
}

delete slotsUsed[0];
const slotCaps = {};
for (const i of Object.keys(statAbbrs)) {
  slotCaps[statAbbrs[i]] = Array.from(slotsUsed).map((_, j) => _ ? parseInt(BaseParam[i][4 + j], 10) : 0);
}

const roleCaps = {};
for (const i of Object.keys(statAbbrs)) {
  roleCaps[statAbbrs[i]] = Array.from({ length: 13 }).map((_, j) => parseInt(BaseParam[i][27 + j], 10));
}

const levelGroupBasis = [
  1, 70, 136,
  210, 255, 271,
  340, 385, 401,
  470, 515, 531,
  600, 645, 661,
  690,
];
const levelGroupIds = [];
const levelGroupLast = levelGroupBasis[levelGroupBasis.length - 1];
let groupId = 0;
for (let level = 1; level <= levelGroupLast + 200; level++) {
  if (levelGroupBasis.includes(level)){
    groupId = level;
  }
  levelGroupIds[level] = groupId;
}
const gearGroups = [];
const groupedGears = [];
for (const gear of gears) {
  let groupId = levelGroupIds[gear.level];
  if ((gear.id >= 10337 && gear.id <= 10344) || gear.id === 17726) {  // 专家证、渔叉跟随最新分组加载
    groupId = levelGroupLast;
  }
  gearGroups[gear.id] = groupId;
  if (groupedGears[groupId] === undefined) groupedGears[groupId] = [];
  groupedGears[groupId].push(gear);
}

const bluMdmgAdditions = fs.readFileSync('./in/bluMdmgAdditions.txt', 'utf8')
  .split(/\r?\n/).map(x => parseInt(x, 10)).filter(x => !Number.isNaN(x));

for (const filename of fs.readdirSync('./out')) {
  fs.unlinkSync(`./out/${filename}`);
}

const sourcesMissingIds = Object.keys(sourcesMissing).map(x => Number(x)).sort((a, b) => a - b);
if (sourcesMissingIds.length > 0) {
  const output = ['-----'];
  sourcesMissingIds.forEach((x, i) => {
    output.push(`${x}  ${sourcesMissing[x]}`);
    if (x + 1 !== sourcesMissingIds[i + 1]) output.push(output[0]);
  });
  fs.writeFileSync('./out/sourcesMissing.txt', output.join('\n'));
}

fs.writeFileSync('./out/patches.ts', stringify(patches).replace(/null,/g, ','));
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
