process.chdir(__dirname);

const https = require('https');
const fs = require('fs');

const resources = {
  'https://raw.githubusercontent.com/xivapi/ffxiv-datamining/master/csv/BaseParam.csv': '',
  'https://raw.githubusercontent.com/xivapi/ffxiv-datamining/master/csv/ClassJobCategory.csv': '',
  'https://raw.githubusercontent.com/xivapi/ffxiv-datamining/master/csv/Item.csv': '',
  'https://raw.githubusercontent.com/xivapi/ffxiv-datamining/master/csv/ItemAction.csv': '',
  'https://raw.githubusercontent.com/xivapi/ffxiv-datamining/master/csv/ItemFood.csv': '',
  'https://raw.githubusercontent.com/xivapi/ffxiv-datamining/master/csv/ItemLevel.csv': '',
  'https://raw.githubusercontent.com/thewakingsands/ffxiv-datamining-cn/master/Item.csv': 'Item.cn.csv',
  'https://raw.githubusercontent.com/xivapi/ffxiv-datamining-patches/master/patchdata/Item.json': '',
  'https://raw.githubusercontent.com/Asvel/ffxiv-lodestone-item-id/master/lodestone-item-id.txt': '',
};

for (let [ url, path ] of Object.entries(resources)) {
  path = `./in/${path || url.slice(url.lastIndexOf('/') + 1)}`;
  https.get(url, res => res.pipe(fs.createWriteStream(path)));
}
