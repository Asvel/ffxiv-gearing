import { onSnapshot } from 'mobx-state-tree';
import * as G from '../game';
import * as archive from '../archive';

declare global {
  // noinspection JSUnusedGlobalSymbols
  interface Math {
    abs(x: G.GearId): G.GearId;  // eslint-disable-line @typescript-eslint/method-signature-style
    abs(x: number): number;  // eslint-disable-line @typescript-eslint/method-signature-style
  }
}

export function floor(value: number) {
  return Math.floor(value + 1e-7);
}
export function ceil(value: number) {
  return Math.ceil(value - 1e-7);
}

export { Setting, ISetting } from './Setting';
export { Materia, IMateria } from './Materia';
export { Gear, IGear, GearColor } from './Gear';
export { Food, IFood } from './Food';
export { GearUnion, IGearUnion, GearUnionReference } from './GearUnion';
export { Store, IStore, Mode } from './Store';
export { gearData, gearDataOrdered, gearDataLoading,
  loadGearData, loadGearDataOfGear, loadGearDataOfLevelRange } from './gearData';

import { Setting, Store } from '.';

// export const store = Store.create(archive.load(), { setting: Setting.create() });
// TODO: delete this old store structure compatible code
const _archive = archive.load() as any;
if (_archive?.condition) {
  Object.assign(_archive, _archive.condition);
  delete _archive.condition;
  archive.save(_archive);
}
// TODO: delete this bug fix compatible code
if (_archive && typeof Object.values(_archive.equippedGears)[0] === 'string') {
  for (const [ key, value ] of Object.entries(_archive.equippedGears)) {
    _archive.equippedGears[key] = Number(value);
  }
  archive.save(_archive);
}
export const store = Store.create(_archive, { setting: Setting.create() });

onSnapshot(store, snapshot => {
  if (snapshot.job !== undefined && snapshot.mode !== 'view') {
    archive.save(snapshot);
  }
});
// onPatch(store, patch => console.log(patch));

require('./gearset');

(window as any).store = store;
(window as any).G = G;
