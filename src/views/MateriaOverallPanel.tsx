import * as React from 'react';
import * as mobx from 'mobx';
import * as mobxReact from 'mobx-react-lite';
import classNames from 'clsx';
import { Button } from './@rmwc/button';
import { Radio } from './@rmwc/radio';
import { Tab, TabBar } from './@rmwc/tabs';
import { TextField } from './@rmwc/textfield';
import { Switch } from './@rmwc/switch';
import { Badge } from './@rmwc/badge';
import * as G from '../game';
import {
  calcGcd,
  calcRequiredSpeed,
  gcdOptimizationMaxSpeed,
  gcdOptimizationMaxTargetGcd,
  gcdOptimizationMinTargetGcd,
} from '../stores';
import type {
  GcdOptimizationMode,
  GcdOptimizationResult,
  GcdOptimizationSpeedRange,
  IGear,
  IGearUnion,
  ProductionMateriaOptimizationResult,
  ProductionMateriaStat,
} from '../stores';
import { useStore } from './components/contexts';

const tabIds = {
  consumption: 0,
  detDhtOptimization: 1,
  materiaClear: 3,
} as const;

function formatGcdTarget(gcd: number | undefined): string {
  const target = Math.min(
    gcdOptimizationMaxTargetGcd,
    Math.max(gcdOptimizationMinTargetGcd, gcd ?? gcdOptimizationMaxTargetGcd),
  );
  return target.toFixed(2);
}

function isValidGcdTarget(gcd: number): boolean {
  return Number.isFinite(gcd) && gcd >= gcdOptimizationMinTargetGcd && gcd <= gcdOptimizationMaxTargetGcd;
}

export const MateriaOverallPanel = mobxReact.observer(() => {
  const store = useStore();
  const materiaDetDhtOptimizationAvailable = !store.isViewing && store.schema.mainStat !== undefined;
  const tabs = [
    { id: tabIds.consumption, content: <Tab key="consumption">用量预估</Tab> },
    materiaDetDhtOptimizationAvailable && {
      id: tabIds.detDhtOptimization,
      content: (
        <Tab key="det-dht">
          信念/直击分配优化
          <Badge className="badge-button_badge" exited={!store.promotion.get('materiaDetDhtOptimization')} />
        </Tab>
      ),
    },
    !store.isViewing && { id: tabIds.materiaClear, content: <Tab key="clear">清空魔晶石</Tab> },
  ].filter(Boolean) as { id: number; content: React.ReactNode }[];
  const activeTab = tabs.some((tab) => tab.id === store.materiaOverallActiveTab)
    ? store.materiaOverallActiveTab
    : tabIds.consumption;
  const activeTabIndex = tabs.findIndex((tab) => tab.id === activeTab);
  return (
    <div className="materia-overall card">
      <div className="materia-overall_tabbar">
        <TabBar
          activeTabIndex={activeTabIndex}
          onActivate={(e) => {
            const nextTab = tabs[e.detail.index].id;
            store.setMateriaOverallActiveTab(nextTab);
            if (nextTab === tabIds.detDhtOptimization) {
              store.promotion.off('materiaDetDhtOptimization');
            }
          }}
        >
          {tabs.map((tab) => tab.content)}
        </TabBar>
      </div>
      {activeTab === tabIds.consumption && (
        <table className="materia-consumption table">
          <thead>
            <tr>
              <th>魔晶石</th>
              <th>安全孔</th>
              <th>期望</th>
              <th>90%*</th>
              <th>99%*</th>
            </tr>
          </thead>
          <tbody>
            {(() => {
              const ret = [];
              const stats = store.schema.stats.filter((stat) => stat in store.materiaConsumption);
              for (const stat of stats) {
                for (const grade of G.materiaGrades) {
                  const consumptionItem = store.materiaConsumption[stat]![grade];
                  if (consumptionItem === undefined) continue;
                  ret.push(
                    <tr key={stat + grade}>
                      <td>{G.getMateriaName(stat, grade, store.setting.materiaDisplayName === 'stat')}</td>
                      <td>{consumptionItem.safe}</td>
                      <td>{consumptionItem.expectation}</td>
                      <td>{consumptionItem.confidence90}</td>
                      <td>{consumptionItem.confidence99}</td>
                    </tr>,
                  );
                }
              }
              return ret;
            })()}
            {Object.keys(store.materiaConsumption).length === 0 && (
              <tr className="materia-consumption_empty">
                <td colSpan={5}>未镶嵌魔晶石</td>
              </tr>
            )}
            <tr className="materia-consumption_tip">
              <td colSpan={5}>
                *以此总体成功率完成全部镶嵌所需的数量
                {store.schema.toolMateriaDuplicates! > 1 && (
                  <div
                    className={classNames(
                      'materia-consumption_tool-duplicates',
                      !store.duplicateToolMateria && '-disabled',
                    )}
                  >
                    {`主副手的用量按照${store.schema.toolMateriaDuplicates}套计算`}
                    <Switch
                      className="materia-consumption_tool-duplicates-switch"
                      checked={store.duplicateToolMateria}
                      onChange={store.toggleDuplicateToolMateria}
                    />
                  </div>
                )}
              </td>
            </tr>
          </tbody>
        </table>
      )}
      {activeTab === tabIds.detDhtOptimization && <MateriaDetDhtOptimization />}
      {activeTab === tabIds.materiaClear && <MateriaClearPanel />}
    </div>
  );
});

