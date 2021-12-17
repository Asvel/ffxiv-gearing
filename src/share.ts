import * as base62 from './utils/base62';
import type * as G from './game';

const reverseMapping = <T>(map: T[]) => {
  const ret: any = {};
  for (let index = 0; index < map.length; index++) {
    ret[map[index]] = index;
  }
  return ret as T extends number ? { [index: number]: number } : { [index: string]: number };
};

const jobDecode: { job: G.Job, statDecode: G.Stat[] }[] = [
  { job: 'PLD', statDecode: ['CRT', 'DET', 'DHT', 'SKS', 'TEN'] },
  { job: 'WAR', statDecode: ['CRT', 'DET', 'DHT', 'SKS', 'TEN'] },
  { job: 'DRK', statDecode: ['CRT', 'DET', 'DHT', 'SKS', 'TEN'] },
  { job: 'GNB', statDecode: ['CRT', 'DET', 'DHT', 'SKS', 'TEN'] },
  { job: 'WHM', statDecode: ['CRT', 'DET', 'DHT', 'SPS', 'PIE'] },
  { job: 'SCH', statDecode: ['CRT', 'DET', 'DHT', 'SPS', 'PIE'] },
  { job: 'AST', statDecode: ['CRT', 'DET', 'DHT', 'SPS', 'PIE'] },
  { job: 'SGE', statDecode: ['CRT', 'DET', 'DHT', 'SPS', 'PIE'] },
  { job: 'MNK', statDecode: ['CRT', 'DET', 'DHT', 'SKS'] },
  { job: 'DRG', statDecode: ['CRT', 'DET', 'DHT', 'SKS'] },
  { job: 'NIN', statDecode: ['CRT', 'DET', 'DHT', 'SKS'] },
  { job: 'SAM', statDecode: ['CRT', 'DET', 'DHT', 'SKS'] },
  { job: 'RPR', statDecode: ['CRT', 'DET', 'DHT', 'SKS'] },
  { job: 'BRD', statDecode: ['CRT', 'DET', 'DHT', 'SKS'] },
  { job: 'MCH', statDecode: ['CRT', 'DET', 'DHT', 'SKS'] },
  { job: 'DNC', statDecode: ['CRT', 'DET', 'DHT', 'SKS'] },
  { job: 'BLM', statDecode: ['CRT', 'DET', 'DHT', 'SPS'] },
  { job: 'SMN', statDecode: ['CRT', 'DET', 'DHT', 'SPS'] },
  { job: 'RDM', statDecode: ['CRT', 'DET', 'DHT', 'SPS'] },
  { job: 'BLU', statDecode: ['CRT', 'DET', 'DHT', 'SPS'] },
  { job: 'CRP', statDecode: ['CMS', 'CRL', 'CP'] },
  { job: 'BSM', statDecode: ['CMS', 'CRL', 'CP'] },
  { job: 'ARM', statDecode: ['CMS', 'CRL', 'CP'] },
  { job: 'GSM', statDecode: ['CMS', 'CRL', 'CP'] },
  { job: 'LTW', statDecode: ['CMS', 'CRL', 'CP'] },
  { job: 'WVR', statDecode: ['CMS', 'CRL', 'CP'] },
  { job: 'ALC', statDecode: ['CMS', 'CRL', 'CP'] },
  { job: 'CUL', statDecode: ['CMS', 'CRL', 'CP'] },
  { job: 'MIN', statDecode: ['GTH', 'PCP', 'GP'] },
  { job: 'BTN', statDecode: ['GTH', 'PCP', 'GP'] },
  { job: 'FSH', statDecode: ['GTH', 'PCP', 'GP'] },
];
const jobEncode: { [index in G.Job]?: { index: number, statEncode: { [index in G.Stat]?: number } } } = {};
for (let index = 0; index < jobDecode.length; index++) {
  const item = jobDecode[index];
  const statEncode = reverseMapping(item.statDecode);
  jobEncode[item.job] = { index, statEncode };
}

