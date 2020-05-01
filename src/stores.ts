import { observable, computed, autorun, reaction, action, runInAction } from 'mobx';
// noinspection ES6UnusedImports
import { types, Instance, SnapshotIn, SnapshotOut, ISimpleType, getParentOfType, resolveIdentifier, getIdentifier,
  unprotect, getSnapshot, applySnapshot, onSnapshot, onPatch } from "mobx-state-tree";
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

declare module 'mobx-state-tree' {
  // noinspection JSUnusedGlobalSymbols
  interface IType<C, S, T> {
    // Use .is only on instance
    is(thing: any): thing is this["Type"];
  }
}

export type Mode = 'edit' | 'view';

export const Job = types.string as ISimpleType<G.Job>;
export const GearId = types.identifierNumber as ISimpleType<G.GearId>;
export const Stat = types.string as ISimpleType<G.Stat>;
export const MateriaGrade = types.number as ISimpleType<G.MateriaGrade>;

export const Condition = types
  .model('Condition', {
    version: types.optional(types.number, 505),
    job: types.maybe(Job),
    minLevel: types.optional(types.number, 440),
    maxLevel: types.optional(types.number, 470),
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
    get meldableGrades(): G.MateriaGrade[] {
      return this.isAdvanced ? G.materiaGradesAdvanced : G.materiaGrades;  // TODO; work for low level item
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
      if (!gearData.has(Math.abs(self.id))) throw ReferenceError(`Gear ${self.id} not exists.`);
      return gearData.get(Math.abs(self.id))! as G.Gear;
    },
  }))
  .views(self => ({
    get name() { return self.data.name; },
    get level() { return self.data.level; },
    get slot() { return self.id > 0 ? self.data.slot : -self.data.slot; },
    get materiaSlot() { return self.data.materiaSlot; },
    get materiaAdvanced() { return self.data.materiaAdvanced; },
    get hq() { return self.data.hq; },
    get caps(): G.Stats { return G.getCaps(self.data); },
    get bareStats(): G.Stats { return self.data.stats; },
    get materiaStats(): G.Stats {
      const stats: G.Stats = {};
      for (const materia of self.materias) {
        if (materia.stat !== undefined) {
          const materiaValue = G.materias[materia.stat]![materia.grade! - 1];
          stats[materia.stat] = (stats[materia.stat] ?? 0) + materiaValue;
        }
      }
      return stats;
    },
    get stats(): G.Stats {
      const stats: G.Stats = {};
      for (const stat of Object.keys(this.bareStats).concat(Object.keys(this.materiaStats)) as G.Stat[]) {
        stats[stat] = Math.min((this.bareStats[stat] ?? 0) + (this.materiaStats[stat] ?? 0), this.caps[stat]);
      }
      return stats;
    },
    get totalMeldableStats(): G.Stats {
      const stats: G.Stats = {};
      for (const stat of Object.keys(this.caps) as G.Stat[]) {
        stats[stat] = this.caps[stat] - (this.bareStats[stat] ?? 0);
      }
      return stats;
    },
    get currentMeldableStats(): G.Stats {
      const stats: G.Stats = {};
      for (const stat of Object.keys(this.caps) as G.Stat[]) {
        stats[stat] = this.totalMeldableStats[stat] - (this.materiaStats[stat] ?? 0);
      }
      return stats;
    },
    get statHighlights(): { [index in G.Stat]?: Boolean } {
      const ret: { [index in G.Stat]?: Boolean } = {};
      for (const stat of Object.keys(this.bareStats) as G.Stat[]) {
        ret[stat] = G.statHighlight[stat] && (this.bareStats[stat] ?? 0) >= (this.caps[stat] ?? Infinity);
      }
      return ret;
    },
    get isEquipped(): boolean {
      const store = getParentOfType(self, Store);
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

export const Food = types
  .model('Food', {
    id: GearId,
  })
  .views(self => ({
    get data() {
      if (!gearData.has(self.id)) throw ReferenceError(`Food ${self.id} not exists.`);
      return gearData.get(self.id)! as G.Food;
    },
  }))
  .views(self => ({
    get name() { return self.data.name; },
    get level() { return self.data.level; },
    get slot() { return self.data.slot; },
    get hq() { return true; },
    get stats(): G.Stats { return self.data.stats; },
    get statRates(): G.Stats { return self.data.statRates; },
    get requiredStats(): G.Stats {
      const stats: G.Stats = {};
      for (const stat of Object.keys(this.stats) as G.Stat[]) {
        const statRate = this.statRates[stat];
        if (statRate !== undefined) {
          stats[stat] = Math.ceil(this.stats[stat] * 100 / statRate);
        }
      }
      return stats;
    },
    get effectiveStats(): G.Stats {
      const store = getParentOfType(self, Store);
      const stats: G.Stats = {};
      for (const stat of Object.keys(this.stats) as G.Stat[]) {
        const equippedStat = store.equippedStatsWithoutFood[stat] ?? 1;
        const statRate = this.statRates[stat] ?? Infinity;
        stats[stat] = Math.min(this.stats[stat], Math.floor(equippedStat * statRate / 100 + 1e-7));
      }
      return stats;
    },
    get statHighlights(): { [index in G.Stat]?: Boolean } {
      return {
        [self.data.statMain]: true,
      };
    },
    get utilization(): number {
      let fullStat = 0;
      let effectiveStat = 0;
      for (const stat of Object.keys(this.stats) as G.Stat[]) {
        fullStat += this.stats[stat];
        effectiveStat += this.effectiveStats[stat];
      }
      return Math.round(effectiveStat / fullStat * 100);
    },
    get utilizationOpacity(): number {
      return Math.max(0.2, Math.pow(this.utilization / 100, 2));
    },
    get isEquipped(): boolean {
      const store = getParentOfType(self, Store);
      return store.equippedGears.get('-1') === self;
    }
  }));
export interface IFood extends Instance<typeof Food> {}

const GearUnion = types.union({
  dispatcher: snapshot => {
    const gear =  gearData.get(Math.abs(snapshot.id));
    if (gear !== undefined) {
      if (snapshot.materias !== undefined && gear.slot === -1) delete snapshot.materias;
      return gear.slot !== -1 ? Gear : Food;
    } else {
      return snapshot.materias !== undefined ? Gear : Food;
    }
  },
}, Gear, Food);
export type IGearUnion = IGear | IFood;
export const GearUnionReference = types.maybe(types.reference(GearUnion, {
  get(identifier, parent): any {
    const value = parent ? resolveIdentifier(GearUnion, parent, identifier) : undefined;
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
    gears: types.map(GearUnion),
    equippedGears: types.map(GearUnionReference),
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
        const ret: G.GearId[] = [];
        for (const gear of gearData.values()) {
          let { job, minLevel, maxLevel } = self.condition;
          if (gear.slot === -1) {
            minLevel -= 35;  // TODO: craft and gather foods
          }
          if (gear.level >= minLevel && gear.level <= maxLevel && G.jobCategories[gear.jobCategory][job!]) {
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
      return gearDataLoading.get();
    },
    get isViewing(): boolean {
      return self.mode === 'view';
    },
    get groupedGears(): { [index: number]: IGearUnion[] | undefined } {
      console.log('groupedGears');
      const ret: { [index: number]: IGearUnion[] } = {};
      for (const gearId of self.filteredIds) {
        const gear = self.gears.get(gearId.toString())!;
        if (!(gear.slot in ret)) {
          ret[gear.slot] = [];
        }
        ret[gear.slot].push(gear);
      }
      return ret;
    },
    get baseStats(): G.Stats {
      if (self.condition.job === undefined) return {};
      const levelModifier = G.levelModifiers[80];  // FIXME
      const stats: G.Stats = { PDMG: 0, MDMG: 0 };
      for (const stat of this.schema.stats as G.Stat[]) {
        const baseStat = G.baseStats[stat] ?? 0;
        if (typeof baseStat === 'number') {
          stats[stat] = baseStat;
        } else {
          stats[stat] = Math.floor(levelModifier[baseStat] * (this.schema.statModifiers[stat] ?? 100) / 100 + 1e-7) +
            (stat === this.schema.mainStat ? 48 : 0) + (G.raceStats[stat]?.[self.race] ?? 0);
        }
      }
      return stats;
    },
    get equippedStatsWithoutFood(): G.Stats {
      if (self.condition.job === undefined) return {};
      const stats: G.Stats = Object.assign({}, this.baseStats);
      for (const gear of self.equippedGears.values()) {
        if (gear === undefined) continue;
        if (Gear.is(gear)) {
          for (const stat of Object.keys(gear.stats) as G.Stat[]) {
            stats[stat] = stats[stat]! + gear.stats[stat]!;
          }
        }
      }
      return stats;
    },
    get equippedStats(): G.Stats {
      console.log('equippedStats');
      if (self.condition.job === undefined) return {};
      const equippedFood = self.equippedGears.get('-1') as IFood;
      if (equippedFood === undefined) return this.equippedStatsWithoutFood;
      const stats: G.Stats = {};
      for (const stat of Object.keys(this.equippedStatsWithoutFood) as G.Stat[]) {
        stats[stat] = this.equippedStatsWithoutFood[stat] + (equippedFood.effectiveStats[stat] ?? 0);
      }
      return stats;
    },
    get equippedLevel(): number {
      let level = 0;
      for (let slot of this.schema.slots) {
        level += (self.equippedGears.get(slot.slot)?.level ?? 0) * (slot.levelWeight ?? 1);
      }
      return Math.floor(level / 13);
    },
    isEquipped(gear: IGearUnion): boolean {
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
      const levelMod = G.levelModifiers[80];  // FIXME
      const { main, sub, div } = levelMod;
      const { CRT, DET, DHT, TEN, SKS, SPS, VIT, PIE, PDMG, MDMG } = self.equippedStats;
      const { statModifiers, mainStat, traitDamageMultiplier } = self.schema;
      const attackMainStat = mainStat === 'VIT' ? 'STR' : mainStat as G.Stat;
      const crtChance = Math.floor(200 * (CRT! - sub) / div + 50) / 1000;
      const crtDamage = Math.floor(200 * (CRT! - sub) / div + 1400) / 1000;
      const detDamage = Math.floor(130 * (DET! - sub) / div + 1000) / 1000;
      const dhtChance = Math.floor(550 * (DHT! - main) / div) / 1000;
      const tenDamage = Math.floor(100 * ((TEN ?? sub) - sub) / div + 1000) / 1000;
      const weaponDamage = Math.floor(main * statModifiers[attackMainStat as keyof typeof statModifiers] / 1000) +
        ((mainStat === 'MND' || mainStat === 'INT' ? MDMG : PDMG) ?? 0);
      const mainDamage = Math.floor(statModifiers.ap *
        ((self.equippedStats[attackMainStat] ?? 0) - main) / main + 100) / 100;
      const damage = 0.01 * weaponDamage * mainDamage * detDamage * tenDamage * traitDamageMultiplier
        * ((crtDamage - 1) * crtChance + 1) * (0.25 * dhtChance + 1);
      const gcd = Math.floor((1000 - Math.floor(130 * ((SKS || SPS)! - sub) / div)) / 1000 * 250) / 100;
      const ssDamage = Math.floor(130 * ((SKS || SPS)! - sub) / div + 1000) / 1000;
      const hp = Math.floor(levelMod.hp * statModifiers.hp / 100 +
        (mainStat === 'VIT' ? levelMod.vitTank : levelMod.vit) *
        (VIT! - levelMod.main) + 1e-7);
      const mp = Math.floor(200 + (PIE! - levelMod.main) / 22);
      return { crtChance, crtDamage, detDamage, dhtChance, tenDamage, damage, gcd, ssDamage, hp, mp };
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
          materias: Gear.is(gear) ? gear.materias.map(m => m.stat !== undefined ? [m.stat, m.grade!] : null) : [],
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
          self.gears.put(GearUnion.create({ id: gearId }));
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
    equip(gear: IGearUnion): void {
      const key = gear.slot.toString();
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

export const gearData = observable.map<G.GearId, G.GearBase>({}, { deep: false });
const gearDataLoadStatus = observable.map<string, 'loading' | 'finished'>({});  // TODO: handle failures
export const gearDataLoading = computed(() => {
  for (const status of gearDataLoadStatus.values()) {
    if (status === 'loading') return true;
  }
  return false;
});
const loadGearData = async (groupId: string) => {
  if (gearDataLoadStatus.has(groupId)) return;
  runInAction(() => gearDataLoadStatus.set(groupId, 'loading'));
  const data = (await import(/* webpackChunkName: "[request]" */`../data/gears-${groupId}`)).default as G.GearBase[];
  console.log(`gears-${groupId}`);
  runInAction(() => {
    for (const item of data) {
      if (!gearData.has(item.id)) {
        gearData.set(item.id, item);
      }
    }
    gearDataLoadStatus.set(groupId, 'finished');
  });
};
const gearGroups = require('../data/gearGroups').default as number[];
const loadGearDataByGear = (gearId: G.GearId) => {
  const groupId = gearGroups[gearId];
  if (groupId) loadGearData(groupId.toString());
};
loadGearData('food');
loadGearData('80');  // FIXME
// TODO: loadGearDataByItemLevel

export const store = Store.create(archive.load());
// archive.load();
// export const store = Stores.create();
// unprotect(store);

onSnapshot(store, snapshot => {
  if (snapshot.condition.job !== undefined && snapshot.mode !== 'view') {
    archive.save(snapshot);
  }
});

// onPatch(store, patch => console.log(patch));
// autorun(() => console.log(store.share, store.share.length));

const gearsetStore = observable.box<G.Gearset>(undefined, { deep: false });
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

const parseQuery = () => {
  let query = location.search.slice(1);
  if (query in G.jobSchemas) {
    store.condition.setJob(query as G.Job);
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
        loadGearDataByGear(gear.id);
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

(window as any).store = store;
(window as any).G = G;
