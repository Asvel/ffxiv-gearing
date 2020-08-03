import { types, Instance, ISimpleType, getParentOfType } from "mobx-state-tree";
import * as G from '../game';
import { Materia, Store, gearData } from '.';

export const Gear = types
  .model('Gear', {
    id: types.identifierNumber as ISimpleType<G.GearId>,
    materias: types.optional(types.array(Materia), []),
  })
  .views(self => ({
    get data() {
      if (!gearData.has(Math.abs(self.id))) throw ReferenceError(`Gear ${self.id} not exists.`);
      return gearData.get(Math.abs(self.id))! as G.Gear;
    },
  }))
  .views(self => ({
    get isFood(): false { return false; },
    get name() { return self.data.name; },
    get level() { return self.data.level; },
    get slot() { return self.id > 0 ? self.data.slot : -self.data.slot; },
    get jobs() { return G.jobCategories[self.data.jobCategory]; },
    get materiaSlot() { return self.data.materiaSlot; },
    get materiaAdvanced() { return self.data.materiaAdvanced; },
    get hq() { return self.data.hq; },
    get source() { return self.data.source; },
    get patch() { return self.data.patch; },
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
      if (this.materiaSlot === 0) return this.bareStats;
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
    get isInstalled(): boolean {
      return !(this.patch > G.versions.released);
    },
    get isEquipped(): boolean {
      const store = getParentOfType(self, Store);
      return store.equippedGears.get(this.slot.toString()) === self;
    },
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
