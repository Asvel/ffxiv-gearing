import * as mst from 'mobx-state-tree';
import { Gear, IGear, Food, IFood, gearData } from '.';

export const GearUnion = mst.types.union({
  dispatcher: snapshot => {
    const gear = gearData.get(Math.abs(snapshot.id));
    if (gear !== undefined) {
      if (snapshot.materias !== undefined && gear.slot === -1) delete snapshot.materias;
      return gear.slot !== -1 ? Gear : Food;
    } else {
      return snapshot.materias !== undefined ? Gear : Food;
    }
  },
}, Gear, Food);

export type IGearUnion = IGear | IFood;

export const GearUnionReference = mst.types.maybe(mst.types.reference(GearUnion, {
  get(identifier, parent): any {
    const value = parent ? mst.resolveIdentifier(GearUnion as any/* FIXME */, parent, identifier) : undefined;
    return value && gearData.has(Math.abs(value.id)) ? value : undefined;
  },
  set(value): any {
    return (value as any)?.$treenode.unnormalizedIdentifier;
  },
}));
