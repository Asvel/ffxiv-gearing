import * as mst from 'mobx-state-tree';

type GearDisplayName = 'name' | 'source';
type GearColorScheme = 'source' | 'rarity' | 'none';
type MateriaDisplayName = 'stat' | 'materia';
type AppTheme = 'light' | 'light-hs' | 'dark';

const storageKey = 'ffxiv-gearing.dt.setting';

export const Setting = mst.types
  .model({
    gearDisplayName: mst.types.optional(mst.types.string as mst.ISimpleType<GearDisplayName>, 'name'),
    gearColorScheme: mst.types.optional(mst.types.string as mst.ISimpleType<GearColorScheme>, 'source'),
    materiaDisplayName: mst.types.optional(mst.types.string as mst.ISimpleType<MateriaDisplayName>, 'stat'),
    displayMeldedStats: mst.types.optional(mst.types.boolean, true),
    hideObsoleteGears: mst.types.optional(mst.types.boolean, true),
    appTheme: mst.types.optional(mst.types.string as mst.ISimpleType<AppTheme>, 'light'),
  })
  .actions(self => ({
    afterCreate(): void {
      const snapshot = JSON.parse(localStorage.getItem(storageKey) ?? '{}');
      if (snapshot.highSaturation) {  // TODO: remove this when switch to next storageKey
        snapshot.appTheme = 'light-hs';
      }
      mst.applySnapshot(self, snapshot);
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
    setAppTheme(appTheme: AppTheme): void {
      self.appTheme = appTheme;
    },
  }));

export interface ISetting extends mst.Instance<typeof Setting> {}
