import { observable, computed, reaction, runInAction } from 'mobx';
import * as G from '../game';

export const gearData = observable.map<G.GearId, G.GearBase>({}, { deep: false });

const gearDataLoadStatus = observable.map<string | number, 'loading' | 'finished'>({});  // TODO: handle failures
export const gearDataLoading = computed(() => {
  for (const status of gearDataLoadStatus.values()) {
    if (status === 'loading') return true;
  }
  return false;
});

export const loadGearData = async (groupId: string | number) => {
  if (groupId === undefined || gearDataLoadStatus.has(groupId)) return;
  runInAction(() => gearDataLoadStatus.set(groupId, 'loading'));
  const data = (await import(/* webpackChunkName: "[request]" */`../../data/out/gears-${groupId}`)).default as
    G.GearBase[];
  console.log(`Load gears-${groupId}.`);
  runInAction(() => {
    for (const item of data) {
      if (!gearData.has(item.id)) {
        gearData.set(item.id, item);
      }
    }
    gearDataLoadStatus.set(groupId, 'finished');
  });
};

const gearGroups = require('../../data/out/gearGroups').default as number[];
export const loadGearDataOfGear = (gearId: G.GearId) => loadGearData(gearGroups[gearId]);

const gearGroupBasis = require('../../data/out/gearGroupBasis').default as number[];
export const loadGearDataOfLevelRange = (minLevel: number, maxLevel: number) => {
  let i = 0;
  while (gearGroupBasis[i + 1] <= minLevel) i++;
  while (gearGroupBasis[i] <= maxLevel) {
    loadGearData(gearGroupBasis[i]);
    i++;
  }
};

export const gearDataOrdered = observable.box([] as G.GearBase[], { deep: false });
reaction(() => gearDataLoading.get(), () => {
  gearDataOrdered.set(Array.from(gearData.values()).sort((a, b) => {
    const k = a.level - b.level;
    return k !== 0 ? k : a.id - b.id;
  }));
});

loadGearData('food');
loadGearData(gearGroupBasis[gearGroupBasis.length - 1]);
