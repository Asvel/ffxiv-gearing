import * as React from 'react';
import * as mobxReact from 'mobx-react-lite';
import * as classNames from 'classnames';
import { Button } from '@rmwc/button';
import { Tab, TabBar } from '@rmwc/tabs';
import { List, SimpleListItem, CollapsibleList } from '@rmwc/list';
import { TextField } from '@rmwc/textfield';
import { Radio } from '@rmwc/radio';
import { Switch } from '@rmwc/switch';
import Clipboard from 'react-clipboard.js';
import * as G from '../game';
import { useStore } from './components/contexts';
import { RippleLazy } from './components/RippleLazy';
import { Icon } from './components/Icon';
import { Dropdown } from './components/Dropdown';
import { JobSelector } from './job-selector';

export const Condition = mobxReact.observer(() => {
  const store = useStore();
  type ExpandedPanel = 'job' | 'materia' | null;  // FIXME
  const [ expandedPanel, setExpandedPanel ] = React.useState<ExpandedPanel>(null);
  const toggleExpandedPanel = (panel: ExpandedPanel) => setExpandedPanel(v => v === panel ? null : panel);
  const welcoming = store.job === undefined;
  const editing = !store.isViewing && store.job !== undefined;
  const viewing = store.isViewing && store.job !== undefined;
  return (
    <div className="condition card" style={store.job === undefined ? { width: '900px' } : {}}>
      {welcoming && (
        <span className="condition_job -empty">选择一个职业开始配装</span>
      )}
      {editing && (
        <RippleLazy>
          <span className="condition_job" onClick={() => toggleExpandedPanel('job')}>
            <Icon className="condition_job-icon" name={'jobs/' + store.job} />
            <span className="condition_job-name">{store.schema.name}</span>
          </span>
        </RippleLazy>
      )}
      {viewing && (
        <span className="condition_job">
          <Icon className="condition_job-icon" name={'jobs/' + store.job} />
          <span className="condition_job-name">{store.schema.name}</span>
        </span>
      )}
      {editing && <span className="condition_divider" />}
      {editing && (
        <span className="condition_level">
          <span className="condition_level-value">
            <ConditionLevelInput
              value={store.minLevel}
              onChange={value => store.setMinLevel(value)}
            />
            <span className="condition_level-separator">-</span>
            <ConditionLevelInput
              value={store.maxLevel}
              onChange={value => store.setMaxLevel(value)}
            />
          </span>
          品级
        </span>
      )}
      {(editing || viewing) && <span className="condition_divider" />}
      {viewing && store.schema.levelSyncable && store.syncLevelText !== undefined && (
        <>
          <span className="condition_text">
            <Icon className="condition_level-sync-icon" name="sync" />
            {store.syncLevelText}
          </span>
          <span className="condition_divider" />
        </>
      )}
      {editing && store.schema.levelSyncable && (
        <Dropdown
          label={({ ref, toggle }) => (
            <Button ref={ref} className="condition_button" onClick={toggle}>
              {store.syncLevelText !== undefined && <Icon className="condition_level-sync-icon" name="sync" />}
              {store.syncLevelText ?? '品级同步'}
            </Button>
          )}
          popper={({ toggle }) => {
            return (
              <div className="level-sync card">
                <List>
                  {G.jobLevels.map(jobLevel=> jobLevel <= store.schema.jobLevel && (
                    <CollapsibleList
                      key={jobLevel}
                      defaultOpen={jobLevel >= store.schema.jobLevel - 10}
                      handle={
                        <SimpleListItem
                          className="level-sync_group"
                          text={`${jobLevel}级`}
                          metaIcon={<Icon className="level-sync_group-icon" name="chevron-right" />}
                        />
                      }
                      children={
                        <div className="level-sync_levels">
                          {G.syncLevels[jobLevel].map(level => (
                            <RippleLazy key={level}>
                              <span
                                className={classNames(
                                  'level-sync_level',
                                  G.syncLevelIsPopular[level] && '-popular',
                                  level === store.syncLevel && '-selected',
                                )}
                                onClick={() => {
                                  store.setSyncLevel(level, jobLevel);
                                  toggle();
                                }}
                                children={level}
                              />
                            </RippleLazy>
                          ))}
                          {jobLevel !== store.schema.jobLevel && (
                            <RippleLazy>
                              <span
                                className={classNames(
                                  'level-sync_job-level-sync',
                                  jobLevel === store.jobLevel && store.syncLevel === undefined && '-selected',
                                )}
                                onClick={() => {
                                  store.setSyncLevel(undefined, jobLevel);
                                  toggle();
                                }}
                                children="仅同步等级"
                              />
                            </RippleLazy>
                          )}
                        </div>
                      }
                    />
                  ))}
                  <Button
                    className="level-sync_cancel"
                    onClick={() => {
                      store.setSyncLevel(undefined, undefined);
                      toggle();
                    }}
                    children="取消同步"
                  />
                </List>
              </div>
            );
          }}
          placement="bottom-start"
        />
      )}
      {(editing || viewing) && (
        <Dropdown
          label={({ ref, toggle }) => (
            <Button ref={ref} className="condition_button" onClick={toggle}>魔晶石</Button>
          )}
          popper={() => {
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
          }}
          placement="bottom-start"
        />
      )}
      <span className="condition_right">
        {editing && (
          <Dropdown
            label={({ ref, toggle }) => (
              <Button ref={ref} className="condition_button" onClick={toggle}>分享</Button>
            )}
            popper={() => (
              <div className="share card">
                <a className="share_url" href={store.shareUrl} target="_blank">{store.shareUrl}</a>
                <div className="share_tip">分享时只会包含选中的装备。</div>
                <Clipboard
                  className="share_copy"
                  component="span"
                  data-clipboard-text={store.shareUrl}
                  children={<Button>复制</Button>}
                />
              </div>
            )}
            placement="bottom-end"
          />
        )}
        {(welcoming || editing) && (
          <Dropdown
            label={({ ref, toggle }) => (
              <Button ref={ref} className="condition_button" onClick={toggle}>导入</Button>
            )}
            popper={() => (
              <div className="import card">
                <div className="import_title">使用方法：</div>
                <div>将下方的链接添加为浏览器书签（一种较方便的方式是拖拽下方链接至书签栏），</div>
                <div>然后打开想导入的配装所在的页面，点击此书签。</div>
                <a
                  ref={r => r?.setAttribute('href', encodeURI(
                    `javascript:void(document.body.appendChild(document.createElement('script')).src='`
                    + window.location.origin + window.location.pathname + `import.js?'+Math.random())`))}
                  className="import_bookmarklet"
                  onClick={e => e.preventDefault()}
                  children="导入配装"
                />
                <div className="import_title">目前支持从以下配装器导入：</div>
                <div>Ariyala&apos;s Final Fantasy XIV Toolkit (ffxiv.ariyala.com)</div>
                <div>FF14俺tools：装備シミュレータ (ffxiv.es.exdreams.net)</div>
                <div>Etro (etro.gg)</div>
                <div>FFXIV Teamcraft (ffxivteamcraft.com)</div>
                <div className="import_warn">此功能可能因上述站点的设计变动而失效，如遇到不可用请反馈。</div>
              </div>
            )}
            placement="bottom-end"
          />
        )}
        {viewing && (
          <Button
            className="condition_button"
            onClick={() => {
              store.startEditing();
              // TODO: recheck behavior
              window.history.pushState(null, document.title, window.location.href.replace(/\?.*$/, ''));
            }}
            children="编辑"
          />
        )}
        {/* <Button className="condition_button">历史记录</Button> */}
        {(editing || viewing) && (
          <Dropdown
            label={({ ref, toggle }) => (
              <Button ref={ref} className="condition_button condition_setting" onClick={toggle}>设置</Button>
            )}
            popper={() => (
              <div className="setting card">
                <div className="setting_section">
                  <span className="setting_title">装备名显示方式</span>
                  <span className="setting_sub">国服未实装的装备总会显示为装备来源</span>
                </div>
                <div className="setting_controls">
                  <Radio
                    label="显示装备名"
                    checked={store.setting.gearDisplayName === 'name'}
                    onChange={() => store.setting.setGearDisplayName('name')}
                  />
                  <Radio
                    label="显示装备来源"
                    checked={store.setting.gearDisplayName === 'source'}
                    onChange={() => store.setting.setGearDisplayName('source')}
                  />
                </div>
                <div className="setting_section">
                  <span className="setting_title">装备颜色方案</span>
                </div>
                <div className="setting_controls">
                  <Radio
                    label="区分竞品"
                    checked={store.setting.gearColorScheme === 'source'}
                    onChange={() => store.setting.setGearColorScheme('source')}
                  />
                  <Radio
                    label="按稀有度上色"
                    checked={store.setting.gearColorScheme === 'rarity'}
                    onChange={() => store.setting.setGearColorScheme('rarity')}
                  />
                  <Radio
                    label="不上色"
                    checked={store.setting.gearColorScheme === 'none'}
                    onChange={() => store.setting.setGearColorScheme('none')}
                  />
                </div>
                <div className="setting_section">
                  <span className="setting_title">魔晶石显示方式</span>
                </div>
                <div className="setting_controls">
                  <Radio
                    label="显示增益的属性"
                    checked={store.setting.materiaDisplayName === 'stat'}
                    onChange={() => store.setting.setMateriaDisplayName('stat')}
                  />
                  <Radio
                    label="显示魔晶石本身的名字"
                    checked={store.setting.materiaDisplayName === 'materia'}
                    onChange={() => store.setting.setMateriaDisplayName('materia')}
                  />
                </div>
                <div className="setting_section">
                  <span className="setting_title">展示包含魔晶石增益的装备属性</span>
                </div>
                <div className="setting_controls">
                  <Radio
                    label="是，展示实际生效的属性"
                    checked={store.setting.displayMeldedStats}
                    onChange={() => store.setting.setDisplayMeldedStats(true)}
                  />
                  <Radio
                    label="否，展示装备的原始属性"
                    checked={!store.setting.displayMeldedStats}
                    onChange={() => store.setting.setDisplayMeldedStats(false)}
                  />
                </div>
                <div className="setting_section">
                  <span className="setting_title">高饱和度模式</span>
                  <span className="setting_sub">如果默认高亮颜色难以辨识请启用此模式</span>
                </div>
                <div className="setting_controls">
                  <Radio
                    label="不启用"
                    checked={!store.setting.highSaturation}
                    onChange={() => store.setting.setHighSaturation(false)}
                  />
                  <Radio
                    label="启用"
                    checked={store.setting.highSaturation}
                    onChange={() => store.setting.setHighSaturation(true)}
                  />
                </div>
              </div>
            )}
            placement="bottom-end"
          />
        )}
        <span className="condition_divider" />
        <span className="condition_text">数据版本 {G.versions.data}</span>
      </span>
      {(store.job === undefined || expandedPanel === 'job') && <JobSelector />}
    </div>
  );
});

