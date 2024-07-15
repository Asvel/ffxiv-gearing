import * as mobx from 'mobx';
import * as mst from 'mobx-state-tree';
import * as G from '../game';
import * as share from '../share';
import { floor, ceil, ISetting, Promotion, IGear, IFood, GearUnion, IGearUnion, GearUnionReference, IMateria,
  gearDataOrdered, gearDataLoading, loadGearDataOfGearId, loadGearDataOfLevelRange } from '.';

const globalClanKey = 'ffxiv-gearing.dt.clan';

export type Mode = 'edit' | 'view';

export type FilterPatch = 'all' | 'next' | 'current';
export type FilterFocus = 'no' | 'melded' | 'comparable';

export const Store = mst.types
  .model('Store', {
    mode: mst.types.optional(mst.types.string as mst.ISimpleType<Mode>, 'edit'),
    job: mst.types.maybe(mst.types.string as mst.ISimpleType<G.Job>),
    jobLevel: mst.types.optional(mst.types.number as mst.ISimpleType<G.JobLevel>, 100),
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
    materiaOverallActiveTab: 0,
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
        const { job, minLevel, maxLevel, filterPatch } = self;
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
    get isMateriaNamesSameWidth(): boolean {
      let lastWidth = -1;
      for (const gear of self.equippedGears.values()) {
        if (gear === undefined || gear.isFood) continue;
        for (const { name } of gear.materias) {
          if (name.length === 0) continue;
          let width = 0;
          for (let i = 0; i < name.length; i++) {
            width += name.charCodeAt(i) < 0x100 ? 1 : 2;
          }
          if (lastWidth !== -1 && width !== lastWidth) return false;
          lastWidth = width;
        }
      }
      return true;
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
      let advancedItemCount = 0;
      for (const consumptionOfStat of Object.values(consumption)) {
        for (const consumptionItem of Object.values(consumptionOfStat!)) {
          if (consumptionItem!.rates.length > 0) {
            advancedItemCount++;
          }
        }
      }
      const p90 = .90 ** (1 / advancedItemCount);
      const p99 = .99 ** (1 / advancedItemCount);
      const thresholds90: { pBelow: number, pAbove: number, increase: () => void }[] = [];
      const thresholds99: { pBelow: number, pAbove: number, increase: () => void }[] = [];
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
            if (ps[n][0] > p90 && n90 === 0) n90 = n;
            if (ps[n][0] > p99) break;
            n++;
          }
          consumptionItem!.confidence90 = consumptionItem!.safe + n90 - 1;
          consumptionItem!.confidence99 = consumptionItem!.safe + n - 1;
          thresholds90.push({ pBelow: ps[n90 - 1][0], pAbove: ps[n90][0],
            increase: () => consumptionItem!.confidence90++ });
          thresholds99.push({ pBelow: ps[n - 1][0], pAbove: ps[n][0],
            increase: () => consumptionItem!.confidence99++ });
        }
      }
      for (const [ threshold, pTarget ] of [[thresholds90, .90], [thresholds99, .99]] as const) {
        threshold.sort((a, b) => a.pBelow - b.pBelow);
        let pOverall = 1;
        for (const entry of threshold) {
          pOverall *= entry.pBelow;
        }
        for (const entry of threshold) {
          entry.increase();
          pOverall = pOverall / entry.pBelow * entry.pAbove;
          if (pOverall > pTarget) break;
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
      const bluAetherialMimicry = self.job === 'BLU' ? 200 : 0;
      const crtChance = floor(200 * (CRT! - sub) / div + 50 + bluAetherialMimicry) / 1000;
      const crtDamage = floor(200 * (CRT! - sub) / div + 1400) / 1000;
      const detDamage = floor((140 * (DET! - main) / det + 1000) / detTrunc) * detTrunc / 1000;
      const dhtChance = floor(550 * (DHT! - sub) / div + bluAetherialMimicry) / 1000;
      const tenDamage = floor(112 * ((TEN ?? sub) - sub) / div + 1000) / 1000;
      const weaponDamage = floor(main * statModifiers[attackMainStat]! / 1000) +
        ((mainStat === 'MND' || mainStat === 'INT' ? MDMG : PDMG) ?? 0) +
        (self.job === 'BLU' ? G.bluMdmgAdditions[self.equippedStats['INT']! - self.baseStats['INT']!] ?? 0 : 0);
      const mainDamage = floor((mainStat === 'VIT' ? levelMod.apTank : levelMod.ap) *
        (floor((self.equippedStats[attackMainStat] ?? 0) * (partyBonus ?? 1.05)) - main) / main + 100) / 100;
      const damage = 0.01 * weaponDamage * mainDamage * detDamage * tenDamage * traitDamageMultiplier *
        ((crtDamage - 1) * crtChance + 1) * (0.25 * dhtChance + 1);
      const gcd = floor(floor((1000 - floor(130 * ((SKS ?? SPS)! - sub) / div)) * 2500 / 1000) *
        (self.jobLevel >= 80 && statModifiers.gcd || 100) / 1000) / 100;
      const ssDamage = floor(130 * ((SKS ?? SPS)! - sub) / div + 1000) / 1000;
      const hp = levelMod.hp * statModifiers.hp +
        floor((mainStat === 'VIT' ? levelMod.vitTank : levelMod.vit) * (VIT! - main));
      const mp = floor(150 * ((PIE ?? main) - main) / div + 200);
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
        DET: calcTier(DET! - main, det / 140 * detTrunc),
        DHT: calcTier(DHT! - sub, div / 550),
        TEN: calcTier(TEN! - sub, div / 112),
        SKS: calcGcdTier(SKS! - sub, div / 130, (statModifiers.gcd ?? 100) / 1000),
        SPS: calcGcdTier(SPS! - sub, div / 130, (statModifiers.gcd ?? 100) / 1000),
        PIE: calcTier(PIE! - main, div / 150),
      };
    },
    get materiaDetDhtOptimized() {
      console.debug('materiaDetDhtOptimized');
      type Pair = number;  // a packed DET,DHT pair
      type Meld = [number, number];  // a meld assignment, [DET major materia amount, DET minor materia amount]
      type OriginalMelds = { DET: Meld, DHT: Meld, all: Meld };  // eslint-disable-line
      type Route = Pair[];  // a selection from possible pairs of every gear

      const pack = (stats: G.Stats): Pair => ((stats.DET ?? 0) << 16) | (stats.DHT ?? 0);
      const unpack = (pair: Pair) => ([ pair >> 16, pair & ~(-1 << 16) ]);
      const mapPush = <TKey, TItem>(map: Map<TKey, TItem[]>, key: TKey, item: TItem) => {
        const items = map.get(key) ?? [];
        items.push(item);
        map.set(key, items);
      };

      const gearOriginalMelds = new Map<G.GearId, OriginalMelds>();
      let food: IFood | undefined;
      let fixedPair = pack(self.baseStats);
      const freeGears: IGear[] = [];
      const freeMajorSlots: IMateria[] = [];
      const freeMinorSlots: IMateria[] = [];
      const freePossiblePairMelds = new Map<Pair, Meld[]>();
      const crucialGears: IGear[] = [];
      const crucialGearPossiblePairMelds: Map<Pair, Meld[]>[] = [];
      mobx.runInAction(() => {  // this action only modifies the replica
        const replica = Store.create(mst.getSnapshot(self));
        replica.unprotect();

        for (const gear of replica.equippedGears.values()) {
          if (gear === undefined) continue;
          if (gear.isFood) {
            food = gear;
            continue;
          }

          const slots = gear.materias.filter(m => m.stat === 'DET' || m.stat === 'DHT' || m.stat === undefined);
          const originalMelds: OriginalMelds = { DET: [0, 0], DHT: [0, 0], all: [0, 0] };
          for (const materia of slots) {
            materia.grade = materia.meldableGrades[0];
            const meldType = materia.isRestricted ? 1 : 0;
            if (materia.stat === 'DET') originalMelds['DET'][meldType]++;
            if (materia.stat === 'DHT') originalMelds['DHT'][meldType]++;
            originalMelds['all'][meldType]++;
          }
          gearOriginalMelds.set(gear.id, originalMelds);

          for (const materia of slots) materia.stat = 'DET';
          const pairAllDet = pack(gear.stats);
          const overcapAllDet = gear.currentMeldableStats.DET! < 0;
          for (const materia of slots) materia.stat = 'DHT';
          const pairAllDht = pack(gear.stats);
          const overcapAllDht = gear.currentMeldableStats.DHT! < 0;
          if (pairAllDet === pairAllDht) {
            // this gear is unaffected by DET/DHT materias, preserve stat value only
            fixedPair += pairAllDet;
          } else if (!overcapAllDet && !overcapAllDht && (freeGears.length === 0 ||
              gear.materias[0].meldableGrades[0] === freeGears[0].materias[0].meldableGrades[0])) {
            // this gear is free to meld from over cap, treat all these gears as one joint gear for better performance
            freeGears.push(gear);
            for (const materia of slots) {
              (materia.isRestricted ? freeMinorSlots : freeMajorSlots).push(materia);
            }
          } else {
            // this gear might over cap, need to enumerate respectively
            crucialGears.push(gear);
            const majorSlots = slots.filter(m => !m.isRestricted);
            const minorSlots = slots.filter(m => m.isRestricted);
            const pairMelds = new Map<Pair, Meld[]>();
            for (let majorDetAmount = 0; majorDetAmount <= majorSlots.length; majorDetAmount++) {
              if (majorDetAmount > 0) majorSlots[majorDetAmount - 1].stat = 'DET';
              for (const minorSlot of minorSlots) minorSlot.stat = 'DHT';
              for (let minorDetAmount = 0; minorDetAmount <= minorSlots.length; minorDetAmount++) {
                if (minorDetAmount > 0) minorSlots[minorDetAmount - 1].stat = 'DET';
                const pair = pack(gear.stats);
                mapPush(pairMelds, pair, [majorDetAmount, minorDetAmount]);
              }
            }
            for (const pair of pairMelds.keys()) {  // prune completely inferior pairs
              const [ DET, DHT ] = unpack(pair);
              for (const pair2 of pairMelds.keys()) {
                if (pair === pair2) continue;
                const [ DET2, DHT2 ] = unpack(pair2);
                if (DET <= DET2 && DHT <= DHT2) {
                  pairMelds.delete(pair);
                  break;
                }
              }
            }
            crucialGearPossiblePairMelds.push(pairMelds);
          }
        }

        for (let majorDetAmount = 0; majorDetAmount <= freeMajorSlots.length; majorDetAmount++) {
          if (majorDetAmount > 0) freeMajorSlots[majorDetAmount - 1].stat = 'DET';
          for (const minorSlot of freeMinorSlots) minorSlot.stat = 'DHT';
          for (let minorDetAmount = 0; minorDetAmount <= freeMinorSlots.length; minorDetAmount++) {
            if (minorDetAmount > 0) freeMinorSlots[minorDetAmount - 1].stat = 'DET';
            const pair = freeGears.reduce((sc, gear) => sc + pack(gear.stats), 0);
            mapPush(freePossiblePairMelds, pair, [majorDetAmount, minorDetAmount]);
          }
        }
      });

      const { main, sub, div, det, detTrunc } = G.jobLevelModifiers[self.jobLevel];
      const bluAetherialMimicry = self.job === 'BLU' ? 200 : 0;
      const foodDet = food?.stats?.['DET'] ?? 0;
      const foodDetRate = food?.statRates?.['DET'] ?? Infinity;
      const foodDht = food?.stats?.['DHT'] ?? 0;
      const foodDhtRate = food?.statRates?.['DHT'] ?? Infinity;

      let maxDamage = 0;
      let acceptableDamage = 0;
      const damagePossibleTotalPairs = new Map<number, Pair[]>();
      const totalPairPossibleRoutes = new Map<Pair, Route[]>();
      const combinedPossiblePairMelds = [freePossiblePairMelds].concat(crucialGearPossiblePairMelds);
      const route: Route = [];
      const search = (currentPair: Pair, gearIndex: number) => {
        if (gearIndex < combinedPossiblePairMelds.length) {
          for (const pair of combinedPossiblePairMelds[gearIndex].keys()) {
            route[gearIndex] = pair;
            search(currentPair + pair, gearIndex + 1);
          }
        } else {
          let [ DET, DHT ] = unpack(currentPair);
          DET += Math.min(foodDet, floor(DET * foodDetRate / 100));
          DHT += Math.min(foodDht, floor(DHT * foodDhtRate / 100));

          const detDamage = floor((140 * (DET - main) / det + 1000) / detTrunc) * detTrunc / 1000;
          const dhtChance = floor(550 * (DHT - sub) / div + bluAetherialMimicry) / 1000;
          const damage = detDamage * (0.25 * dhtChance + 1);
          if (damage > maxDamage) {
            maxDamage = damage;
            acceptableDamage = damage * 0.9997;
          }
          if (damage > acceptableDamage) {
            const totalPair = pack({ DET, DHT });
            mapPush(damagePossibleTotalPairs, damage, totalPair);
            mapPush(totalPairPossibleRoutes, totalPair, route.slice());
          }
        }
      };
      search(fixedPair, 0);
      for (const damage of damagePossibleTotalPairs.keys()) {
        if (damage <= acceptableDamage) {
          damagePossibleTotalPairs.delete(damage);
        }
      }
      const damages = new Float64Array(damagePossibleTotalPairs.keys()).sort().reverse();
      const goodTotalPairs: Pair[] = [];
      for (const damage of damages) {
        goodTotalPairs.push(...new Set(damagePossibleTotalPairs.get(damage)!).values());
      }

      // ↑ determine good DET/DHT distribution
      // ↓ determine corresponding materia assignment

      const freeOriginalMelds: OriginalMelds = { DET: [0, 0], DHT: [0, 0], all: [0, 0] };
      const freeOriginalMaterias: IMateria[] = [];
      const freeGearMateriaPositions: Map<G.GearId, number[]> = new Map();
      for (const gear of freeGears) {
        for (const [ stat, meld ] of Object.entries(freeOriginalMelds)) {
          meld[0] += gearOriginalMelds.get(gear.id)![stat as keyof OriginalMelds][0];
          meld[1] += gearOriginalMelds.get(gear.id)![stat as keyof OriginalMelds][1];
        }
        freeGearMateriaPositions.set(gear.id, []);
      }
      for (let materiaIndex = 0; materiaIndex < 5; materiaIndex++) {
        for (const gear of freeGears) {
          const originalGead = self.gears.get(gear.id) as IGear;
          if (materiaIndex < originalGead.materias.length) {
            freeGearMateriaPositions.get(gear.id)![materiaIndex] = freeOriginalMaterias.length;
            freeOriginalMaterias.push(originalGead.materias[materiaIndex]);
          }
        }
      }

      const combinedPossiblePairDistance: Map<Pair, number>[] =
        Array.from({ length: combinedPossiblePairMelds.length }, () => new Map());
      const combinedPossiblePairMateriaStats: Map<Pair, G.Stat[]>[] =
        Array.from({ length: combinedPossiblePairMelds.length }, () => new Map());
      const solutions = goodTotalPairs.map(totalPair => {
        const routes = totalPairPossibleRoutes.get(totalPair)!;
        let bestDistance = Infinity;
        let bestRoute: Route | undefined;
        for (const route of routes) {
          let routeDistance = 0;
          for (let gearIndex = 0; gearIndex < route.length; gearIndex++) {
            const pair = route[gearIndex];
            let distance = combinedPossiblePairDistance[gearIndex].get(pair);
            if (distance === undefined) {
              distance = Infinity;
              let bestMateriaStats: G.Stat[] = [];
              const melds = combinedPossiblePairMelds[gearIndex].get(pair)!;
              for (const meld of melds) {
                let currentDistance = 0;
                const originalMaterias = gearIndex === 0 ? freeOriginalMaterias :
                  (self.gears.get(crucialGears[gearIndex - 1].id) as IGear).materias;
                const originalMelds = gearIndex === 0 ? freeOriginalMelds :
                  gearOriginalMelds.get(crucialGears[gearIndex - 1].id)!;
                const materiaStats = originalMaterias.map(m => m.stat);
                for (const meldType of [0, 1]) {
                  const statMeld = { DET: meld[meldType], DHT: originalMelds['all'][meldType] - meld[meldType] };
                  for (const stat of ['DET', 'DHT'] as const) {
                    let retrieveAmount = originalMelds[stat][meldType] - statMeld[stat];
                    let materiaIndex = originalMaterias.length - 1;
                    while (retrieveAmount > 0) {
                      const materia = originalMaterias[materiaIndex];
                      if (materia.stat === stat && (materia.isRestricted === (meldType === 1))) {
                        currentDistance += 1000 + materia.gear.materias.length - materia.index;
                        materiaStats[materiaIndex] = undefined;
                        retrieveAmount--;
                      }
                      materiaIndex--;
                    }
                  }
                  for (const stat of ['DET', 'DHT'] as const) {
                    let meldAmount = statMeld[stat] - originalMelds[stat][meldType];
                    let materiaIndex = 0;
                    while (meldAmount > 0) {
                      if (materiaStats[materiaIndex] === undefined) {
                        materiaStats[materiaIndex] = stat;
                        meldAmount--;
                      }
                      materiaIndex++;
                    }
                  }
                }
                if (currentDistance < distance) {
                  distance = currentDistance;
                  bestMateriaStats = materiaStats.slice() as G.Stat[];
                }
              }
              combinedPossiblePairDistance[gearIndex].set(pair, distance);
              combinedPossiblePairMateriaStats[gearIndex].set(pair, bestMateriaStats);
            }
            routeDistance += distance;
          }
          if (routeDistance < bestDistance) {
            bestDistance = routeDistance;
            bestRoute = route;
          }
        }
        const gearMateriaStats: Map<G.GearId, G.Stat[]> = new Map();
        for (let gearIndex = 0; gearIndex < bestRoute!.length; gearIndex++) {
          const pair = bestRoute![gearIndex];
          const materiaStats = combinedPossiblePairMateriaStats[gearIndex].get(pair)!;
          if (gearIndex === 0) {
            for (const [ gearId, positions ] of freeGearMateriaPositions.entries()) {
              gearMateriaStats.set(gearId, positions.map(p => materiaStats[p]));
            }
          } else {
            gearMateriaStats.set(crucialGears[gearIndex - 1].id, materiaStats);
          }
        }
        const [ DET, DHT ] = unpack(totalPair);
        return { DET, DHT, gearMateriaStats };
      });
      return solutions;
    },
    get share(): string {
      if (self.job === undefined) return '';
      const gears: G.Gearset['gears'] = [];
      for (const slot of self.schema.slots) {
        const gear = self.equippedGears.get(slot.slot.toString());
        if (gear === undefined) continue;
        gears.push({
          id: gear.data.id,
          materias: gear.isFood || gear.syncedLevel !== undefined ? [] :
            gear.materias.map(m => m.stat !== undefined ? [m.stat, m.grade!] : null),
          customStats: (gear as IGear).customStats?.toJSON(),
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
    setMateriaOverallActiveTab(activeTab: number) {
      self.materiaOverallActiveTab = activeTab;
    },
    setMateriaDetDhtOptimization(gearMateriaStats: Map<G.GearId, G.Stat[]>): void {
      for (const [ gearId, materiaStats ] of gearMateriaStats.entries()) {
        const gear = self.gears.get(gearId as any) as IGear;
        for (let i = 0; i < gear.materias.length; i++) {
          const materia = gear.materias[i];
          materia.stat = materiaStats[i];
          if (materia.stat === 'DET' || materia.stat === 'DHT') {
            materia.grade = materia.meldableGrades[0];
          }
        }
      }
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
        if (gear !== undefined && slot.levelWeight !== 0 && gear.id !== 17726) {  // 17726: Spearfishing Gig
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
      self.autoSelectScheduled = false;
      for (const gears of Object.values(self.groupedGears)) {
        let lastMeldable = gears[gears.length - 1];
        if (lastMeldable === undefined || lastMeldable.isFood || lastMeldable.slot === 17) continue;
        for (let i = gears.length - 1; i >= 0; i--) {
          if ((gears[i] as IGear).materiaAdvanced) {
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
