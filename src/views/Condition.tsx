import * as React from 'react';
import * as mobxReact from 'mobx-react-lite';
import { Button } from '@rmwc/button';
import { TextField } from '@rmwc/textfield';
import * as G from '../game';
import { useStore } from './components/contexts';
import { RippleLazy } from './components/RippleLazy';
import { Icon } from './components/Icon';
import { Dropdown } from './components/Dropdown';
import { JobSelector } from './JobSelector';
import { FilterPanel } from './FilterPanel';
import { LevelSyncPanel } from './LevelSyncPanel';
import { MateriaOverallPanel } from './MateriaOverallPanel';
import { SharePanel } from './SharePanel';
import { ImportPanel } from './ImportPanel';
import { SettingPanel } from './SettingPanel';

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
      {editing && (
        <Dropdown
          label={({ ref, toggle }) => (
            <Button ref={ref} className="condition_button condition_filter" onClick={toggle}>筛选</Button>
          )}
          popper={FilterPanel}
          placement="bottom-start"
        />
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
          popper={LevelSyncPanel}
          placement="bottom-start"
        />
      )}
      {(editing || viewing) && (
        <Dropdown
          label={({ ref, toggle }) => (
            <Button ref={ref} className="condition_button" onClick={toggle}>魔晶石</Button>
          )}
          popper={MateriaOverallPanel}
          placement="bottom-start"
        />
      )}
      <span className="condition_right">
        {editing && (
          <Dropdown
            label={({ ref, toggle }) => (
              <Button ref={ref} className="condition_button" onClick={toggle}>分享</Button>
            )}
            popper={SharePanel}
            placement="bottom-end"
          />
        )}
        {(welcoming || editing) && (
          <Dropdown
            label={({ ref, toggle }) => (
              <Button ref={ref} className="condition_button" onClick={toggle}>导入</Button>
            )}
            popper={ImportPanel}
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
            popper={SettingPanel}
            placement="bottom-end"
          />
        )}
        <span className="condition_divider" />
        <span className="condition_text">数据版本 {G.patches.data}</span>
      </span>
      {(store.job === undefined || expandedPanel === 'job') && <JobSelector />}
    </div>
  );
});

const ConditionLevelInput = mobxReact.observer<{
  value: number,
  onChange: (value: number) => void,
}>(({ value, onChange }) => {
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
    input.addEventListener('wheel', handleWheel, { passive: false });
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
