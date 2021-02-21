import * as React from 'react';
import * as mobxReact from 'mobx-react-lite';
import * as classNames from 'classnames';
import { Tab, TabBar } from '@rmwc/tabs';
import { Switch } from '@rmwc/switch';
import * as G from '../game';
import { useStore } from './components/contexts';

export const MateriaOverallPanel = mobxReact.observer(() => {
  const store = useStore();
  const [ activeTab, setActiveTab ] = React.useState(0);
  return (
    <div className="materia-overall card">
      <div className="materia-overall_tabbar">
        <TabBar
          activeTabIndex={activeTab}
          onActivate={e => setActiveTab(e.detail.index)}
        >
          <Tab>用量预估</Tab>
          <Tab style={{ visibility: 'hidden', pointerEvents: 'none' }}>批量镶嵌</Tab>
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
              *以此成功率完成全部镶嵌所需的数量
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
        <div>TBD</div>
      )}
    </div>
  );
});
