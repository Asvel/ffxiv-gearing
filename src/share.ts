import * as BI from './utils/BigInteger';
import * as G from './game';

const permanentIndexes: { job: G.Job, stats: G.Stat[] }[] = [
  { job: 'PLD', stats: ['CRT', 'DET', 'DHT', 'SKS', 'TEN'] },
  { job: 'WAR', stats: ['CRT', 'DET', 'DHT', 'SKS', 'TEN'] },
  { job: 'DRK', stats: ['CRT', 'DET', 'DHT', 'SKS', 'TEN'] },
  { job: 'GNB', stats: ['CRT', 'DET', 'DHT', 'SKS', 'TEN'] },
  { job: 'WHM', stats: ['CRT', 'DET', 'DHT', 'SPS', 'PIE'] },
  { job: 'SCH', stats: ['CRT', 'DET', 'DHT', 'SPS', 'PIE'] },
  { job: 'AST', stats: ['CRT', 'DET', 'DHT', 'SPS', 'PIE'] },
  { job: 'MNK', stats: ['CRT', 'DET', 'DHT', 'SKS'] },
  { job: 'DRG', stats: ['CRT', 'DET', 'DHT', 'SKS'] },
  { job: 'NIN', stats: ['CRT', 'DET', 'DHT', 'SKS'] },
  { job: 'SAM', stats: ['CRT', 'DET', 'DHT', 'SKS'] },
  { job: 'BRD', stats: ['CRT', 'DET', 'DHT', 'SKS'] },
  { job: 'MCH', stats: ['CRT', 'DET', 'DHT', 'SKS'] },
  { job: 'DNC', stats: ['CRT', 'DET', 'DHT', 'SKS'] },
  { job: 'BLM', stats: ['CRT', 'DET', 'DHT', 'SPS'] },
  { job: 'SMN', stats: ['CRT', 'DET', 'DHT', 'SPS'] },
  { job: 'RDM', stats: ['CRT', 'DET', 'DHT', 'SPS'] },
  { job: 'BLU', stats: ['CRT', 'DET', 'DHT', 'SPS'] },
  { job: 'CRP', stats: ['CMS', 'CRL', 'CP'] },
  { job: 'BSM', stats: ['CMS', 'CRL', 'CP'] },
  { job: 'ARM', stats: ['CMS', 'CRL', 'CP'] },
  { job: 'GSM', stats: ['CMS', 'CRL', 'CP'] },
  { job: 'LTW', stats: ['CMS', 'CRL', 'CP'] },
  { job: 'WVR', stats: ['CMS', 'CRL', 'CP'] },
  { job: 'ALC', stats: ['CMS', 'CRL', 'CP'] },
  { job: 'CUL', stats: ['CMS', 'CRL', 'CP'] },
  { job: 'MIN', stats: ['GTH', 'PCP', 'GP'] },
  { job: 'BTN', stats: ['GTH', 'PCP', 'GP'] },
  { job: 'FSH', stats: ['GTH', 'PCP', 'GP'] },
];

const toIndex: { [index in G.Job]?: { index: number, stats: { [index in G.Stat]?: number } } } = {};
for (let index = 0; index < permanentIndexes.length; index++) {
  const item = permanentIndexes[index];
  const stats: { [index in G.Stat]?: number } = {};
  for (let j = 0; j < item.stats.length; j++) {
    stats[item.stats[j]] = j;
  }
  toIndex[item.job] = { index, stats };
}

class Ranges {
  public version = 77;
  public job = 0;
  public jobLevel = 0;
  public syncLevel = 0;
  public gearId = 0;
  public materiaSlot = 0;
  public materiaStat = 0;
  public materiaGrade = 0;
  public materiaCode = 0;
  private _version = 1;
  public useVersion(version: number) {
    this._version = version;
    if (version === 1 || version === 2) {
      this.job = 29;  // permanentIndexes.length,
      this.jobLevel = 80;
      this.gearId = 50000;
      this.materiaSlot = 6;
      this.materiaGrade = 8;
    }
    if (version === 2) {
      this.syncLevel = 540;
    }
  }
  public useJob(job: G.Job) {
    this.materiaStat = permanentIndexes[toIndex[job]!.index].stats.length;  // TODO: versoin
    this.materiaCode = this.materiaStat * this.materiaGrade + 1;
  }
}

