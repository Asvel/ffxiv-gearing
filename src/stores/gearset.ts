import { observable, autorun, action } from 'mobx';
import { SnapshotIn, getSnapshot, applySnapshot } from "mobx-state-tree";
import * as G from '../game';
import * as archive from '../archive';
import * as share from '../share';
import { Store, IStore, gearData, gearDataLoading, loadGearDataOfGear, store } from '.';

// TODO: avoid accessing store instance

const gearsetStore = observable.box<G.Gearset>(undefined, { deep: false });
autorun(() => {  // gearsetStore react to main store
  const gearset = gearsetStore.get();
  if (gearset === undefined) return;
  if (gearDataLoading.get()) return;
  const snapshot: SnapshotIn<IStore> = {
    mode: 'view',
    job: gearset.job,
    gears: {},
    equippedGears: {},
  };
  for (const g of gearset.gears) {
    if (gearData.has(g.id)) {
      const { slot } = gearData.get(g.id)!;
      const id = snapshot.equippedGears![slot] === undefined ? g.id : -g.id as G.GearId;
      const materias = g.materias.map(m =>
        ({ stat: m === null ? undefined : m[0], grade: m === null ? undefined : m[1] }));
      snapshot.gears![id] = { id, materias };
      snapshot.equippedGears![id > 0 ? slot : -slot] = id;
    }
  }
  applySnapshot(store, snapshot);
});

const parseQuery = () => {
  let query = location.search.slice(1);
  if (query in G.jobSchemas) {
    store.setJob(query as G.Job);
    history.replaceState(history.state, document.title, location.href.replace(/\?.*$/, ''));
  } else {
    if (query.startsWith('import-')) {
      const gearset = JSON.parse(decodeURIComponent(query.slice('import-'.length))) as G.Gearset;
      query = share.stringify(gearset);
      history.replaceState(history.state, document.title, location.href.replace(/\?.*$/, `?${query}`));
    }
    if (query.length > 3) {
      const gearset = share.parse(query);
      for (const gear of gearset.gears) {
        loadGearDataOfGear(gear.id);
      }
      gearsetStore.set(gearset);
      store.setMode('view');
    }
  }
};
parseQuery();

window.addEventListener('popstate', action(() => {
  const archiveData = archive.load();
  if (archiveData !== undefined) {
    applySnapshot(store, archive.load());
  } else {
    applySnapshot(store, getSnapshot(Store.create()));
    parseQuery();
  }
}));