const MateriaDetDhtOptimization = mobxReact.observer(() => {
  const store = useStore();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const solutions = React.useMemo(() => mobx.untracked(() => store.materiaDetDhtOptimized), []);
  return (
    <div className="materia-det-dht-optimization">
      <div className="materia-det-dht-optimization_introduce">
        <p>根据增伤期望优化配装的信念、直击魔晶石分配。</p>
        <p>
          {'直击属性对必定直击型技能的固定增伤量与对一般技能期望增伤量存在小幅差距，' +
            '直击类团辅也会小幅降低直击属性的收益，这些因素未被纳入考虑。'}
        </p>
        <p>
          {'选中的装备中，已镶嵌信念或直击魔晶石的孔洞和空置的孔洞将被视为可使用孔洞，' +
            '每个可使用孔洞将会被镶嵌此孔洞可镶嵌的最高等级魔晶石。'}
        </p>
      </div>
      <table className="materia-det-dht-optimization_solutions table">
        <thead>
          <tr>
            <th>信念</th>
            <th>直击</th>
            <th style={{ width: '99%' }} />
          </tr>
        </thead>
        <tbody>
          {solutions.map((solution, i) => (
            <tr key={i}>
              <td>{solution.DET}</td>
              <td>{solution.DHT}</td>
              <td>
                {solution.DET === store.equippedStats['DET'] && solution.DHT === store.equippedStats['DHT'] ? (
                  '已使用此方案'
                ) : (
                  <Button
                    className="materia-det-dht-optimization_use-solution"
                    onClick={() => store.setMateriaDetDhtOptimization(solution.gearMateriaStats)}
                    children="使用此方案"
                  />
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="materia-det-dht-optimization_tip">方案按增伤期望从高到低排序，所有方案的差距小于万分之三。</div>
    </div>
  );
});

export const SubStatCalculationPanel = mobxReact.observer(() => {
  const store = useStore();
  if (store.schema.stats.some((stat) => stat === 'CMS' || stat === 'GTH')) {
    return <ProductionMateriaCalculationPanel />;
  }
  return <MateriaGcdCalculationPanel />;
});

const ProductionMateriaCalculationPanel = mobxReact.observer(() => {
  const store = useStore();
  const stats = store.schema.stats as ProductionMateriaStat[];
  const [targets, setTargets] = React.useState<Record<string, string>>(() =>
    Object.fromEntries(
      stats.map((stat) => [
        stat,
        String(store.equippedStatsWithoutFood[stat] ?? store.productionMateriaBaseStats[stat] ?? 0),
      ]),
    ),
  );
  const [result, setResult] = React.useState<ProductionMateriaOptimizationResult>();
  const [calculating, setCalculating] = React.useState(false);
  const requestId = React.useRef(0);
  const parsed = Object.fromEntries(stats.map((stat) => [stat, Number(targets[stat])])) as G.Stats;
  const invalidStats = new Set(
    stats.filter(
      (stat) =>
        targets[stat].trim() === '' ||
        !Number.isInteger(parsed[stat]) ||
        parsed[stat]! < (store.productionMateriaBaseStats[stat] ?? 0),
    ),
  );
  const tooHighStats = new Set(
    stats.filter(
      (stat) => Number.isInteger(parsed[stat]) && parsed[stat]! > (store.productionMateriaMaximumStats[stat] ?? 0),
    ),
  );
  React.useEffect(
    () => () => {
      requestId.current++;
      store.cancelProductionMateriaOptimization();
    },
    [store],
  );
  const resetResult = () => {
    requestId.current++;
    store.cancelProductionMateriaOptimization();
    setCalculating(false);
    setResult(undefined);
  };
  const calculate = async () => {
    const currentRequestId = ++requestId.current;
    setCalculating(true);
    setResult(undefined);
    const nextResult = await store.optimizeProductionMateriaAsync(parsed);
    if (requestId.current === currentRequestId) {
      setResult(nextResult);
      setCalculating(false);
    }
  };
  return (
    <div className="production-materia-optimization card">
      <div className="production-materia-optimization_intro">
        输入目标三维，计算优先使用非主副手、且尽量使用低等级魔晶石的镶嵌方案。
      </div>
      <div className="production-materia-optimization_targets">
        {stats.map((stat) => {
          const minimum = store.productionMateriaBaseStats[stat] ?? 0;
          const invalid = invalidStats.has(stat) || tooHighStats.has(stat);
          return (
            <label className="production-materia-optimization_target" key={stat}>
              <span>{G.statNames[stat]}</span>
              <TextField
                className={classNames(
                  'production-materia-optimization_input mdc-text-field--compact',
                  invalid && '-invalid',
                )}
                type="number"
                min={minimum}
                step="1"
                value={targets[stat]}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                  setTargets({ ...targets, [stat]: e.target.value });
                  resetResult();
                }}
              />
              <small className={classNames(invalid && '-error')}>
                {tooHighStats.has(stat) ? `最高 ${store.productionMateriaMaximumStats[stat]}` : `基础 ${minimum}`}
              </small>
            </label>
          );
        })}
        {invalidStats.size > 0 && (
          <div className="production-materia-optimization_validation">目标属性不能低于装备基础属性，且必须为整数。</div>
        )}
        {invalidStats.size === 0 && tooHighStats.size > 0 && (
          <div className="production-materia-optimization_validation">目标属性超过当前装备的单项可达上限。</div>
        )}
        <Button disabled={invalidStats.size > 0 || tooHighStats.size > 0 || calculating} onClick={calculate}>
          {calculating ? '计算中' : '计算'}
        </Button>
      </div>
      <ProductionMateriaResultView result={result} />
    </div>
  );
});

const ProductionMateriaResultView = mobxReact.observer<{
  result: ProductionMateriaOptimizationResult | undefined;
}>(({ result }) => {
  const store = useStore();
  const stats = store.schema.stats as ProductionMateriaStat[];
  if (result === undefined) {
    return <div className="production-materia-optimization_empty">属性上限以内的溢出数值不会计入结果。</div>;
  }
  if (result.status === 'error') {
    return <div className="production-materia-optimization_message -error">{result.message}</div>;
  }
  if (result.status === 'unreachable') {
    return (
      <div className="production-materia-optimization_message -warning">
        <div>当前装备与孔位无法同时达到目标三维。</div>
        <div>{stats.map((stat) => `${G.statNames[stat]}单项最高 ${result.maximumStats[stat]}`).join('，')}</div>
      </div>
    );
  }
  const materiaCount = result.plan.reduce(
    (sum, gear) => sum + gear.materias.filter((materia) => materia.stat !== undefined).length,
    0,
  );
  return (
    <div className="production-materia-optimization_result">
      <table className="production-materia-optimization_summary table">
        <tbody>
          <tr>
            {stats.map((stat) => (
              <th key={stat}>{G.statNames[stat]}</th>
            ))}
          </tr>
          <tr>
            {stats.map((stat) => (
              <td key={stat}>{result.stats[stat]}</td>
            ))}
          </tr>
        </tbody>
      </table>
      <table className="production-materia-optimization_plan table">
        <tbody>
          {result.plan.flatMap((gearPlan) => {
            const materias = gearPlan.materias.filter((materia) => materia.stat !== undefined);
            if (materias.length === 0) return [];
            const slot = store.schema.slots.find((item) => item.slot === gearPlan.slot);
            return [
              <tr key={gearPlan.gearId}>
                <th>{slot?.shortName ?? slot?.name ?? gearPlan.slot}</th>
                <td>
                  {materias
                    .map((materia) =>
                      G.getMateriaName(materia.stat!, materia.grade!, store.setting.materiaDisplayName === 'stat'),
                    )
                    .join('　')}
                </td>
              </tr>,
            ];
          })}
        </tbody>
      </table>
      <div className="production-materia-optimization_note">
        {`共 ${materiaCount} 颗。`}
        {result.usesTools ? '非主副手孔位已全部使用，方案需要镶嵌主副手。' : '方案无需镶嵌主副手。'}
      </div>
      <Button
        className="production-materia-optimization_use"
        onClick={() => store.applyProductionMateriaOptimization(result)}
      >
        使用此方案
      </Button>
    </div>
  );
});

const MateriaGcdCalculationPanel = mobxReact.observer(() => {
  const store = useStore();
  const speedStat = store.schema.stats.includes('SPS') ? 'SPS' : 'SKS';
  const speedStatName = speedStat === 'SPS' ? '咏唱速度' : '技能速度';
  const candidateGears = store.filteredIds.flatMap((gearId) => {
    const gear = store.gears.get(gearId.toString()) as IGearUnion | undefined;
    return gear === undefined || gear.isFood ? [] : [gear];
  }) as IGear[];
  const candidateGearIds = candidateGears.map((gear) => gear.id);
  const candidateGearSourceGroups = Array.from(
    candidateGears.reduce((groups, gear) => {
      const source = gear.source ?? '其他';
      const gearIds = groups.get(source) ?? [];
      gearIds.push(gear.id);
      groups.set(source, gearIds);
      return groups;
    }, new Map<string, G.GearId[]>()),
  );
  const [mode, setMode] = React.useState<GcdOptimizationMode>('current');
  const [targetGcd, setTargetGcd] = React.useState(() => formatGcdTarget(store.equippedEffects?.gcd));
  const [speedRangeEnabled, setSpeedRangeEnabled] = React.useState(false);
  const [minimumSpeed, setMinimumSpeed] = React.useState('');
  const [maximumSpeed, setMaximumSpeed] = React.useState('');
  const [progressionEnabled, setProgressionEnabled] = React.useState(false);
  const [progressionWeeks, setProgressionWeeks] = React.useState('0');
  const [result, setResult] = React.useState<GcdOptimizationResult>();
  const [calculating, setCalculating] = React.useState(false);
  const requestId = React.useRef(0);
  const targetGcdNumber = parseFloat(targetGcd);
  const targetGcdValid = isValidGcdTarget(targetGcdNumber);
  const minimumSpeedNumber = Number(minimumSpeed);
  const maximumSpeedNumber = Number(maximumSpeed);
  const speedRangeValuesValid =
    minimumSpeed.trim() !== '' &&
    maximumSpeed.trim() !== '' &&
    Number.isSafeInteger(minimumSpeedNumber) &&
    Number.isSafeInteger(maximumSpeedNumber) &&
    minimumSpeedNumber >= 0 &&
    maximumSpeedNumber >= minimumSpeedNumber &&
    maximumSpeedNumber <= gcdOptimizationMaxSpeed;
  const baseSpeed = store.baseStats[speedStat] ?? G.jobLevelModifiers[store.jobLevel].sub;
  const targetRequiredSpeed = targetGcdValid
    ? calcRequiredSpeed(targetGcdNumber, store.jobLevel, store.schema.statModifiers)
    : Infinity;
  const speedRangeBelowBase = speedRangeValuesValid && maximumSpeedNumber < baseSpeed;
  const speedRangeConflictsWithTarget =
    speedRangeValuesValid && !speedRangeBelowBase && targetRequiredSpeed > maximumSpeedNumber;
  const speedRangeValid = speedRangeValuesValid && !speedRangeBelowBase && !speedRangeConflictsWithTarget;
  const speedRange: GcdOptimizationSpeedRange | undefined = speedRangeEnabled && speedRangeValid
    ? { min: minimumSpeedNumber, max: maximumSpeedNumber }
    : undefined;
  const progressionWeeksNumber = Number(progressionWeeks);
  const progressionWeeksValid =
    progressionWeeks.trim() !== '' &&
    Number.isInteger(progressionWeeksNumber) &&
    progressionWeeksNumber >= 0 &&
    progressionWeeksNumber <= 10;
  const selectedGearIdsKey = store.gcdOptimizationSelectedGearIds.join(',');
  const resetResult = React.useCallback(() => {
    requestId.current++;
    store.cancelGcdOptimization();
    setCalculating(false);
    setResult(undefined);
  }, [store]);
  React.useEffect(
    () => () => {
      requestId.current++;
      store.cancelGcdOptimization();
      store.stopGcdOptimizationGearSelection();
    },
    [store],
  );
  React.useEffect(() => {
    if (mode === 'all') resetResult();
  }, [mode, resetResult, selectedGearIdsKey]);
  const calculate = async () => {
    const currentRequestId = ++requestId.current;
    setCalculating(true);
    setResult(undefined);
    const nextResult = await store.optimizeGcdAsync(
      targetGcdNumber,
      mode,
      mode === 'all' ? store.gcdOptimizationSelectedGearIds : undefined,
      mode === 'all' && progressionEnabled ? progressionWeeksNumber : undefined,
      speedRange,
    );
    if (requestId.current === currentRequestId) {
      setResult(nextResult);
      setCalculating(false);
    }
  };
  return (
    <div className="materia-gcd-optimization card">
      <div className="materia-gcd-optimization_controls">
        <div className="materia-gcd-optimization_modes">
          <Radio
            label="优化当前装备"
            checked={mode === 'current'}
            onChange={() => {
              setMode('current');
              store.stopGcdOptimizationGearSelection();
              resetResult();
            }}
          />
          <Radio
            label="自动选择装备"
            checked={mode === 'all'}
            onChange={() => {
              setMode('all');
              store.startGcdOptimizationGearSelection(candidateGearIds);
              resetResult();
            }}
          />
        </div>
        <div className="materia-gcd-optimization_target">
          <span className="materia-gcd-optimization_label">目标 GCD</span>
          <TextField
            className="materia-gcd-optimization_input mdc-text-field--compact"
            type="number"
            min={gcdOptimizationMinTargetGcd.toFixed(2)}
            max={gcdOptimizationMaxTargetGcd.toFixed(2)}
            step="0.01"
            value={targetGcd}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
              setTargetGcd(e.target.value);
              resetResult();
            }}
          />
          <Button
            className="materia-gcd-optimization_calculate"
            disabled={
              !targetGcdValid ||
              (speedRangeEnabled && !speedRangeValid) ||
              calculating ||
              (mode === 'all' &&
                (store.gcdOptimizationSelectedGearIds.length === 0 || (progressionEnabled && !progressionWeeksValid)))
            }
            onClick={calculate}
          >
            {calculating ? '计算中' : '计算'}
          </Button>
        </div>
        <div className="materia-gcd-optimization_advanced">
          <Switch
            label="高级选项"
            checked={speedRangeEnabled}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
              setSpeedRangeEnabled(e.target.checked);
              resetResult();
            }}
          />
          {speedRangeEnabled && (
            <div className="materia-gcd-optimization_speed-range">
              <div className="materia-gcd-optimization_speed-range-controls">
                <span className="materia-gcd-optimization_label">最终{speedStatName}</span>
                <TextField
                  className={classNames(
                    'materia-gcd-optimization_speed-input mdc-text-field--compact',
                    !speedRangeValuesValid && '-invalid',
                  )}
                  aria-label={`${speedStatName}最小值`}
                  type="number"
                  min="0"
                  max={String(gcdOptimizationMaxSpeed)}
                  step="1"
                  placeholder="最小值"
                  value={minimumSpeed}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                    setMinimumSpeed(e.target.value);
                    resetResult();
                  }}
                />
                <span>–</span>
                <TextField
                  className={classNames(
                    'materia-gcd-optimization_speed-input mdc-text-field--compact',
                    (!speedRangeValuesValid || speedRangeBelowBase || speedRangeConflictsWithTarget) && '-invalid',
                  )}
                  aria-label={`${speedStatName}最大值`}
                  type="number"
                  min="0"
                  max={String(gcdOptimizationMaxSpeed)}
                  step="1"
                  placeholder="最大值"
                  value={maximumSpeed}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                    setMaximumSpeed(e.target.value);
                    resetResult();
                  }}
                />
              </div>
              {speedRangeValuesValid ? (
                <div className="materia-gcd-optimization_speed-range-tip">
                  {`含食物加成与边界值，该范围对应 ${calcGcd(
                    maximumSpeedNumber,
                    store.jobLevel,
                    store.schema.statModifiers,
                  ).toFixed(2)}s–${calcGcd(
                    minimumSpeedNumber,
                    store.jobLevel,
                    store.schema.statModifiers,
                  ).toFixed(2)}s GCD。`}
                </div>
              ) : (
                <div className="materia-gcd-optimization_speed-range-validation">
                  {`请输入 0–${gcdOptimizationMaxSpeed} 内、最小值不大于最大值的整数范围。`}
                </div>
              )}
              {speedRangeConflictsWithTarget && (
                <div className="materia-gcd-optimization_speed-range-validation">
                  {`目标 GCD 至少需要${speedStatName} ${targetRequiredSpeed}，已超过范围上限。`}
                </div>
              )}
              {speedRangeBelowBase && (
                <div className="materia-gcd-optimization_speed-range-validation">
                  {`${speedStatName}范围上限不能低于当前等级的基础值 ${baseSpeed}。`}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      {mode === 'all' && (
        <>
          <div className="materia-gcd-optimization_gear-selector">
            <span>{`参与计算的装备 ${store.gcdOptimizationSelectedGearIds.length}/${candidateGearIds.length}`}</span>
            <span className="materia-gcd-optimization_gear-selector-actions">
              <Button
                disabled={store.gcdOptimizationSelectedGearIds.length === candidateGearIds.length}
                onClick={() => {
                  store.setGcdOptimizationSelectedGearIds(candidateGearIds);
                }}
              >
                全选
              </Button>
              <Button
                disabled={store.gcdOptimizationSelectedGearIds.length === 0}
                onClick={() => {
                  store.setGcdOptimizationSelectedGearIds([]);
                }}
              >
                全不选
              </Button>
            </span>
          </div>
          <div className="materia-gcd-optimization_source-selector">
            <span className="materia-gcd-optimization_source-selector-label">按获取途径</span>
            <span className="materia-gcd-optimization_sources">
              {candidateGearSourceGroups.map(([source, gearIds]) => {
                const selectedCount = gearIds.filter((gearId) =>
                  store.gcdOptimizationSelectedGearIds.includes(gearId),
                ).length;
                const allSelected = selectedCount === gearIds.length;
                const partiallySelected = selectedCount > 0 && !allSelected;
                return (
                  <label className="materia-gcd-optimization_source" key={source}>
                    <input
                      type="checkbox"
                      checked={allSelected}
                      ref={(input) => {
                        if (input !== null) input.indeterminate = partiallySelected;
                      }}
                      onChange={() => {
                        const nextSelectedGearIds = new Set(store.gcdOptimizationSelectedGearIds);
                        for (const gearId of gearIds) {
                          if (allSelected) nextSelectedGearIds.delete(gearId);
                          else nextSelectedGearIds.add(gearId);
                        }
                        store.setGcdOptimizationSelectedGearIds(
                          candidateGearIds.filter((gearId) => nextSelectedGearIds.has(gearId)),
                        );
                      }}
                    />
                    <span>{source}</span>
                  </label>
                );
              })}
            </span>
          </div>
          <div className="materia-gcd-optimization_progression">
            <div className="materia-gcd-optimization_progression-controls">
              <Switch
                label="开荒装特化选项"
                checked={progressionEnabled}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                  setProgressionEnabled(e.target.checked);
                  resetResult();
                }}
              />
              {progressionEnabled && (
                <label className="materia-gcd-optimization_progression-weeks">
                  <span>准备周数</span>
                  <TextField
                    className={classNames(
                      'materia-gcd-optimization_progression-input mdc-text-field--compact',
                      !progressionWeeksValid && '-invalid',
                    )}
                    aria-label="准备周数"
                    type="number"
                    min="0"
                    max="10"
                    step="1"
                    value={progressionWeeks}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                      setProgressionWeeks(e.target.value);
                      resetResult();
                    }}
                  />
                  <span>周</span>
                </label>
              )}
            </div>
            {progressionEnabled && (
              <div className="materia-gcd-optimization_progression-tip">
                <div>
                  点数武器默认不参与计算。如需使用，请取消勾选其他武器，仅留点数武器一个选项； 将消耗 500 点数。
                </div>
                <div>
                  自动计算的开荒装伤害期望高但后续装备曲线不一定平滑。如有此方面需求建议确认毕业装后在计算开荒装时控制范围。
                </div>
              </div>
            )}
            {progressionEnabled && !progressionWeeksValid && (
              <div className="materia-gcd-optimization_progression-validation">准备周数必须是 0–10 之间的整数。</div>
            )}
          </div>
        </>
      )}
      <MateriaGcdOptimizationResultView result={result} />
    </div>
  );
});