export function stringify({ job, jobLevel, syncLevel, gears }: G.Gearset): string {
  const version = 2;
  const ranges = new Ranges();
  ranges.useVersion(version);
  ranges.useJob(job);

  const gearCodes: { id: number, materias: number[]  }[] = [];
  const materiaCodeSet: { [index: string]: number } = {};

  let minGearId = Infinity;
  let maxGearId = 0;
  let maxMateriaCode = 0;

  for (const { id, materias } of gears) {
    if (id < minGearId) {
      minGearId = id;
    }
    if (id > maxGearId) {
      maxGearId = id;
    }
    const materiaCodes = [];
    for (const materia of materias) {
      const statToIndex = toIndex[job]!.stats;
      const materiaCode = materia === null || statToIndex[materia[0]] === undefined ? 0 :
        statToIndex[materia[0]]! * ranges.materiaGrade + (materia[1] - 1) + 1;
      if (materiaCodeSet[materiaCode] === undefined) {
        materiaCodeSet[materiaCode] = maxMateriaCode++;
      }
      materiaCodes.push(materiaCodeSet[materiaCode]);
    }
    gearCodes.push({ id, materias: materiaCodes });
  }

  if (gearCodes.length === 0) return '';
  gearCodes.reverse();

  const materiaCodes: number[] = [];
  for (const materiaCode of Object.keys(materiaCodeSet)) {
    materiaCodes[materiaCodeSet[materiaCode]] = parseInt(materiaCode, 10);
  }

  let result: BI.BigInteger = 0;
  const write = (value: number, range: number) => {
    result = BI.add(BI.multiply(result, range), value);
  };

  for (const gear of gearCodes) {
    write(gear.id - minGearId, maxGearId - minGearId + 1);
    for (const materiaCodeIndex of gear.materias) {
      write(materiaCodeIndex, materiaCodes.length);
    }
    write(gear.materias.length, ranges.materiaSlot);
  }
  write(minGearId, maxGearId);
  write(maxGearId, ranges.gearId);
  for (const materiaCode of materiaCodes) {
    write(materiaCode, ranges.materiaCode);
  }
  write(materiaCodes.length, ranges.materiaCode);
  write(syncLevel ?? 0, ranges.syncLevel);
  write(jobLevel - 1, ranges.jobLevel);
  write(toIndex[job]!.index, ranges.job);
  write(version, ranges.version);

  return BI.toString(result, 62);
}

export function parse(s: string): G.Gearset {
  let input = BI.parseInt(s, 62);
  const read = (range: number): number => {
    const ret = BI.remainder(input, range);
    input = BI.divide(input, range);
    return ret as number;
  };

  const ranges = new Ranges();

  const version = read(ranges.version);
  ranges.useVersion(version);

  const job = permanentIndexes[read(ranges.job)];  // FIXME
  ranges.useJob(job.job);

  let jobLevel = read(ranges.jobLevel) + 1 as G.JobLevel;
  if (version === 1) jobLevel = 80;  // job level not used and may incorrect in old version
  const syncLevel = version >= 2 && read(ranges.syncLevel) || undefined;

  const materiaCodes = Array.from({ length: read(ranges.materiaCode) }, () => {
    let materiaCode = read(ranges.materiaCode);
    if (materiaCode > 0) {
      materiaCode -= 1;
      const grade = materiaCode % ranges.materiaGrade + 1;
      const stat = job.stats[Math.floor(materiaCode / ranges.materiaGrade + 1e-7)];
      return [stat, grade] as [G.Stat, G.MateriaGrade];
    } else {
      return null;
    }
  }).reverse();

  const maxGearId = read(ranges.gearId);
  const minGearId = read(maxGearId);
  const gears: G.Gearset['gears'] = [];
  while (input !== 0) {  // eslint-disable-line no-unmodified-loop-condition
    const materias = Array.from({ length: read(ranges.materiaSlot) },
      () => materiaCodes[read(materiaCodes.length)]).reverse();
    const id = (read(maxGearId - minGearId + 1) + minGearId) as G.GearId;
    gears.push({ id, materias });
  }
  if (gears.find(g => g.id === minGearId) === undefined) {
    gears.push({ id: minGearId as G.GearId, materias: [] });
  }

  return { job: job.job, jobLevel, syncLevel, gears };
}

// const s = '2MFHiPtChpG469X2Q6XmJZFl7sznjKmbdsyoJ667Ge5It';
// console.assert(stringify(parse(s)) === s);
