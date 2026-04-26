import https from 'node:https';
import fs from 'node:fs';

process.chdir(import.meta.dirname);

const resources = [
  'https://raw.githubusercontent.com/skyborn-industries/xiv-data/main/exd/chs/BaseParam.csv',
  'https://raw.githubusercontent.com/skyborn-industries/xiv-data/main/exd/chs/ClassJobCategory.csv',
  'https://raw.githubusercontent.com/skyborn-industries/xiv-data/main/exd/chs/ContentFinderCondition.csv',
  'https://raw.githubusercontent.com/skyborn-industries/xiv-data/main/exd/chs/Item.csv',
  'https://raw.githubusercontent.com/skyborn-industries/xiv-data/main/exd/chs/ItemAction.csv',
  'https://raw.githubusercontent.com/skyborn-industries/xiv-data/main/exd/chs/ItemFood.csv',
  'https://raw.githubusercontent.com/skyborn-industries/xiv-data/main/exd/chs/ItemLevel.csv',
  'https://raw.githubusercontent.com/Asvel/ffxiv-lodestone-item-id/master/lodestone-item-id.txt',
];

for (const url of resources) {
  const path = `./in/${url.slice(url.lastIndexOf('/') + 1)}`;
  https.get(url, res => res.pipe(fs.createWriteStream(path)));
}