const MateriaGcdOptimizationResultView = mobxReact.observer<{
  result: GcdOptimizationResult | undefined;
}>(({ result }) => {
  const store = useStore();
  if (result === undefined) {
    return (
      <div className="materia-gcd-optimization_empty">
        固定当前筛选条件，按目标 GCD 搜索伤害期望最高的魔晶石和食物方案。
      </div>
    );
  }
  if (result.status === 'error') {
    return <div className="materia-gcd-optimization_message -error">{result.message}</div>;
  }
  if (result.status === 'unreachable') {
    if (result.speedRange !== undefined) {
      return (
        <div className="materia-gcd-optimization_message -warning">
          <div>
            {`指定的${G.statNames[result.speedStat]}范围 [${result.speedRange.min}, ${result.speedRange.max}] 内没有可达方案。`}
          </div>
          {result.closestSpeed !== undefined && result.closestGcd !== undefined && (
            <div>{`最接近可达值为 ${result.closestSpeed}，对应 ${result.closestGcd.toFixed(2)}s GCD。`}</div>
          )}
        </div>
      );
    }
    return (
      <div className="materia-gcd-optimization_message -warning">
        <div>无法达到目标 GCD。</div>
        <div>{`最快可达 ${result.fastestGcd.toFixed(2)}s，${G.statNames[result.speedStat]} ${result.fastestSpeed}`}</div>
        <div>{`对应伤害期望 ${result.fastestDamage.toFixed(5)}`}</div>
      </div>
    );
  }
  return (
    <div className="materia-gcd-optimization_result">
      <table className="materia-gcd-optimization_summary table">
        <tbody>
          <tr>
            <th>最终 GCD</th>
            <td>{result.effects.gcd.toFixed(2)}s</td>
            <th>{G.statNames[result.speedStat]}</th>
            <td>{result.speed}</td>
          </tr>
          <tr>
            <th>伤害期望</th>
            <td>{result.effects.damage.toFixed(5)}</td>
            <th>变化</th>
            <td className={classNames(result.damageDelta >= 0 ? '-positive' : '-negative')}>
              {result.damageDelta >= 0 ? '+' : ''}
              {result.damageDelta.toFixed(5)}
            </td>
          </tr>
          <tr>
            <th>食物</th>
            <td colSpan={3}>{result.foodName}</td>
          </tr>
        </tbody>
      </table>
      {result.customSkipped && (
        <div className="materia-gcd-optimization_note">自动选择装备时已跳过未配置自定义属性的装备。</div>
      )}
      <Button
        className="materia-gcd-optimization_use"
        onClick={() => {
          store.applyGcdOptimization(result);
        }}
      >
        使用此方案
      </Button>
    </div>
  );
});

