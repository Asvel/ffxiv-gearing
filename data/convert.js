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
    let ret = {};
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
};

const jobs = [
  'PLD', 'WAR', 'DRK', 'GNB',
  'WHM', 'SCH', 'AST',
  'MNK', 'DRG', 'NIN', 'SAM',
  'BRD', 'MCH', 'DNC',
  'BLM', 'SMN', 'RDM', 'BLU',
  'CRP', 'BSM', 'ARM', 'GSM', 'LTW', 'WVR', 'ALC', 'CUL',
  'MIN', 'BTN', 'FSH',
];

const patchIds = require('./in/Item.json');
const patches = {
  58: '5.0', 59: '5.01', 60: '5.05', 61: '5.08',
  62: '5.1', 63: '5.11', 65: '5.15',
  66: '5.2', 67: '5.21', 68: '5.25',
};

const sources = require('./in/sources');
const sourceOfId = {};
for (const [begin, end, source] of sources) {
  for (let i = begin; i <= end; i++) {
    if (i in sourceOfId) debugger;
    sourceOfId[i] = source;
  }
}

const BaseParam = loadExd('BaseParam.csv');
const ClassJobCategory = loadExd('ClassJobCategory.csv');
const Item = loadExd('Item.csv');
const ItemCn = loadExd('Item.cn.csv');
const ItemAction = loadExd('ItemAction.csv');
const ItemFood = loadExd('ItemFood.csv');
const ItemLevel = loadExd('ItemLevel.csv');

const jobCategories = ClassJobCategory.map(line => {
  const ret = {};
  for (const classjob of jobs) {
    if (line[classjob] === 'True') {
      ret[classjob] = true;
    }
  }
  return Object.keys(ret).length > 0 ? ret : undefined;
});

const jobCategoriesUsed = [];
const levelsUsed = {};
const sourcesMissing = {};

const gears = Item
  .map((x, index) => {
    if (jobCategories[x['ClassJobCategory']] === undefined) return;
    const rawStats = {};
    for (let i = 0; i < 6; i++) {
      rawStats[x[`BaseParam[${i}]`]] = (rawStats[x[`BaseParam[${i}]`]] || 0) + Number(x[`BaseParamValue[${i}]`]);
      if (x['CanBeHq'] === 'True') {  // 不能 HQ 的装备 {Special} 属性有值可能是有套装效果
        rawStats[x[`BaseParam{Special}[${i}]`]] = (rawStats[x[`BaseParam{Special}[${i}]`]] || 0) +
          Number(x[`BaseParamValue{Special}[${i}]`]);
      }
    }
    rawStats[12] = (rawStats[12] || 0) + Number(x['Damage{Phys}']);
    rawStats[13] = (rawStats[13] || 0) + Number(x['Damage{Mag}']);
    if (rawStats[14]) console.log(x['Name'], rawStats[14], x['Delay<ms>']);
    rawStats[14] = (rawStats[14] || 0) + Number(x['Delay<ms>']);
    const stats = {};
    for (const k of Object.keys(rawStats)) {
      if (rawStats[k] > 0) {
        if (k in statAbbrs) {
          stats[statAbbrs[k]] = rawStats[k];
        }
      }
    }
    if (('STR' in stats || 'DEX' in stats) && rawStats[12] > 0) {
      stats['PDMG'] = rawStats[12];
      stats['DLY'] = Number(x['Delay<ms>']);  // 攻击间隔不会有 HQ 附加值
    }
    if (('INT' in stats || 'MND' in stats) && rawStats[13] > 0) {
      stats['MDMG'] = rawStats[13];
    }
    if (Object.keys(stats).length === 0) return;
    jobCategoriesUsed[x['ClassJobCategory']] = jobCategories[x['ClassJobCategory']];
    levelsUsed[x['Level{Item}']] = true;
    if (sourceOfId[x['#']] === undefined && Number(x['Level{Equip}']) >= 60) {
      sourcesMissing[x['#']] = x['Name'];
    }
    return {
      id: Number(x['#']),
      name: ItemCn[index] && ItemCn[index]['Name'] || x['Name'],
      level: Number(x['Level{Item}']),
      slot: Number(x['EquipSlotCategory']),
      role: Number(x['BaseParamModifier']),
      jobCategory: Number(x['ClassJobCategory']),
      equipLevel: Number(x['Level{Equip}']),
      materiaSlot: Number(x['MateriaSlotCount']),
      materiaAdvanced: x['IsAdvancedMeldingPermitted'] === 'True',
      stats,
      hq: x['CanBeHq'] === 'True',
      source: sourceOfId[x['#']],
      patch: patches[patchIds[x['#']]],
    };
  })
  .filter(Boolean)
  .sort((x, y) => {
    const k = x.level - y.level;
    return k !== 0 ? k : x.id - y.id;
  });

const jobCategoryMap = Object.fromEntries(jobCategoriesUsed
  .map((x, i) => [Object.keys(x).sort().join(','), i]).filter(Boolean));