const jobLevelDecode: G.JobLevel[] = [50, 60, 70, 80, 90];
const jobLevelEncode = reverseMapping(jobLevelDecode);

enum GearType {
  // NormalWithoutMateria = 0,
  // NormalWith1Materia = 1,
  // NormalWith2Materia = 2,
  // NormalWith3Materia = 3,
  // NormalWith4Materia = 4,
  // NormalWith5Materia = 5,
  Special = 6,
  Customizable = 7,
}

const specialGearDecode = [
  10337, 10338, 10339, 10340, 10341, 10342, 10343, 10344,  // Soul of the Crafter
  17726,  // Spearfishing Gig
] as G.GearId[];
const specialGearEncode = reverseMapping(specialGearDecode);

class Ranges {
  public version = 77;
  public job = 0;
  public jobLevel = 0;
  public syncLevel = 0;
  public gearType = 0;
  public gearId = 0;
  public materiaSlot = 0;
  public materiaStat = 0;
  public materiaGrade = 0;
  public specialGear = 0;
  public customStat = 0;
  private _version = 4;
  public useVersion(version: number) {
    this._version = version;
    if (version >= 4) {
      this.job = 31;  // jobDecode.length
      this.jobLevel = 5;  // jobLevelDecode.length
      this.syncLevel = 670;
      this.gearType = 8;  // gearTypes.length
      this.gearId = 50000;
      this.materiaSlot = 6;
      this.materiaGrade = 10;
      this.specialGear = 9;  // specialGearDecode.length
      this.customStat = 1001;
    }
  }
  public useJob(job: G.Job) {
    this.materiaStat = jobDecode[jobEncode[job]!.index].statDecode.length;  // TODO: version
  }
}

