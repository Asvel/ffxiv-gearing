import * as mobx from 'mobx';
import * as mst from 'mobx-state-tree';
import * as G from '../game';
import { Materia, Store, gearData } from '.';
import type { IStore } from '.';

export type GearColor = 'white' | 'red' | 'green' | 'blue' | 'purple';

export const Gear = mst.types
  .model('Gear', {
    id: mst.types.identifierNumber as mst.ISimpleType<G.GearId>,
    materias: mst.types.optional(mst.types.array(Materia), []),
    customStats: mst.types.maybe(mst.types.map(mst.types.number)),
  })
  .views(self => ({
    get data() {
      if (!gearData.has(Math.abs(self.id))) throw ReferenceError(`Gear ${self.id} not exists.`);
      return gearData.get(Math.abs(self.id))! as G.Gear;
    },
    get store(): IStore {
      return mst.getParentOfType(self, Store);
    },
  }))
  .views(self => ({
    get isFood() { return false as const; },
    get name() { return self.data.name; },
    get level() { return self.data.level; },
    get slot() { return self.id > 0 ? self.data.slot : -self.data.slot; },
    get jobs() { return G.jobCategories[self.data.jobCategory]; },
    get equipLevel() { return self.data.equipLevel; },
    get equipLevelVariable() { return self.data.equipLevelVariable; },
    get materiaSlot() { return self.data.materiaSlot; },
    get materiaAdvanced() { return self.data.materiaAdvanced; },
    get hq() { return self.data.hq; },
    get customizable() { return self.data.customizable; },
    get source() { return self.data.source; },
    get patch() { return self.data.patch; },
    get color(): GearColor {
      const { gearColorScheme } = self.store.setting;
      if (gearColorScheme === 'none') return 'white';
      const { rarity, source='' } = self.data;
      return gearColorScheme === 'source' && sourceColors[(source).slice(0, 2)] || rarityColors[rarity];
    },
    get syncedLevel(): number | undefined {
      const { jobLevel, syncLevel=Infinity } = self.store;
      if (syncLevel >= this.level && jobLevel >= this.equipLevel) return undefined;
      const jobLevelSyncedLevel = Math.min(this.level, G.syncLevelOfJobLevels[jobLevel]);
      return this.equipLevelVariable
        ? Math.min(syncLevel, jobLevelSyncedLevel)
        : syncLevel < this.level ? syncLevel : jobLevelSyncedLevel;
    },
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
      let stats: G.Stats = {};
      let bareStats = this.bareStats;
      if (this.customizable) {
        bareStats = { ...bareStats, ...self.customStats!.toJSON() };
      }
      if (this.syncedLevel !== undefined) {
        const caps = G.getCaps(self.data, this.syncedLevel);
        for (const stat of Object.keys(bareStats) as G.Stat[]) {
          stats[stat] = Math.min(bareStats[stat] ?? 0, caps[stat]!);
        }
      } else if (this.materiaSlot === 0) {
        stats = bareStats;
      } else {
        for (const stat of Object.keys(bareStats).concat(Object.keys(this.materiaStats)) as G.Stat[]) {
          stats[stat] = Math.min((bareStats[stat] ?? 0) + (this.materiaStats[stat] ?? 0),
            Math.max(bareStats[stat] ?? 0, this.caps[stat]));
        }
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
    get statHighlights(): { [index in G.Stat]?: boolean } {
      const ret: { [index in G.Stat]?: boolean } = {};
      for (const stat of Object.keys(this.bareStats) as G.Stat[]) {
        ret[stat] = G.statHighlight[stat] && (this.bareStats[stat] ?? 0) >= (this.caps[stat] ?? Infinity);
      }
      return ret;
    },
    get isInstalled(): boolean {
      return !(this.patch > G.patches.current);
    },
    get isEquipped(): boolean {
      return self.store.equippedGears.get(this.slot.toString()) === self;
    },
    get isMelded(): boolean {
      for (const materia of self.materias) {
        if (materia.stat !== undefined) {
          return true;
        }
      }
      return self.customStats !== undefined && self.customStats.size > 0;
    },
  }))
  .actions(self => ({
    setCustomStat(stat: G.Stat, value: number) {
      if (value > 0) {
        self.customStats!.set(stat, value <= G.customStatMax ? value : G.customStatMax);
      } else {
        self.customStats!.delete(stat);
      }
    },
    initialize() {
      const materiaSlot = self.materiaAdvanced ? 5 : self.materiaSlot;
      if (self.materias.length > materiaSlot) {
        self.materias.splice(materiaSlot, 5);  // 5 means all
      }
      if (self.materias.length < materiaSlot) {
        self.materias.push(...new Array(materiaSlot - self.materias.length).fill({}));
      }
      if (self.customizable && self.customStats === undefined) {
        self.customStats = {} as any;
      }
    },
    afterCreate(): void {
      mobx.when(() => gearData.has(Math.abs(self.id)), this.initialize);
    },
  }))
  .postProcessSnapshot(snapshot => {
    if (snapshot.customStats === undefined) {
      delete snapshot.customStats;
    }
    return snapshot;
  });

const rarityColors: { [index: number]: GearColor } = {
  1: 'white',
  2: 'green',
  3: 'blue',
  4: 'purple',
  7: 'red',
};

// noinspection NonAsciiCharacters
const sourceColors: { [index: string]: GearColor } = {
  '点数': 'red',
  '天书': 'purple',
  '绝境': 'purple',
};

export interface IGear extends mst.Instance<typeof Gear> {}
