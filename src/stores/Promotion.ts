import * as mst from 'mobx-state-tree';

const storageKey = 'ffxiv-gearing.dt.promotion';

export const Promotion = mst.types
  .model({
    filter: mst.types.optional(mst.types.boolean, true),
    legacyLink: mst.types.optional(mst.types.boolean, true),
    materiaDetDhtOptimization: mst.types.optional(mst.types.boolean, true),
  })
  .views(self => ({
    get(name: string): boolean {
      return (self as any)[name] ?? false;
    },
  }))
  .actions(self => ({
    afterCreate(): void {
      const snapshotString = localStorage.getItem(storageKey);
      const snapshot = JSON.parse(snapshotString ?? '{}');
      if (snapshotString === null) {  // for brand-new user, turn off all promotions as all features are "new" to them
        for (const name of Object.keys(mst.getSnapshot(self))) {
          (snapshot as any)[name] = false;
        }
        localStorage.setItem(storageKey, JSON.stringify(snapshot));
      }
      mst.applySnapshot(self, snapshot);
      mst.onSnapshot(self, snapshot => localStorage.setItem(storageKey, JSON.stringify(snapshot)));
    },
    off(name: string): void {
      if ((self as any)[name] === true) {
        (self as any)[name] = false;
      }
    },
  }));

export interface IPromotion extends mst.Instance<typeof Promotion> {}
