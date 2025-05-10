import * as mst from 'mobx-state-tree';
import * as G from '../game';
import { Gear, Store } from '.';
import type { IGear, IStore } from '.';

export const Materia = mst.types
  .model({
    stat: mst.types.maybe(mst.types.string as mst.ISimpleType<G.Stat>),
    grade: mst.types.maybe(mst.types.number as mst.ISimpleType<G.MateriaGrade>),
  })
  .views(self => ({
    get index(): number {
      return Number((self as any).$treenode.subpath);
    },
    get gear(): IGear {
      return mst.getParentOfType(self, Gear);
    },
    get store(): IStore {
      return mst.getParentOfType(self, Store);
    },
  }))
  .views(self => ({
    get name(): string {
      return self.stat === undefined ? '' : G.getMateriaName(self.stat, self.grade!,
        self.store.setting.materiaDisplayName === 'stat', 3);
    },
    get isAdvanced(): boolean {
      return self.index >= self.gear.materiaSlot;
    },
    get canRestricted(): boolean {
      return self.index <= self.gear.materiaSlot;
    },
    get meldableGrades(): G.MateriaGrade[] {
      const { level } = self.gear;
      const { canRestricted } = this;
      const { showAllMaterias } = self.store;
      return G.materiaGrades.filter(grade => {
        if (level < G.materiaGradeRequiredLevels[grade - 1]) return false;
        if (canRestricted) {
          if (showAllMaterias || grade === self.grade) return true;
          return G.materiaGradeIsRestricted[grade];
        } else {
          return !G.materiaGradeIsRestricted[grade];
        }
      });
    },
    get successRate(): number | undefined {
      if (self.grade === undefined) return undefined;
      const advancedIndex = self.index - self.gear.materiaSlot;
      return advancedIndex < 0 ? 100 : G.materiaSuccessRates[advancedIndex][self.grade - 1];
    },
  }))
  .actions(self => ({
    meld(stat: G.Stat | undefined, grade?: G.MateriaGrade): void {
      self.stat = stat;
      self.grade = grade;
    },
  }));

export interface IMateria extends mst.Instance<typeof Materia> {}
