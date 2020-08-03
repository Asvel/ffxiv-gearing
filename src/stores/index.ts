import { onSnapshot } from "mobx-state-tree";
import * as G from '../game';
import * as archive from '../archive';

declare global {
  // noinspection JSUnusedGlobalSymbols
  interface Math {
    abs(x: G.GearId): G.GearId;
    abs(x: number): number;
  }
}

export function floor(value: number) {
  return Math.floor(value + 1e-7);
}
export function ceil(value: number) {
  return Math.ceil(value - 1e-7);
}

export { Materia, IMateria } from './Materia';
export { Gear, IGear } from './Gear';
export { Food, IFood } from './Food';
export { GearUnion, IGearUnion, GearUnionReference } from './GearUnion';
export { Store, IStore, Mode } from './Store';
export { gearData, gearDataOrdered, gearDataLoading,
  loadGearData, loadGearDataOfGear, loadGearDataOfLevelRange } from './gearData';

import { Store } from '.';

// export const store = Store.create(archive.load());
// TODO: delete this old store structure compatible code
const _archive = archive.load() as any;
if (_archive && _archive.condition) {
  Object.assign(_archive, _archive.condition);
  delete _archive.condition;
  archive.save(_archive);
}
export const store = Store.create(_archive);

onSnapshot(store, snapshot => {
  if (snapshot.job !== undefined && snapshot.mode !== 'view') {
    archive.save(snapshot);
  }
});
// onPatch(store, patch => console.log(patch));

require('./gearset');

(window as any).store = store;
(window as any).G = G;
