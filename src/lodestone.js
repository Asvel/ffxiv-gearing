const lodestoneIds = require('../data/lodestoneIds').default;
const [region, gearId] = location.search.slice(1).split(':');
const lodestoneId = lodestoneIds[gearId];
if (region && lodestoneId !== undefined) {
  location.href = `https://${region}.finalfantasyxiv.com/lodestone/playguide/db/item/${lodestoneId}/`;
} else {
  document.body.innerText = 'Not Found';
}