const foods = Item
  .map((x, index) => {
    const itemAction = ItemAction[x['ItemAction']];
    if ((itemAction['Type'] === '844' || itemAction['Type'] === '845') && x['CanBeHq'] === 'True') {
      const itemFood = ItemFood[itemAction['Data[1]']];
      const stats = {};
      const statRates = {};
      for (const i of [0, 1, 2]) {
        const stat = statAbbrs[itemFood[`BaseParam[${i}]`]];
        if (stat !== undefined) {
          if (itemFood[`IsRelative[${i}]`] === 'True') {
            stats[stat] =  Number(itemFood[`Max{HQ}[${i}]`]);
            statRates[stat] = Number(itemFood[`Value{HQ}[${i}]`]);
          } else {
            stats[stat] = Number(itemFood[`Value{HQ}[${i}]`]);
          }
        }
      }
      const jobs = {};
      if ('CMS' in stats || 'CRL' in stats || 'CP' in stats) {
        ['CRP', 'BSM', 'ARM', 'GSM', 'LTW', 'WVR', 'ALC', 'CUL'].forEach(j => jobs[j] = true);
      }
      if ('GTH' in stats || 'PCP' in stats || 'GP' in stats) {
        ['MIN', 'BTN', 'FSH'].forEach(j => jobs[j] = true);
      }
      if ('TEN' in stats) {
        ['PLD', 'WAR', 'DRK', 'GNB'].forEach(j => jobs[j] = true);
      }
      if ('PIE' in stats) {
        ['WHM', 'SCH', 'AST'].forEach(j => jobs[j] = true);
      }
      if (Object.keys(jobs).length === 0) {
        if (!('SPS' in stats)) {
          ['PLD', 'WAR', 'DRK', 'GNB', 'MNK', 'DRG', 'NIN', 'SAM', 'BRD', 'MCH', 'DNC'].forEach(j => jobs[j] = true);
        }
        if (!('SKS' in stats)) {
          ['WHM', 'SCH', 'AST', 'BLM', 'SMN', 'RDM', 'BLU'].forEach(j => jobs[j] = true);
        }
      }
      const jobCategory = jobCategoryMap[Object.keys(jobs).sort().join(',')];
      if (!jobCategory) debugger;
      return {
        id: Number(x['#']),
        name: ItemCn[index] && ItemCn[index]['Name'] || x['Name'],
        level: Number(x['Level{Item}']),
        slot: -1,
        jobCategory,
        stats,
        statRates,
        statMain: statAbbrs[itemFood[`BaseParam[0]`]],
        patch: patches[patchIds[x['#']]],
      };
    }
  })
  .filter(Boolean);

const levelCaps = {
  level: Object.keys(levelsUsed).map(x => parseInt(x)).sort((a, b) => a - b),
};
for (const i of Object.keys(statAbbrs)) {
  levelCaps[statAbbrs[i]] = levelCaps.level.map(l => parseInt(ItemLevel[l][i]));
}

const slotCaps = {};
for (const i of Object.keys(statAbbrs)) {
  slotCaps[statAbbrs[i]] = Array.from({ length: 14 }).map((_, j) => j === 0 ? 0 : parseInt(BaseParam[i][4 + j]));
}

const equipLevelGroupBasis = [1, 50, 51, 60, 61, 70, 71, 80];
const equipLevelGroup = [];
let groupId = 0;
for (let equipLevel = 1; equipLevel <= equipLevelGroupBasis[equipLevelGroupBasis.length - 1]; equipLevel++) {
  if (equipLevelGroupBasis.includes(equipLevel)){
    groupId = equipLevel;
  }
  equipLevelGroup[equipLevel] = groupId;
}
const gearGroups = [];
const groupedGears = [];
for (const gear of gears) {
  const groupId = equipLevelGroup[gear.equipLevel];
  gearGroups[gear.id] = groupId;
  if (groupedGears[groupId] === undefined) groupedGears[groupId] = [];
  groupedGears[groupId].push(gear);
}

const oretoolsData = require('./in/oretools-data-en.json');
const nameToLodestoneId = {};
for (const group of Object.values(oretoolsData.data)) {
  for (const item of group) {
    if (item.name in nameToLodestoneId) debugger;
    nameToLodestoneId[item.name] = item.id;
  }
}
const lodestoneIds = [];
for (const item of Item) {
  const name = item['Name'];
  if (name in nameToLodestoneId) {
    lodestoneIds[Number(item['#'])] = nameToLodestoneId[name];
  }
}

const sourcesMissingIds = Object.keys(sourcesMissing).map(x => Number(x)).sort((a, b) => a - b);
if (sourcesMissingIds.length > 0) {
  const output = [];
  sourcesMissingIds.forEach((x, i) => {
    output.push(`${x}\t${sourcesMissing[x]}`);
    if (x + 1 !== sourcesMissingIds[i + 1]) output.push('-----');
  });
  fs.writeFileSync('./out/sourcesMissing.txt', output.join('\n'));
} else {
  fs.unlink('./out/sourcesMissing.txt', () => {});  // ignore error
}

fs.writeFileSync('./out/gearGroups.js', stringify(gearGroups).replace(/null,/g, ','));
for (const groupId of equipLevelGroupBasis) {
  fs.writeFileSync(`./out/gears-${groupId}.js`, stringify(groupedGears[groupId]));
}
fs.writeFileSync('./out/gears-food.js', stringify(foods));
fs.writeFileSync('./out/jobCategories.js', stringify(jobCategoriesUsed).replace(/null,/g, ','));
fs.writeFileSync('./out/levelCaps.js', stringify(levelCaps));
fs.writeFileSync('./out/slotCaps.js', stringify(slotCaps));
fs.writeFileSync('./out/lodestoneIds.js', stringify(lodestoneIds).replace(/null,/g, ','));
