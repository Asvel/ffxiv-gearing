import { types, getEnv, Instance, ISimpleType, getParentOfType } from "mobx-state-tree";
import * as G from '../game';
import { Gear, IGear, ISetting } from '.';

export const Materia = types
  .model({
    stat: types.maybe(types.string as ISimpleType<G.Stat>),
    grade: types.maybe(types.number as ISimpleType<G.MateriaGrade>),
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
      const names = (getEnv(self).setting as ISetting).materiaDisplayName === 'stat' ? G.statNames : G.materiaNames;
      return self.stat === undefined ? '' : names[self.stat]!.slice(0, 2) + self.grade;
    },
    get isAdvanced(): boolean {
      return self.index >= self.gear.materiaSlot;
    },
    get meldableGrades(): G.MateriaGrade[] {
      return self.index > self.gear.materiaSlot ?
        G.materiaGradesAdvanced : G.materiaGrades;  // TODO; work for low level item
    },
  }))
  .actions(self => ({
    meld(stat: G.Stat | undefined, grade?: G.MateriaGrade): void {
      self.stat = stat;
      self.grade = grade;
    },
  }));

export interface IMateria extends Instance<typeof Materia> {}