export function stringify({ job, jobLevel, syncLevel, gears }: G.Gearset): string {
  const version = 4;
  const ranges = new Ranges();
  ranges.useVersion(version);
  ranges.useJob(job);

  const { statEncode } = jobEncode[job]!;
  const { statDecode } = jobDecode[jobEncode[job]!.index];

  const gearTypeEncode: number[] = [];
  const materiaEncode: number[][] = [];  // materiaEncode[grade][statIndex]
  let hasInvalidMateria = false;
  materiaEncode[ranges.materiaGrade] = [];
  for (const { id, materias, customStats } of gears) {
    if (id in specialGearEncode) {
      gearTypeEncode[GearType.Special] = 1;
    } else if (customStats !== undefined) {
      gearTypeEncode[GearType.Customizable] = 1;
    } else {
      gearTypeEncode[materias.length] = 1;
      for (const materia of materias) {
        if (materia !== null && statEncode[materia[0]] !== undefined) {
          materiaEncode[materia[1]] ??= [];
          materiaEncode[materia[1]][statEncode[materia[0]]!] = 1;
        } else {
          hasInvalidMateria = true;
        }
      }
    }
  }

  let gearTypeRange = 0;
  for (let i = 0; i < ranges.gearType; i++) {
    if (gearTypeEncode[i] !== undefined) {
      gearTypeEncode[i] = gearTypeRange;
      gearTypeRange += 1;
    }
  }

  let materiaRange = 0;
  for (let grade = ranges.materiaGrade; grade >= 1; grade--) {
    if (materiaEncode[grade] === undefined) continue;
    for (let statIndex = 0; statIndex < ranges.materiaStat; statIndex++) {
      if (materiaEncode[grade][statIndex] !== undefined) {
        materiaEncode[grade][statIndex] = materiaRange;
        materiaRange += 1;
      }
    }
  }
  if (hasInvalidMateria) {
    materiaRange += 1;
  }

  let minMateriaGrade = 0;
  // eslint-disable-next-line no-unmodified-loop-condition
  while (!hasInvalidMateria && materiaEncode[minMateriaGrade] === undefined) minMateriaGrade++;

  const gearCodes: { id: G.GearId, materias: number[], customStats?: G.Stats }[] = [];
  const specialGears: G.GearId[] = [];
  for (const { id, materias, customStats } of gears) {
    if (!(id > 0)) {
      console.warn(`share.stringify: gear id ${id} invalid.`);
      continue;
    }
    if (id in specialGearEncode) {
      specialGears.push(id);
    } else {
      const materiaCodes = [];
      for (const materia of materias) {
        materiaCodes.push(materia === null || statEncode[materia[0]] === undefined
          ? materiaRange - 1  // use the largest materia code for empty slot
          : materiaEncode[materia[1]][statEncode[materia[0]]!]);
      }
      gearCodes.push({ id, materias: materiaCodes, customStats });
    }
  }
  if (gearCodes.length === 0 && specialGears.length === 0) return '';

  // try to preserve the original order of left ring and right ring
  // this may mismatch other slots in some cases, but these order won't affect anything
  let ringIndex = gearCodes.length - 1;
  while (gearCodes[ringIndex]?.materias.length === 0) ringIndex--;
  const ringsInversed = gearCodes[ringIndex - 1]?.id > gearCodes[ringIndex ]?.id;

  gearCodes.sort((a, b) => a.id - b.id);

  let gearIdDeltaRange = 0;
  for (let i = 1; i < gearCodes.length; i++) {
    const delta = gearCodes[i].id - gearCodes[i - 1].id;
    if (delta > gearIdDeltaRange) {
      gearIdDeltaRange = delta;
    }
  }
  gearIdDeltaRange += 1;

  let gearIdDeltaDirection = 1;
  if (gearCodes.length > 1) {
    // reverse pack order in two case:
    // delta range is too large to be encoded into the first gear id
    // the first delta is smaller than the last, encode small value earlier can slightly shorten encoded string
    if (gearIdDeltaRange >= gearCodes[0].id ||
      gearCodes[1].id - gearCodes[0].id < gearCodes[gearCodes.length - 1].id - gearCodes[gearCodes.length - 2].id) {
      gearIdDeltaDirection = -1;
      gearCodes.reverse();
    }
    // the last id delta might be 0, it could break endding detect when decode
    // so we always increase it by 1, but do this can make it larger than delta range
    if (gearCodes[gearCodes.length - 1].id - gearCodes[gearCodes.length - 2].id ===
      gearIdDeltaDirection * gearIdDeltaRange - 1) {
      gearIdDeltaRange += 1;
    }
  }

  let result = BigInt(0);
  const write = (value: number, range: number) => {
    // console.debug('write', value, range);
    result = result * BigInt(range) + BigInt(value < range ? value : range - 1);
  };
  const writeBoolean = (value: boolean) => write(value ? 1 : 0, 2);

  for (let i = gearCodes.length - 1; i >= 0; i--) {
    const { id, materias, customStats } = gearCodes[i];
    if (i > 0) {
      const delta = (id - gearCodes[i - 1].id) * gearIdDeltaDirection;
      write(delta + (i === gearCodes.length - 1 ? 1 : 0), gearIdDeltaRange);
    } else {
      writeBoolean(ringsInversed);
      writeBoolean(gearIdDeltaDirection === 1);
      write(gearIdDeltaRange, id);
      write(id, ranges.gearId);
    }
    if (customStats !== undefined) {
      for (let i = statDecode.length - 1; i >= 0; i--) {
        write(customStats[statDecode[i]] ?? 0, ranges.customStat);
      }
    } else {
      for (let i = materias.length - 1; i >= 0; i--) {
        write(materias[i], materiaRange);
      }
    }
    write(gearTypeEncode[customStats === undefined ? materias.length : GearType.Customizable], gearTypeRange);
  }

  for (const id of specialGears) {
    write(specialGearEncode[id], ranges.specialGear);
    write(gearTypeEncode[GearType.Special], gearTypeRange);
  }

  for (let grade = minMateriaGrade; grade <= ranges.materiaGrade; grade++) {
    if (grade === 0) continue;
    for (let statIndex = ranges.materiaStat - 1; statIndex >= 0; statIndex--) {
      writeBoolean(materiaEncode[grade]?.[statIndex] !== undefined);
    }
  }
  write(minMateriaGrade, ranges.materiaGrade + 1);

  for (let i = ranges.gearType - 1; i >= 0; i--) {
    writeBoolean(gearTypeEncode[i] !== undefined);
  }

  if (syncLevel !== undefined || jobLevel !== jobLevelDecode[ranges.jobLevel - 1]) {
    write(syncLevel ?? 0, ranges.syncLevel);
    write(jobLevelEncode[jobLevel], ranges.jobLevel);
    writeBoolean(true);
  } else {
    writeBoolean(false);
  }

  write(jobEncode[job]!.index, ranges.job);
  write(version, ranges.version);

  return base62.encode(result);
}

