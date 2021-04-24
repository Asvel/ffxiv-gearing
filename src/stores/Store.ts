import * as mobx from 'mobx';
import * as mst from 'mobx-state-tree';
import * as G from '../game';
import * as share from '../share';
import { floor, ceil, ISetting, Promotion, IGear, IFood, GearUnion, IGearUnion, GearUnionReference,
  gearDataOrdered, gearDataLoading, loadGearDataOfGearId, loadGearDataOfLevelRange } from '.';

const globalClanKey = 'ffxiv-gearing-clan';

export type Mode = 'edit' | 'view';

export type FilterPatch = 'all' | 'next' | 'current';
export type FilterFocus = 'no' | 'melded' | 'comparable';

export const Store = mst.types
  .model('Store', {
    mode: mst.types.optional(mst.types.string as mst.ISimpleType<Mode>, 'edit'),
    job: mst.types.maybe(mst.types.string as mst.ISimpleType<G.Job>),
    jobLevel: mst.types.optional(mst.types.number as mst.ISimpleType<G.JobLevel>, 80),
    minLevel: mst.types.optional(mst.types.number, 0),
    maxLevel: mst.types.optional(mst.types.number, 0),
    syncLevel: mst.types.maybe(mst.types.number),
    filterPatch: mst.types.optional(mst.types.string as mst.ISimpleType<FilterPatch>, 'all'),
    filterFocus: mst.types.optional(mst.types.string as mst.ISimpleType<FilterFocus>, 'no'),
    showAllFoods: mst.types.optional(mst.types.boolean, false),
    duplicateToolMateria: mst.types.optional(mst.types.boolean, true),
    gears: mst.types.map(GearUnion),
    equippedGears: mst.types.map(GearUnionReference),
  })
  .volatile(() => ({
    promotion: Promotion.create(),
    clan: Number(localStorage.getItem(globalClanKey)) || 0,
    autoSelectScheduled: false,
  }))
  .views(self => ({
    get setting(): ISetting {
      return mst.getEnv(self).setting;
    },
    get filteredIds(): G.GearId[] {
      console.debug('filteredIds');
      if (self.job === undefined) return [];
      if (self.mode === 'view') {
        return Array.from(self.gears.keys(), id => Number(id) as G.GearId);
      }
      const unobservableEquippedGears = mobx.untracked(() => self.equippedGears.toJSON());
      const ret: G.GearId[] = [];
      for (const gear of gearDataOrdered.get()) {
        const { job, minLevel, maxLevel, filterPatch, filterFocus } = self;
        if (
          G.jobCategories[gear.jobCategory][job!] &&
          (filterPatch === 'all' ||
            filterPatch === 'next' && !(gear.patch! > G.patches.next) ||
            filterPatch === 'current' && !(gear.patch! > G.patches.current)) &&
          (gear.slot === -1
            ? (self.showAllFoods || 'best' in gear) // Foods
            : gear.slot === 17 || (gear.slot === 2 && job === 'FSH') ||  // Soul crystal and spearfishing gig
              (gear.level >= minLevel && gear.level <= maxLevel &&
                !(gear.obsolete && this.setting.hideObsoleteGears))
          )
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
  }))
  .views(self => ({
    get isLoading(): boolean {
      return gearDataLoading.get();
    },
    get isViewing(): boolean {
      return self.mode === 'view';
    },
    get schema(): G.JobSchema {
      if (self.job === undefined) throw new ReferenceError();
      return G.jobSchemas[self.job];
    },
    get groupedGears(): { [index: number]: IGearUnion[] } {
      console.debug('groupedGears');
      const ret: { [index: number]: IGearUnion[] } = {};
      for (const gearId of self.filteredIds) {
        const gear = self.gears.get(gearId.toString())!;
        if (self.filterFocus !== 'no' && !gear.isFood && !gear.isMelded) continue;
        if (!(gear.slot in ret)) {
          ret[gear.slot] = [];
        }
        ret[gear.slot].push(gear);
      }
      return ret;
    },
    get baseStats(): G.Stats {
      if (self.job === undefined) return {};
      const levelModifier = G.jobLevelModifiers[self.jobLevel];
      const stats: G.Stats = { PDMG: 0, MDMG: 0 };
      for (const stat of this.schema.stats as G.Stat[]) {
        const baseStat = G.baseStats[stat] ?? 0;
        if (typeof baseStat === 'number') {
          stats[stat] = baseStat;
        } else {
          stats[stat] = floor(levelModifier[baseStat] * (this.schema.statModifiers[stat] ?? 100) / 100) +
            (!this.schema.noMainStatTrait && stat === this.schema.mainStat ? levelModifier.mainTrait : 0) +
            (G.clanStats[stat]?.[self.clan] ?? 0);
        }
      }
      return stats;
    },
    get equippedStatsWithoutFood(): G.Stats {
      if (self.job === undefined) return {};
      const stats: G.Stats = { ...this.baseStats };
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
      console.debug('equippedStats');
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
      let weight = 0;
      for (const slot of this.schema.slots) {
        level += (self.equippedGears.get(slot.slot)?.level ?? 0) * (slot.levelWeight ?? 1);
        weight += (slot.levelWeight ?? 1);
      }
      return floor(level / weight);
    },
    get materiaConsumption() {
      const consumption: { [index in G.Stat]?: { [index in G.MateriaGrade]?:
          { safe: number, expectation: number, confidence90: number, confidence99: number, rates: number[] } } } = {};
      for (const gear of self.equippedGears.values()) {
        if (gear === undefined || gear.isFood) continue;
        const duplicates = self.duplicateToolMateria &&
          (gear.slot === 1 || gear.slot === 2) && this.schema.toolMateriaDuplicates || 1;
        for (const materia of gear.materias) {
          if (materia.stat === undefined) continue;
          if (consumption[materia.stat] === undefined) {
            consumption[materia.stat] = {};
          }
          if (consumption[materia.stat]![materia.grade!] === undefined) {
            consumption[materia.stat]![materia.grade!] =
              { safe: 0, expectation: 0, confidence90: 0, confidence99: 0, rates: [] };
          }
          const consumptionItem = consumption[materia.stat]![materia.grade!]!;
          for (let i = 0; i < duplicates; i++) {
            if (materia.successRate === 100) {
              consumptionItem.safe += 1;
            } else {
              consumptionItem.expectation += 100 / materia.successRate!;
              consumptionItem.rates.push(materia.successRate! / 100);
            }
          }
        }
      }
      for (const consumptionOfStat of Object.values(consumption)) {
        for (const consumptionItem of Object.values(consumptionOfStat!)) {
          consumptionItem!.expectation = consumptionItem!.safe + Math.round(consumptionItem!.expectation);
          const p = consumptionItem!.rates;
          if (p.length === 0) {
            consumptionItem!.confidence90 = consumptionItem!.confidence99 = consumptionItem!.safe;
            continue;
          }
          const ps: number[][] = [];  // ps[n][i]: success rate of using n materias to meld slots p[i..]
          let n = 1;
          let n90 = 0;
          while (true) {
            ps[n] = [];
            ps[n][p.length - 1] = 1 - (1 - p[p.length - 1]) ** n;
            for (let i = p.length - 2; i >= 0; i--) {
              if (p.length - i > n) break;
              ps[n][i] = 0;
              for (let j = 1; j <= n - (p.length - i) + 1; j++) {
                ps[n][i] += (1 - p[i]) ** (j - 1) * p[i] * ps[n - j][i + 1];
              }
            }
            if (ps[n][0] > 0.9 && n90 === 0) n90 = n;
            if (ps[n][0] > 0.99) break;
            n++;
          }
          consumptionItem!.confidence90 = consumptionItem!.safe + n90;
          consumptionItem!.confidence99 = consumptionItem!.safe + n;
        }
      }
      return consumption;
    },
    get syncLevelText(): number | string | undefined {
      if (self.syncLevel !== undefined) {
        return self.syncLevel.toString();
      }
      if (self.jobLevel !== this.schema.jobLevel) {
        return self.jobLevel + '级';
      }
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
      console.debug('equippedEffects');
      const { statModifiers, mainStat, traitDamageMultiplier, partyBonus } = self.schema;
      if (statModifiers === undefined || mainStat === undefined || traitDamageMultiplier === undefined) return;
      const levelMod = G.jobLevelModifiers[self.jobLevel];
      const { main, sub, div, det, detTrunc } = levelMod;
      const { CRT, DET, DHT, TEN, SKS, SPS, VIT, PIE, PDMG, MDMG } = self.equippedStats;
      const attackMainStat = mainStat === 'VIT' ? 'STR' : mainStat;
      const crtChance = floor(200 * (CRT! - sub) / div + 50) / 1000;
      const crtDamage = floor(200 * (CRT! - sub) / div + 1400) / 1000;
      const detDamage = floor((130 * (DET! - main) / det + 1000) / detTrunc) * detTrunc / 1000;
      const dhtChance = floor(550 * (DHT! - sub) / div) / 1000;
      const tenDamage = floor(100 * ((TEN ?? sub) - sub) / div + 1000) / 1000;
      const weaponDamage = floor(main * statModifiers[attackMainStat]! / 1000) +
        ((mainStat === 'MND' || mainStat === 'INT' ? MDMG : PDMG) ?? 0) +
        (self.job === 'BLU' ? G.bluMdmgAdditions[self.equippedStats['INT']! - self.baseStats['INT']!] ?? 0 : 0);
      const mainDamage = floor((mainStat === 'VIT' ? levelMod.apTank : levelMod.ap) *
        (floor((self.equippedStats[attackMainStat] ?? 0) * (partyBonus ?? 1.05)) - main) / main + 100) / 100;
      const damage = 0.01 * weaponDamage * mainDamage * detDamage * tenDamage * traitDamageMultiplier *
        ((crtDamage - 1) * crtChance + 1) * (0.25 * dhtChance + 1);
      const gcd = floor(floor((1000 - floor(130 * ((SKS ?? SPS)! - sub) / div)) * 2500 / 1000) *
        (statModifiers.gcd ?? 100) / 1000) / 100;
      const ssDamage = floor(130 * ((SKS ?? SPS)! - sub) / div + 1000) / 1000;
      const hp = floor(levelMod.hp * statModifiers.hp / 100 +
        (mainStat === 'VIT' ? levelMod.vitTank : levelMod.vit) * (VIT! - main));
      const mp = floor(200 + ((PIE ?? main) - main) / 22);
      return { crtChance, crtDamage, detDamage, dhtChance, tenDamage, damage, gcd, ssDamage, hp, mp };
    },
    get equippedTiers(): { [index in G.Stat]?: { prev: number, next: number } } | undefined {
      const { statModifiers } = self.schema;
      if (statModifiers === undefined) return;
      const { main, sub, div, det, detTrunc } = G.jobLevelModifiers[self.jobLevel];
      const { CRT, DET, DHT, TEN, SKS, SPS, PIE } = self.equippedStats;
      function calcTier(value: number, multiplier: number) {
        if (Number.isNaN(value)) return undefined;
        const quotient = floor(value / multiplier);
        const prev = ceil(quotient * multiplier) - 1 - value;
        const next = ceil((quotient + 1) * multiplier) - value;
        return { prev, next };
      }
      function calcGcdTier(value: number, multiplier: number, modifier: number) {
        if (Number.isNaN(value)) return undefined;
        const gcdc = floor(floor((1000 - floor(value / multiplier)) * 2.5) * modifier);
        const prev = ceil((floor(1000 - ceil((gcdc + 1) / modifier) / 2.5) + 1) * multiplier) - 1 - value;
        const next = ceil((floor(1000 - ceil(gcdc / modifier) / 2.5) + 1) * multiplier) - value;
        return { prev, next };
      }
      return {
        CRT: calcTier(CRT! - sub, div / 200),
        DET: calcTier(DET! - main, det / 130 * detTrunc),
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
        jobLevel: self.jobLevel,
        syncLevel: self.syncLevel,
        gears,
      });
    },
    get shareUrl(): string {
      return window.location.origin + window.location.pathname + '?' + this.share;
    },
  }))
  .actions(self => ({
    createGears(): void {
      console.debug('createGears');
      for (const gearId of self.filteredIds) {
        if (!self.gears.has(gearId.toString())) {
          self.gears.put(GearUnion.create({ id: gearId }));
        }
      }
    },
    setMode(mode: Mode): void {
      self.mode = mode;
    },
    setJob(job: G.Job): void {
      const oldSchema = self.job && G.jobSchemas[self.job];
      const newSchema = G.jobSchemas[job];
      self.job = job;
      if (newSchema.jobLevel !== oldSchema?.jobLevel || !newSchema.levelSyncable) {
        self.jobLevel = newSchema.jobLevel;
        self.syncLevel = undefined;
      }
      if (newSchema.defaultItemLevel !== oldSchema?.defaultItemLevel) {
        self.minLevel = newSchema.defaultItemLevel[0];
        self.maxLevel = newSchema.defaultItemLevel[1];
      }
      for (const [ key, gear ] of self.equippedGears.entries()) {
        if (gear !== undefined && !gear.jobs[job]) {
          self.equippedGears.delete(key);
        }
      }
      self.autoSelectScheduled = newSchema.skeletonGears ?? false;
    },
    setMinLevel(level: number): void {
      self.minLevel = level;
    },
    setMaxLevel(level: number): void {
      self.maxLevel = level;
    },
    setSyncLevel(level: number | undefined, jobLevel: G.JobLevel | undefined): void {
      self.syncLevel = level;
      self.jobLevel = jobLevel ?? self.schema.jobLevel;
    },
    setFilterPatch(filterPatch: FilterPatch) {
      self.filterPatch = filterPatch;
    },
    setFilterFocus(filterFocus: FilterFocus) {
      self.filterFocus = filterFocus;
    },
    toggleShowAllFoods(): void {
      self.showAllFoods = !self.showAllFoods;
    },
    toggleDuplicateToolMateria(): void {
      self.duplicateToolMateria = !self.duplicateToolMateria;
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
    autoSelect(): void {
      if (!self.autoSelectScheduled) return;
      self.autoSelectScheduled = true;
      for (const gears of Object.values(self.groupedGears)) {
        let lastMeldable = gears[gears.length - 1];
        if (lastMeldable === undefined || lastMeldable.isFood || lastMeldable.slot === 17) continue;
        for (let i = gears.length - 1; i >= 0; i--) {
          if ((gears[i] as IGear).materias.length > 0) {
            lastMeldable = gears[i];
            break;
          }
        }
        if (!lastMeldable.isEquipped) {
          this.equip(lastMeldable);
        }
      }
    },
    unprotect(): void {
      mst.unprotect(self);
    },
  }))
  .actions(self => ({
    afterCreate(): void {
      for (const gearId of Object.values(self.equippedGears.toJSON())) {
        loadGearDataOfGearId(Math.abs(gearId as G.GearId));
      }
      mobx.autorun(() => loadGearDataOfLevelRange(self.minLevel, self.maxLevel));
      mobx.reaction(() => self.filteredIds, self.createGears, { fireImmediately: true });
      mobx.reaction(() => self.autoSelectScheduled && self.groupedGears, self.autoSelect);
    },
  }));

export interface IStore extends mst.Instance<typeof Store> {}
