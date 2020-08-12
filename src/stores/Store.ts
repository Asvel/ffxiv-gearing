import { autorun, reaction } from 'mobx';
import { types, getEnv, Instance, SnapshotOut, ISimpleType, unprotect } from "mobx-state-tree";
import * as G from '../game';
import * as share from '../share';
import { floor, ceil, ISetting, IFood, GearUnion, IGearUnion, GearUnionReference,
  gearDataOrdered, gearDataLoading, loadGearDataOfLevelRange } from '.';

const globalClanKey = 'ffxiv-gearing-clan';

export type Mode = 'edit' | 'view';

export const Store = types
  .model('Store', {
    mode: types.optional(types.string as ISimpleType<Mode>, 'edit'),
    job: types.maybe(types.string as ISimpleType<G.Job>),
    minLevel: types.optional(types.number, 0),
    maxLevel: types.optional(types.number, 0),
    showAllFoods: types.optional(types.boolean, false),
    gears: types.map(GearUnion),
    equippedGears: types.map(GearUnionReference),
  })
  .volatile(() => ({
    clan: Number(localStorage.getItem(globalClanKey)) || 0,
  }))
  .views(self => {
    let unobservableEquippedGears: SnapshotOut<typeof self.equippedGears> = {};
    autorun(() => unobservableEquippedGears = self.equippedGears.toJSON());
    return {
      get filteredIds(): G.GearId[] {
        console.log('filteredIds');
        if (self.mode === 'view') {
          return Array.from(self.gears.keys(), id => Number(id) as G.GearId);
        }
        const ret: G.GearId[] = [];
        for (const gear of gearDataOrdered.get()) {
          const { job, minLevel, maxLevel } = self;
          if (G.jobCategories[gear.jobCategory][job!]
            && (gear.slot === -1 ? (self.showAllFoods || 'best' in gear) :  // Foods
              gear.slot === 17 || (gear.slot === 2 && job === 'FSH')  // Soul crystal and spearfishing gig
              || (gear.level >= minLevel && gear.level <= maxLevel))
          ) {
            ret.push(gear.id);
            if (gear.slot === 12) {
              ret.push(-gear.id as G.GearId);
            }
          } else {
            if (unobservableEquippedGears[gear.slot] === gear.id) {
              ret.push(gear.id);
            }
            if (unobservableEquippedGears[-gear.slot] === -gear.id) {
              ret.push(-gear.id as G.GearId);
            }
          }
        }
        return ret;
      },
      get jobLevel(): keyof typeof G.levelModifiers {  // FIXME: why this.jobLevel is any
        // TODO: changable job level
        return this.schema.jobLevel ?? 80;
      },
    };
  })
  .views(self => ({
    get setting(): ISetting {
      return getEnv(self).setting;
    },
    get isLoading(): boolean {
      return gearDataLoading.get();
    },
    get isViewing(): boolean {
      return self.mode === 'view';
    },
    get groupedGears(): { [index: number]: IGearUnion[] | undefined } {
      console.log('groupedGears');
      const ret: { [index: number]: IGearUnion[] } = {};
      for (const gearId of self.filteredIds) {
        const gear = self.gears.get(gearId.toString())!;
        if (!(gear.slot in ret)) {
          ret[gear.slot] = [];
        }
        ret[gear.slot].push(gear);
      }
      return ret;
    },
    get baseStats(): G.Stats {
      if (self.job === undefined) return {};
      const levelModifier = G.levelModifiers[self.jobLevel];
      const stats: G.Stats = { PDMG: 0, MDMG: 0 };
      for (const stat of this.schema.stats as G.Stat[]) {
        const baseStat = G.baseStats[stat] ?? 0;
        if (typeof baseStat === 'number') {
          stats[stat] = baseStat;
        } else {
          stats[stat] = floor(levelModifier[baseStat] * (this.schema.statModifiers[stat] ?? 100) / 100) +
            (stat === this.schema.mainStat ? 48 : 0) + (G.clanStats[stat]?.[self.clan] ?? 0);
        }
      }
      return stats;
    },
    get equippedStatsWithoutFood(): G.Stats {
      if (self.job === undefined) return {};
      const stats: G.Stats = Object.assign({}, this.baseStats);
      for (const gear of self.equippedGears.values()) {
        if (gear === undefined) continue;
        if (!gear.isFood) {
          for (const stat of Object.keys(gear.stats) as G.Stat[]) {
            stats[stat] = stats[stat]! + gear.stats[stat]!;
          }
        }
      }
      return stats;
    },
    get equippedStats(): G.Stats {
      console.log('equippedStats');
      if (self.job === undefined) return {};
      const equippedFood = self.equippedGears.get('-1') as IFood;
      if (equippedFood === undefined) return this.equippedStatsWithoutFood;
      const stats: G.Stats = {};
      for (const stat of Object.keys(this.equippedStatsWithoutFood) as G.Stat[]) {
        stats[stat] = this.equippedStatsWithoutFood[stat] + (equippedFood.effectiveStats[stat] ?? 0);
      }
      return stats;
    },
    get equippedLevel(): number {
      let level = 0;
      for (let slot of this.schema.slots) {
        level += (self.equippedGears.get(slot.slot)?.level ?? 0) * (slot.levelWeight ?? 1);
      }
      return floor(level / 13);
    },
    isEquipped(gear: IGearUnion): boolean {
      return self.equippedGears.get(gear.slot.toString()) === gear;
    },
    get schema(): typeof G.jobSchemas[G.Job] {
      if (self.job === undefined) throw new ReferenceError();
      return G.jobSchemas[self.job];
    },
    get raceName(): string {
      return G.races[floor(self.clan / 2)];
    },
    get clanName(): string {
      return G.clans[self.clan];
    },
  }))
  .views(self => ({
    get equippedEffects() {
      console.log('equippedEffects');
      const { statModifiers, mainStat, traitDamageMultiplier } = self.schema;
      if (statModifiers === undefined || mainStat === undefined || traitDamageMultiplier === undefined) return;
      const levelMod = G.levelModifiers[self.jobLevel];
      const { main, sub, div } = levelMod;
      const { CRT, DET, DHT, TEN, SKS, SPS, VIT, PIE, PDMG, MDMG } = self.equippedStats;
      const attackMainStat = mainStat === 'VIT' ? 'STR' : mainStat;
      const crtChance = floor(200 * (CRT! - sub) / div + 50) / 1000;
      const crtDamage = floor(200 * (CRT! - sub) / div + 1400) / 1000;
      const detDamage = floor(130 * (DET! - main) / div + 1000) / 1000;
      const dhtChance = floor(550 * (DHT! - sub) / div) / 1000;
      const tenDamage = floor(100 * ((TEN ?? sub) - sub) / div + 1000) / 1000;
      const weaponDamage = floor(main * statModifiers[attackMainStat]! / 1000) +
        ((mainStat === 'MND' || mainStat === 'INT' ? MDMG : PDMG) ?? 0);
      const mainDamage = floor(statModifiers.ap *
        ((self.equippedStats[attackMainStat] ?? 0) - main) / main + 100) / 100;
      const damage = 0.01 * weaponDamage * mainDamage * detDamage * tenDamage * traitDamageMultiplier *
        ((crtDamage - 1) * crtChance + 1) * (0.25 * dhtChance + 1);
      const gcd = floor(floor((1000 - floor(130 * ((SKS || SPS)! - sub) / div)) * 2500 / 1000) *
        (statModifiers.gcd ?? 100) / 1000) / 100;
      const ssDamage = floor(130 * ((SKS || SPS)! - sub) / div + 1000) / 1000;
      const hp = floor(levelMod.hp * statModifiers.hp / 100 +
        (mainStat === 'VIT' ? levelMod.vitTank : levelMod.vit) * (VIT! - main));
      const mp = floor(200 + ((PIE ?? main) - main) / 22);
      return { crtChance, crtDamage, detDamage, dhtChance, tenDamage, damage, gcd, ssDamage, hp, mp };
    },
    get equippedTiers(): { [index in G.Stat]?: { prev: number, next: number } } | undefined {
      const { statModifiers } = self.schema;
      if (statModifiers === undefined) return;
      const { main, sub, div } = G.levelModifiers[self.jobLevel];
      const { CRT, DET, DHT, TEN, SKS, SPS, PIE } = self.equippedStats;
      function calcTier(value: number, multiplier: number) {
        if (value !== value) return undefined;
        const quotient = floor(value / multiplier);
        const prev = ceil(quotient * multiplier) - 1 - value;
        const next = ceil((quotient + 1) * multiplier) - value;
        return { prev, next };
      }
      function calcGcdTier(value: number, multiplier: number, modifier: number) {
        if (value !== value) return undefined;
        const gcdc = floor(floor((1000 - floor(value / multiplier)) * 2.5) * modifier);
        const prev = ceil((floor(1000 - ceil((gcdc + 1) / modifier) / 2.5) + 1) * multiplier) - 1 - value;
        const next = ceil((floor(1000 - ceil(gcdc / modifier) / 2.5) + 1) * multiplier) - value;
        return { prev, next };
      }
      return {
        CRT: calcTier(CRT! - sub, div / 200),
        DET: calcTier(DET! - main, div / 130),
        DHT: calcTier(DHT! - sub, div / 550),
        TEN: calcTier(TEN! - sub, div / 100),
        SKS: calcGcdTier(SKS! - sub, div / 130, (statModifiers.gcd ?? 100) / 1000),
        SPS: calcGcdTier(SPS! - sub, div / 130, (statModifiers.gcd ?? 100) / 1000),
        PIE: calcTier(PIE! - main, 22),
      };
    },
    get share(): string {
      if (self.job === undefined) return '';
      const gears: G.Gearset['gears'] = [];
      for (const slot of self.schema.slots) {
        const gear = self.equippedGears.get(slot.slot.toString());
        if (gear === undefined) continue;
        gears.push({
          id: gear.data.id,
          materias: !gear.isFood ? gear.materias.map(m => m.stat !== undefined ? [m.stat, m.grade!] : null) : [],
        });
      }
      return share.stringify({
        job: self.job,
        level: self.jobLevel,
        gears,
      });
    },
    get shareUrl(): string {
      return location.origin + location.pathname + '?' + this.share;
    },
  }))
  .actions(self => ({
    createGears(): void {
      console.log('createGears');
      for (const gearId of self.filteredIds) {
        if (!self.gears.has(gearId.toString())) {
          self.gears.put(GearUnion.create({ id: gearId }));
        }
      }
    },
    setMode(mode: Mode): void {
      self.mode = mode;
    },
    setJob(value: G.Job): void {
      const newLevel = G.jobSchemas[value].defaultItemLevel;
      if (newLevel !== (self.job && G.jobSchemas[self.job].defaultItemLevel)) {
        self.minLevel = newLevel[0];
        self.maxLevel = newLevel[1];
      }
      for (const [ key, gear ] of self.equippedGears.entries()) {
        if (gear !== undefined && !gear.jobs[value]) {
          self.equippedGears.delete(key);
        }
      }
      self.job = value;
    },
    setMinLevel(value: number): void {
      self.minLevel = value;
    },
    setMaxLevel(value: number): void {
      self.maxLevel = value;
    },
    toggleShowAllFoods(): void {
      self.showAllFoods = !self.showAllFoods;
    },
    startEditing(): void {
      self.mode = 'edit';
      let minLevel = Infinity;
      let maxLevel = -Infinity;
      for (const slot of self.schema.slots) {
        const gear = self.equippedGears.get(slot.slot.toString());
        if (gear !== undefined && slot.levelWeight !== 0) {
          if (gear.level < minLevel) minLevel = gear.level;
          if (gear.level > maxLevel) maxLevel = gear.level;
        }
      }
      self.minLevel = minLevel;
      self.maxLevel = maxLevel;
    },
    equip(gear: IGearUnion): void {
      const key = gear.slot.toString();
      if (self.equippedGears.get(key) === gear) {
        self.equippedGears.delete(key);
      } else {
        self.equippedGears.set(key, gear);
      }
    },
    setClan(clan: number): void {
      self.clan = clan;
      localStorage.setItem(globalClanKey, clan.toString());
    },
    unprotect(): void {
      setTimeout(() => unprotect(self), 0);
    },
  }))
  .actions(self => ({
    afterCreate(): void {
      reaction(() => self.job && self.filteredIds, self.createGears);
      autorun(() => loadGearDataOfLevelRange(self.minLevel, self.maxLevel));
    },
  }));

export interface IStore extends Instance<typeof Store> {}