const MateriaClearPanel = mobxReact.observer(() => {
  const store = useStore();
  const [mode, setMode] = React.useState<'all' | 'selected'>('all');
  const [selectedSlots, setSelectedSlots] = React.useState<number[]>([]);
  const slotItems = store.schema.slots.flatMap((slot) => {
    const gear = store.equippedGears.get(slot.slot.toString()) as IGearUnion | undefined;
    if (gear === undefined || gear.isFood) return [];
    const materiaCount = gear.materias.filter((materia) => materia.stat !== undefined).length;
    if (materiaCount === 0) return [];
    return [{ slot, gear, materiaCount }];
  }) as { slot: G.SlotSchema; gear: Exclude<IGearUnion, { isFood: true }>; materiaCount: number }[];
  const selectedSlotSet = new Set(selectedSlots);
  const selectedMateriaCount =
    mode === 'all'
      ? slotItems.reduce((sum, item) => sum + item.materiaCount, 0)
      : slotItems.reduce((sum, item) => sum + (selectedSlotSet.has(item.slot.slot) ? item.materiaCount : 0), 0);
  return (
    <div className="materia-clear">
      <div className="materia-clear_controls">
        <Radio label="清空当前已选装备的全部魔晶石" checked={mode === 'all'} onChange={() => setMode('all')} />
        <Radio label="清空指定部位" checked={mode === 'selected'} onChange={() => setMode('selected')} />
      </div>
      {slotItems.length === 0 ? (
        <div className="materia-clear_empty">当前已选装备没有已配置的魔晶石。</div>
      ) : (
        <>
          {mode === 'selected' && (
            <div className="materia-clear_slots">
              {slotItems.map(({ slot, gear, materiaCount }) => (
                <button
                  key={slot.slot}
                  type="button"
                  className={classNames('materia-clear_slot', selectedSlotSet.has(slot.slot) && '-selected')}
                  onClick={() => {
                    setSelectedSlots((slots) =>
                      slots.includes(slot.slot) ? slots.filter((s) => s !== slot.slot) : slots.concat(slot.slot),
                    );
                  }}
                >
                  <span className="materia-clear_slot-name">{slot.shortName ?? slot.name}</span>
                  <span className="materia-clear_gear-name">{gear.name}</span>
                  <span className="materia-clear_count">{materiaCount}</span>
                </button>
              ))}
            </div>
          )}
          <div className="materia-clear_footer">
            <span className="materia-clear_summary">{`将清空 ${selectedMateriaCount} 颗魔晶石`}</span>
            <Button
              className="materia-clear_submit"
              disabled={selectedMateriaCount === 0}
              onClick={() => {
                store.clearMaterias(mode === 'all' ? undefined : selectedSlots);
                setSelectedSlots([]);
              }}
            >
              清空
            </Button>
          </div>
        </>
      )}
    </div>
  );
});
