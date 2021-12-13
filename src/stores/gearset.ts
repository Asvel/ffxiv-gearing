import * as mobx from 'mobx';
import * as mst from 'mobx-state-tree';
import * as G from '../game';
import * as archive from '../archive';
import * as share from '../share';
import { Store, IStore, gearData, gearDataLoading, loadGearDataOfGearId, store } from '.';

// TODO: avoid accessing store instance

const gearsetStore = mobx.observable.box<G.Gearset>(undefined, { deep: false });
mobx.autorun(() => {  // gearsetStore react to main store
  const gearset = gearsetStore.get();
  if (gearset === undefined || window.location.search === '') return;
  if (gearDataLoading.get()) return;
  const snapshot: mst.SnapshotIn<IStore> = {
    mode: 'view',
    job: gearset.job,
    jobLevel: gearset.jobLevel,
    syncLevel: gearset.syncLevel,
    gears: {},
    equippedGears: {},
  };
  for (const g of gearset.gears) {
    if (gearData.has(g.id)) {
      const { slot } = gearData.get(g.id)!;
      const id = snapshot.equippedGears![slot] === undefined ? g.id : -g.id as G.GearId;
      const materias = g.materias.map(m =>
        ({ stat: m === null ? undefined : m[0], grade: m === null ? undefined : m[1] }));
      const customStats = g.customStats as { [index: string]: number };
      snapshot.gears![id] = { id, materias, customStats };
      snapshot.equippedGears![id > 0 ? slot : -slot] = id;
    }
  }
  mst.applySnapshot(store, snapshot);
});

const parseQuery = () => {
  let query = window.location.search.slice(1);
  if (query in G.jobSchemas) {
    store.setJob(query as G.Job);
    window.history.replaceState(window.history.state, document.title,
      window.location.href.replace(/\?.*$/, ''));
  } else {
    if (query.startsWith('import-')) {
      const gearset = JSON.parse(decodeURIComponent(query.slice('import-'.length))) as G.Gearset;
      query = share.stringify(gearset);
      window.history.replaceState(window.history.state, document.title,
        window.location.href.replace(/\?.*$/, `?${query}`));
    }
    if (query.length > 3) {
      const gearset = share.parse(query);
      if (gearset === 'legacy') {
        window.location.href = window.location.href.replace('/?', '/shb/?');
        return;
      }
      for (const gear of gearset.gears) {
        loadGearDataOfGearId(gear.id);
      }
      mobx.runInAction(() => gearsetStore.set(gearset));
      store.setMode('view');
    }
  }
};
parseQuery();

window.addEventListener('popstate', mobx.action(() => {
  const archiveData = archive.load();
  if (archiveData !== undefined) {
    mst.applySnapshot(store, archiveData);
  } else {
    mst.applySnapshot(store, mst.getSnapshot(Store.create()));
    parseQuery();
  }
}));
