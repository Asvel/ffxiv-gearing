import { types, Instance, ISimpleType, applySnapshot, onSnapshot } from "mobx-state-tree";

type GearDisplayName = 'name' | 'source';

const storageKey = 'ffxiv-gearing-setting';

export const Setting = types
  .model({
    highSaturation: types.optional(types.boolean, false),
    gearDisplayName: types.optional(types.string as ISimpleType<GearDisplayName>, 'name'),
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
  }));

export interface ISetting extends Instance<typeof Setting> {}