interface ConditionLevelInputProps {
  value: number;
  onChange: (value: number) => void;
}
const ConditionLevelInput = mobxReact.observer<ConditionLevelInputProps>(({ value, onChange })  => {
  const [ inputValue, setInputValue ] = React.useState(value.toString());
  const [ prevValue, setPrevValue ] = React.useState(value);
  if (value !== prevValue) {
    setInputValue(value.toString());
    setPrevValue(value);
  }
  const inputRef = React.useRef<HTMLInputElement>(null);
  React.useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (e.deltaY !== 0) {
        (e.target as HTMLInputElement).focus();
        const delta = e.deltaY < 0 ? 5 : -5;
        setInputValue(v => (parseInt(v, 10) + delta).toString());
      }
    };
    // FIXME: use onWheel when https://github.com/facebook/react/issues/14856 fix
    const input = inputRef.current!;
    input.addEventListener('wheel', handleWheel);
    return () => input.removeEventListener('wheel', handleWheel);
  }, []);
  return (
    <TextField
      inputRef={inputRef}
      className="condition_level-input"
      value={inputValue}
      onFocus={() => inputRef.current?.select()}
      onBlur={() => onChange(parseInt(inputValue, 10) || 0)}
      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setInputValue(e.target.value)}
    />
  );
});
