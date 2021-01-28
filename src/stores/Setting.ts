import * as mst from 'mobx-state-tree';

type GearDisplayName = 'name' | 'source';
type GearColorScheme = 'source' | 'rarity' | 'none';
type MateriaDisplayName = 'stat' | 'materia';

const storageKey = 'ffxiv-gearing-setting';

export const Setting = mst.types
  .model({
    highSaturation: mst.types.optional(mst.types.boolean, false),
    gearDisplayName: mst.types.optional(mst.types.string as mst.ISimpleType<GearDisplayName>, 'name'),
    gearColorScheme: mst.types.optional(mst.types.string as mst.ISimpleType<GearColorScheme>, 'source'),
    materiaDisplayName: mst.types.optional(mst.types.string as mst.ISimpleType<MateriaDisplayName>, 'stat'),
    displayMeldedStats: mst.types.optional(mst.types.boolean, true),
  })
  .actions(self => ({
    afterCreate(): void {
      mst.applySnapshot(self, JSON.parse(localStorage.getItem(storageKey) ?? '{}'));
      mst.onSnapshot(self, snapshot => localStorage.setItem(storageKey, JSON.stringify(snapshot)));
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

export interface ISetting extends mst.Instance<typeof Setting> {}
