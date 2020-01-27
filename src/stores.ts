import { observable, computed, autorun, reaction, action, runInAction } from 'mobx';
// noinspection ES6UnusedImports
import { types, Instance, SnapshotIn, SnapshotOut, ISimpleType, getParentOfType, resolveIdentifier, getIdentifier,
  unprotect, applySnapshot, onSnapshot, onPatch } from "mobx-state-tree";
import * as G from './gear';
import * as archive from './archive';
import * as share from './share';

declare global {
  // noinspection JSUnusedGlobalSymbols
  interface Math {
    abs(x: G.GearId): G.GearId;
    abs(x: number): number;
  }
}

export type Mode = 'edit' | 'view';

export const Job = types.string as ISimpleType<G.Job>;
export const GearId = types.identifierNumber as ISimpleType<G.GearId>;
export const Stat = types.string as ISimpleType<G.Stat>;
export const MateriaGrade = types.number as ISimpleType<G.MateriaGrade>;

export const Condition = types
  .model('Condition', {
    version: types.optional(types.number, 420),
    job: types.maybe(Job),
    minLevel: types.optional(types.number, 350),
    maxLevel: types.optional(types.number, 375),
  })
  .views(self => ({
    get versionString(): string {
      return self.version.toString().split('').join('.');
    }
  }))
  .actions(self => ({
    setJob(value: G.Job): void {
      self.job = value;
    },
    setMinLevel(value: number): void {
      self.minLevel = value;
    },
    setMaxLevel(value: number): void {
      self.maxLevel = value;
    },
  }));
export interface ICondition extends Instance<typeof Condition> {}

export const Materia = types
  .model({
    stat: types.maybe(Stat),
    grade: types.maybe(MateriaGrade),
  })
  .views(self => ({
    get index(): number {
      return Number((self as any).$treenode.subpath);
    },
    get gear(): IGear {
      return getParentOfType(self, Gear);
    },
  }))
  .views(self => ({
    get name(): string {
      return self.stat === undefined ? '' : G.statNames[self.stat] + self.grade;
    },
    get isAdvanced(): boolean {
      return self.index >= self.gear.materiaSlot;
    },
    get maxMeldableGrade(): G.MateriaGrade {
      return self.index <= self.gear.materiaSlot ? 6 : 5;
    },
    canMeldStat(stat: G.Stat): boolean {
      let isMainStat = stat === 'VIT' || stat === 'STR' || stat === 'DEX' || stat === 'INT' || stat === 'MND';
      return !(this.isAdvanced && isMainStat);
    },
  }))
  .actions(self => ({
    meld(stat: G.Stat | undefined, grade?: G.MateriaGrade): void {
      self.stat = stat;
      self.grade = grade;
    },
  }));
export interface IMateria extends Instance<typeof Materia> {}

export const Gear = types
  .model('Gear', {
    id: GearId,
    materias: types.optional(types.array(Materia), []),
  })
  .views(self => ({
    get data() {
      if (!gearData.has(Math.abs(self.id))) {
        debugger;
        throw ReferenceError(`Gear ${self.id} not exists.`);
      }
      return gearData.get(Math.abs(self.id))!;
    },
  }))
  .views(self => ({
    get name() { return self.data.name; },
    get level() { return self.data.level; },
    get slot() { return self.id > 0 ? self.data.slot : -self.data.slot; },
    get jobs() { return self.data.jobs; },
    get materiaSlot() { return self.data.materiaSlot; },
    get materiaAdvanced() { return self.data.materiaAdvanced; },
    get hq() { return self.data.hq; },
    get source() { return self.data.source; },
    // get external() { return self.data.external; },  TODO
    get caps(): G.Stats { return G.getCaps(self.data); },
    get bareStats(): G.Stats { return self.data.stats; },
    get materiaStats(): G.Stats {
      let stats: G.Stats = {};
      for (const materia of self.materias) {
        if (materia.stat !== undefined) {
          let materiaValue = G.materias[materia.stat][materia.grade! - 1];
          stats[materia.stat] = (stats[materia.stat] ?? 0) + materiaValue;
        }
      }
      return stats;
    },
    get stats(): G.Stats {
      let stats: G.Stats = {};
      for (const stat of Object.keys(this.bareStats).concat(Object.keys(this.materiaStats)) as G.Stat[]) {
        stats[stat] = Math.min((this.bareStats[stat] ?? 0) + (this.materiaStats[stat] ?? 0), this.caps[stat]);
      }
      return stats;
    },
    get totalMeldableStats(): G.Stats {
      let stats: G.Stats = {};
      for (const stat of Object.keys(this.caps) as G.Stat[]) {
        stats[stat] = this.caps[stat] - (this.bareStats[stat] ?? 0);
      }
      return stats;
    },
    get currentMeldableStats(): G.Stats {
      let stats: G.Stats = {};
      for (const stat of Object.keys(this.caps) as G.Stat[]) {
        stats[stat] = this.totalMeldableStats[stat] - (this.materiaStats[stat] ?? 0);
      }
      return stats;
    },
    get isEquipped(): boolean {
      let store = getParentOfType(self, Store);
      return store.equippedGears.get(this.slot.toString()) === self;
    }
  }))
  .actions(self => ({
    afterCreate(): void {
      const materiaSlot = self.materiaAdvanced ? 5 : self.materiaSlot;
      if (self.materias.length > materiaSlot) {
        self.materias.splice(0, materiaSlot, 5);  // 5 means all
      }
      if (self.materias.length < materiaSlot) {
        self.materias.push(...new Array(materiaSlot - self.materias.length).fill({}));
      }
    },
  }));
