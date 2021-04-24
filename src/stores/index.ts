import * as mst from 'mobx-state-tree';
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

export { Setting } from './Setting';
export type { ISetting } from './Setting';
export { Promotion } from './Promotion';
export type { IPromotion } from './Promotion';
export { Materia } from './Materia';
export type { IMateria } from './Materia';
export { Gear } from './Gear';
export type { IGear, GearColor } from './Gear';
export { Food } from './Food';
export type { IFood } from './Food';
export { GearUnion, GearUnionReference } from './GearUnion';
export type { IGearUnion } from './GearUnion';
export { Store } from './Store';
export type { IStore, Mode } from './Store';
export { gearData, gearDataOrdered, gearDataLoading,
  loadGearData, loadGearDataOfGearId, loadGearDataOfLevelRange } from './gearData';

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

mst.onSnapshot(store, snapshot => {
  if (snapshot.job !== undefined && snapshot.mode !== 'view') {
    archive.save(snapshot);
  }
});

require('./gearset');

(window as any).store = store;
(window as any).game = G;
if (process.env.NODE_ENV === 'production') {
  mst.unprotect(store);  // Allow users manipulate store in browser console if they want.
  console.log('You can access window.store for data store of this app, and window.game for ffxiv related constants.');
}
