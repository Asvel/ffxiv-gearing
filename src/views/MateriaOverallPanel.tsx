import * as React from 'react';
import * as mobx from 'mobx';
import * as mobxReact from 'mobx-react-lite';
import classNames from 'clsx';
import { Button } from '@rmwc/button';
import { Tab, TabBar } from '@rmwc/tabs';
import { Switch } from '@rmwc/switch';
import { Badge } from '@rmwc/badge';
import * as G from '../game';
import { useStore } from './components/contexts';

export const MateriaOverallPanel = mobxReact.observer(() => {
  const store = useStore();
  const materiaDetDhtOptimizationAvailable = !store.isViewing && store.schema.mainStat !== undefined;
  let activeTab = store.materiaOverallActiveTab;
  if (activeTab === 1 && !materiaDetDhtOptimizationAvailable) {
    activeTab = 0;
  }
  return (
    <div className="materia-overall card">
      <div className="materia-overall_tabbar">
        <TabBar
          activeTabIndex={activeTab}
          onActivate={e => {
            store.setMateriaOverallActiveTab(e.detail.index);
            if (activeTab === 1) {
              store.promotion.off('materiaDetDhtOptimization');
            }
          }}
        >
          <Tab>用量预估</Tab>
          {materiaDetDhtOptimizationAvailable && (
            <Tab>
              信念/直击分配优化
              <Badge className="badge-button_badge" exited={!store.promotion.get('materiaDetDhtOptimization')} />
            </Tab>
          )}
        </TabBar>
      </div>
      {activeTab === 0 && (
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
            const stats = store.schema.stats.filter(stat => stat in store.materiaConsumption);
            for (const stat of stats) {
              for (const grade of G.materiaGrades) {
                const consumptionItem = store.materiaConsumption[stat]![grade];
                if (consumptionItem === undefined) continue;
                ret.push((
                  <tr key={stat + grade}>
                    <td>{G.getMateriaName(stat, grade, store.setting.materiaDisplayName === 'stat')}</td>
                    <td>{consumptionItem.safe}</td>
                    <td>{consumptionItem.expectation}</td>
                    <td>{consumptionItem.confidence90}</td>
                    <td>{consumptionItem.confidence99}</td>
                  </tr>
                ));
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
      {activeTab === 1 && (
        <MateriaDetDhtOptimization />
      )}
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
        <p>{'直击属性对必定直击型技能的固定增伤量与对一般技能期望增伤量存在小幅差距，' +
            '直击类团辅也会小幅降低直击属性的收益，这些因素未被纳入考虑。'}</p>
        <p>{'选中的装备中，已镶嵌信念或直击魔晶石的孔洞和空置的孔洞将被视为可使用孔洞，' +
            '每个可使用孔洞将会被镶嵌此孔洞可镶嵌的最高等级魔晶石。'}</p>
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
              {(solution.DET === store.equippedStats['DET'] && solution.DHT === store.equippedStats['DHT']) ? (
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
      <div className="materia-det-dht-optimization_tip">
        方案按增伤期望从高到低排序，所有方案的差距小于万分之三。
      </div>
    </div>
  );
});