export interface IGear extends Instance<typeof Gear> {}

export const GearReference = types.maybe(types.reference(Gear, {
  get(identifier, parent): any {
    let value = parent ? resolveIdentifier(Gear, parent, identifier) : undefined;
    return value && gearData.has(Math.abs(value.id)) ? value : undefined;
  },
  set(value): any {
    return getIdentifier(value);
  },
}));

export const Store = types
  .model('Store', {
    mode: types.optional(types.string as ISimpleType<Mode>, 'edit'),
    condition: types.optional(Condition, {}),
    gears: types.map(Gear),
    equippedGears: types.map(GearReference),
    race: 5,  // TODO: global
  })
  .views(self => {
    let unobservableEquippedGears: SnapshotOut<typeof self.equippedGears> = {};
    autorun(() => unobservableEquippedGears = self.equippedGears.toJSON());
    return {
      get filteredIds(): G.GearId[] {
        console.log('filteredIds');
        if (self.mode === 'view') {
          return Array.from(self.gears.keys(), id => Number(id) as G.GearId);
        }
        let ret: G.GearId[] = [];
        for (const gear of gearData.values()) {
          if (isGearMatch(gear, self.condition)) {
            ret.push(gear.id);
            if (gear.slot === 12) {
              ret.push(-gear.id as G.GearId);
            }
          } else if (unobservableEquippedGears[gear.slot] === gear.id) {
            ret.push(gear.id);
          } else if (unobservableEquippedGears[-gear.slot] === -gear.id) {
            ret.push(-gear.id as G.GearId);
          }
        }
        return ret;
      },
    };
  })
  .views(self => ({
    get isLoading(): boolean {
      return gearData.size === 0;
    },
    get isViewing(): boolean {
      return self.mode === 'view';
    },
    get groupedGears(): { [index: number]: IGear[] | undefined } {
      console.log('groupedGears');
      let ret: { [index: number]: IGear[] } = {};
      for (const gearId of self.filteredIds) {
        let gear = self.gears.get(gearId.toString())!;
        if (!(gear.slot in ret)) {
          ret[gear.slot] = [];
        }
        ret[gear.slot].push(gear);
      }
      return ret;
    },
    get equippedStats(): G.Stats {
      console.log('equippedStats');
      if (self.condition.job === undefined) return {};
      let stats: G.Stats = Object.assign({}, G.jobSchemas[self.condition.job].baseStats);
      for (const stat of Object.keys(G.raceStats) as G.Stat[]) {
        stats[stat] = stats[stat]! + G.raceStats[stat]![self.race];
      }
      for (const gear of self.equippedGears.values()) {
        if (gear === undefined) continue;
        for (const stat of Object.keys(gear.stats) as G.Stat[]) {
          stats[stat] = stats[stat]! + gear.stats[stat]!;
        }
      }
      return stats;
    },
    isEquipped(gear: IGear): boolean {
      return self.equippedGears.get(gear.slot.toString()) === gear;
    },
    get schema(): typeof G.jobSchemas[G.Job] {
      if (self.condition.job === undefined) throw new ReferenceError();
      return G.jobSchemas[self.condition.job];
    },
    get raceName(): string {
      return G.races[self.race];
    },
  }))
  .views(self => ({
    get equippedEffects() {
      console.log('equippedEffects');
      return {
        crtRate: G.statEffect.crtRate(self.equippedStats.CRT!),
        crtDamage: G.statEffect.crtDamage(self.equippedStats.CRT!),
        detDamage: G.statEffect.detDamage(self.equippedStats.DET!),
        dhtRate: G.statEffect.dhtRate(self.equippedStats.DHT!),
        tenDamage: G.statEffect.tenDamage(self.equippedStats.TEN!),
        gcd: G.statEffect.gcd(self.equippedStats.SPS!),  // FIXME: or SKS
        ssDamage: G.statEffect.ssDamage(self.equippedStats.SPS!),  // FIXME: or SKS
        hp: G.statEffect.hp(self.equippedStats.VIT!, self.schema.hpModifier),
        mp: G.statEffect.mp(self.equippedStats.PIE!, self.schema.mpModifier),
      };
    },
    get share(): string {
      const { job } =  self.condition;
      if (job === undefined) return '';
      const level = 70;  // FIXME
      const gears: G.Gearset['gears'] = [];
      for (const slot of self.schema.slots) {
        const gear = store.equippedGears.get(slot.slot.toString());
        if (gear === undefined) continue;
        gears.push({
          id: gear.data.id,
          materias: gear.materias.map(m => m.stat !== undefined ? [m.stat, m.grade!] : null),
        });
      }
      return share.stringify({ job, level, gears });
    },
  }))
  .actions(self => ({
    createGears(): void {
      console.log('createGears');
      for (const gearId of self.filteredIds) {
        if (!self.gears.has(gearId.toString())) {
          self.gears.put(Gear.create({ id: gearId }));
        }
      }
    },
    setMode(mode: Mode): void {
      self.mode = mode;
    },
    startEditing(): void {
      self.mode = 'edit';
      let minLevel = Infinity;
      let maxLevel = -Infinity;
      self.equippedGears.forEach(gear => {
        if (gear !== undefined) {
          if (gear.level < minLevel) minLevel = gear.level;
          if (gear.level > maxLevel) maxLevel = gear.level;
        }
      });
      store.condition.minLevel = minLevel;
      store.condition.maxLevel = maxLevel;
    },
    equip(gear: IGear): void {
      let key = gear.slot.toString();
      if (self.equippedGears.get(key) === gear) {
        self.equippedGears.delete(key);
      } else {
        self.equippedGears.set(key, gear);
      }
    },
  }))
  .actions(self => ({
    afterCreate(): void {
      reaction(() => self.condition.job && self.filteredIds, self.createGears);
    }
  }));
