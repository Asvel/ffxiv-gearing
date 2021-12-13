import * as mst from 'mobx-state-tree';

type GearDisplayName = 'name' | 'source';
type GearColorScheme = 'source' | 'rarity' | 'none';
type MateriaDisplayName = 'stat' | 'materia';

const storageKey = 'ffxiv-gearing.ew.setting';

export const Setting = mst.types
  .model({
    gearDisplayName: mst.types.optional(mst.types.string as mst.ISimpleType<GearDisplayName>, 'name'),
    gearColorScheme: mst.types.optional(mst.types.string as mst.ISimpleType<GearColorScheme>, 'source'),
    materiaDisplayName: mst.types.optional(mst.types.string as mst.ISimpleType<MateriaDisplayName>, 'stat'),
    displayMeldedStats: mst.types.optional(mst.types.boolean, true),
    hideObsoleteGears: mst.types.optional(mst.types.boolean, true),
    highSaturation: mst.types.optional(mst.types.boolean, false),
  })
  .actions(self => ({
    afterCreate(): void {
      mst.applySnapshot(self, JSON.parse(localStorage.getItem(storageKey) ?? '{}'));
      mst.onSnapshot(self, snapshot => localStorage.setItem(storageKey, JSON.stringify(snapshot)));
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
    setHideObsoleteGears(hideObsoleteGears: boolean): void {
      self.hideObsoleteGears = hideObsoleteGears;
    },
    setHighSaturation(highSaturation: boolean): void {
      self.highSaturation = highSaturation;
    },
  }));

export interface ISetting extends mst.Instance<typeof Setting> {}
