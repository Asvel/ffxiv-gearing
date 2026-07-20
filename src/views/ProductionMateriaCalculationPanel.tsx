import * as React from 'react';
import * as mobxReact from 'mobx-react-lite';
import classNames from 'clsx';
import * as G from '../game';
import type { ProductionMateriaOptimizationResult, ProductionMateriaStat } from '../stores';
import { Button } from './@rmwc/button';
import { TextField } from './@rmwc/textfield';
import { useStore } from './components/contexts';

export const ProductionMateriaCalculationPanel = mobxReact.observer(() => {
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

