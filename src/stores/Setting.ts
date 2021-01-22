import { types, Instance, ISimpleType, applySnapshot, onSnapshot } from 'mobx-state-tree';

type GearDisplayName = 'name' | 'source';
type GearColorScheme = 'source' | 'rarity' | 'none';
type MateriaDisplayName = 'stat' | 'materia';

const storageKey = 'ffxiv-gearing-setting';

export const Setting = types
  .model({
    highSaturation: types.optional(types.boolean, false),
    gearDisplayName: types.optional(types.string as ISimpleType<GearDisplayName>, 'name'),
    gearColorScheme: types.optional(types.string as ISimpleType<GearColorScheme>, 'source'),
    materiaDisplayName: types.optional(types.string as ISimpleType<MateriaDisplayName>, 'stat'),
    displayMeldedStats: types.optional(types.boolean, true),
  })
  .actions(self => ({
    afterCreate(): void {
      applySnapshot(self, JSON.parse(localStorage.getItem(storageKey) ?? '{}'));
      onSnapshot(self, snapshot => localStorage.setItem(storageKey, JSON.stringify(snapshot)));
    },
    setHighSaturation(highSaturation: boolean): void {
      self.highSaturation = highSaturation;
    },
    setGearDisplayName(gearDisplayName: GearDisplayName): void {
      self.gearDisplayName = gearDisplayName;
    },
    setGearColorScheme(gearColorScheme: GearColorScheme): void {
      self.gearColorScheme = gearColorScheme;
    },
    setMateriaDisplayName(materiaDisplayName: MateriaDisplayName): void {
      self.materiaDisplayName = materiaDisplayName;
    },
    setDisplayMeldedStats(displayMeldedStats: boolean): void {
      self.displayMeldedStats = displayMeldedStats;
    },
  }));

export interface ISetting extends Instance<typeof Setting> {}