export interface IStore extends Instance<typeof Store> {}

export function isGearMatch(gear: G.Gear, c: ICondition) {
  return c.job !== undefined && gear.level >= c.minLevel && gear.level <= c.maxLevel && gear.jobs.includes(c.job);
}

export const gearData = observable.map<G.GearId, G.Gear>({}, { deep: false });
const gearDataLoadStatus = observable.map<number, 'loading' | 'finished'>({});  // TODO: handle failures
export const gearDataLoading = computed(() => {
  for (const status of gearDataLoadStatus.values()) {
    if (status === 'loading') return true;
  }
  return false;
});
const loadGearData = async (groupId: number) => {
  if (gearDataLoadStatus.has(groupId)) return;
  runInAction(() => gearDataLoadStatus.set(groupId, 'loading'));
  const data = (await import(/* webpackChunkName: "[request]" */`../data/gears-${groupId}.json`)).default as G.Gear[];
  runInAction(() => {
    for (const item of data) {
      if (!gearData.has(item.id)) {
        gearData.set(item.id, item);
      }
    }
    gearDataLoadStatus.set(groupId, 'finished');
  });
};
const equipLevelGroupBasis = [1, 50, 51, 60, 61, 70, 71, 80, Infinity];
const gearGroups = require('../data/gearGroups.json');
const loadGearDataByGear = (gearId: G.GearId) => {
  const groupId = equipLevelGroupBasis[gearGroups[gearId] - 1];
  if (groupId) loadGearData(groupId);
};
const loadGearDataByEquipLevel = (equipLevel: number) => {
  const groupId = equipLevelGroupBasis[equipLevelGroupBasis.findIndex(v => v > equipLevel) - 1];
  if (groupId) loadGearData(groupId);
};
// loadGearDataByEquipLevel(70);  // FIXME
loadGearDataByEquipLevel(80);  // FIXME

export const store = Store.create(archive.load());
// archive.load();
// export const store = Stores.create();
// unprotect(store);

onSnapshot(store, snapshot => {
  if (snapshot.mode !== 'view') {
    archive.save(snapshot);
  }
});

// onPatch(store, patch => console.log(patch));
// autorun(() => console.log(store.share, store.share.length));

const gearsetStore = observable.box<G.Gearset>(undefined, { deep: false });
const parseHash = action(() => {  // location.hash react to gearsetStore
  let hash = location.hash.slice(1);
  let mode: Mode = 'edit';
  if (hash in G.jobSchemas) {
    store.condition.setJob(hash as G.Job);
    history.replaceState(history.state, document.title, location.href.replace(/#.*$/, ''));
  } else if (hash.startsWith('import-')) {
    const gearset = JSON.parse(decodeURIComponent(hash.slice('import-'.length))) as G.Gearset;
    location.hash = share.stringify(gearset);
  } else if (hash.length > 3) {
    mode = 'view';
    const gearset = share.parse(hash);
    for (const gear of gearset.gears) {
      loadGearDataByGear(gear.id);
    }
    gearsetStore.set(gearset);
  }
  store.setMode(mode);
});
parseHash();
window.addEventListener('hashchange', parseHash);
autorun(() => {  // gearsetStore react to main store
  const gearset = gearsetStore.get();
  if (gearset === undefined) return;
  if (gearDataLoading.get()) return;
  const snapshot: SnapshotIn<IStore> = {
    mode: 'view',
    condition: {
      job: gearset.job,
    },
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

(window as any).store = store;
(window as any).G = G;