export function parse(s: string): G.Gearset | 'legacy' {
  let input = base62.decode(s);
  const read = (range: number): number => {
    const rangeBI = BigInt(range);
    const ret = input % rangeBI;
    input = input / rangeBI;
    return Number(ret);
  };
  const readBoolean = () => read(2) === 1;

  const ranges = new Ranges();

  const version = read(ranges.version);
  if (version < 4) return 'legacy';
  ranges.useVersion(version);

  const { job, statDecode } = jobDecode[read(ranges.job)];
  ranges.useJob(job);

  const synced = readBoolean();
  const jobLevel = jobLevelDecode[synced ? read(ranges.jobLevel) : ranges.jobLevel - 1];
  const syncLevel = synced && read(ranges.syncLevel) || undefined;

  const gearTypeDecode: number[] = [];
  for (let i = 0; i < ranges.gearType; i++) {
    if (readBoolean()) {
      gearTypeDecode.push(i);
    }
  }

  const minMateriaGrade = read(ranges.materiaGrade + 1);
  const materiaDecode: G.GearsetMaterias = [];
  for (let grade = ranges.materiaGrade; grade >= minMateriaGrade; grade--) {
    if (grade === 0) continue;
    for (let statIndex = 0; statIndex < ranges.materiaStat; statIndex++) {
      if (readBoolean()) {
        materiaDecode.push([statDecode[statIndex], grade as G.MateriaGrade]);
      }
    }
  }
  if (minMateriaGrade === 0) {
    materiaDecode.push(null);
  }

  const gears: G.Gearset['gears'] = [];
  let gearIdDeltaRange = 0;
  let gearIdDeltaDirection = 0;
  let ringsInversed = false;
  let id = -1;
  while (input !== BigInt(0)) {  // eslint-disable-line no-unmodified-loop-condition
    const gearType = gearTypeDecode[read(gearTypeDecode.length)];
    const materias: G.GearsetMaterias = [];
    let customStats: G.Stats | undefined;
    if (gearType === GearType.Special) {
      const id = specialGearDecode[read(ranges.specialGear)];
      gears.push({ id, materias });
      continue;
    }
    if (gearType === GearType.Customizable) {
      customStats = {};
      for (const stat of statDecode) {
        const value = read(ranges.customStat);
        if (value > 0) {
          customStats[stat] = value;
        }
      }
    } else {
      for (let i = 0; i < gearType; i++) {
        materias[i] = materiaDecode[read(materiaDecode.length)];
      }
    }
    if (id === -1) {
      id = read(ranges.gearId);
      gearIdDeltaRange = read(id);
      gearIdDeltaDirection = readBoolean() ? 1 : -1;
      ringsInversed = readBoolean();
    } else {
      id += (read(gearIdDeltaRange) - (input === BigInt(0) ? 1 : 0)) * gearIdDeltaDirection;
    }
    gears.push({ id: id as G.GearId, materias, customStats });
  }
  if (ringsInversed !== (gearIdDeltaDirection === -1)) {
    gears.reverse();
  }

  return { job, jobLevel, syncLevel, gears };
}

// const s = '1OUOJLa40M28M25Zx9onPbVFINb9tatYuSsZ';
// console.assert(stringify(parse(s)) === s);
