import * as React from 'react';
import * as mobx from 'mobx';
import * as mobxReact from 'mobx-react-lite';
import { Button } from '@rmwc/button';
import { TextField } from '@rmwc/textfield';
import * as G from '../game';
import { useStore } from './components/contexts';
import { RippleLazy } from './components/RippleLazy';
import { Icon } from './components/Icon';
import { Dropdown } from './components/Dropdown';
import { BadgeButton } from './components/BadgeButton';
import { JobSelector } from './JobSelector';
import { FilterPanel } from './FilterPanel';
import { LevelSyncPanel } from './LevelSyncPanel';
import { MateriaOverallPanel } from './MateriaOverallPanel';
import { SharePanel } from './SharePanel';
import { ImportPanel } from './ImportPanel';
import { SettingPanel } from './SettingPanel';

export const Condition = mobxReact.observer(() => {
  const store = useStore();
  const welcoming = store.job === undefined;
  const editing = !store.isViewing && store.job !== undefined;
  const viewing = store.isViewing && store.job !== undefined;
  return (
    <div className="condition card" style={store.job === undefined ? { width: '900px' } : {}}>
      {welcoming && (
        <span className="condition_job -empty">选择一个职业开始配装</span>
      )}
      {editing && (
        <Dropdown
          label={({ ref, toggle }) => (
            <RippleLazy>
              <span ref={ref} className="condition_job" onClick={toggle}>
                <Icon className="condition_job-icon" name={'jobs/' + store.job} />
                <span className="condition_job-name">{store.schema.name}</span>
              </span>
            </RippleLazy>
          )}
          popper={() => (
            <div className="job-select-panel card">
              <JobSelector />
            </div>
          )}
          placement="bottom-start"
          modifiers={[{ name: 'offset', options: { offset: [-4, 0] } }]}
        />
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
            <BadgeButton
              ref={ref}
              className="condition_button condition_filter"
              promotion="filter"
              onClick={toggle}
              children="筛选"
            />
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
        {viewing && (
          <Button
            className="condition_button"
            children="迁移至最新版本"
            onClick={() => {
              window.location.href = store.migrateUrl;
            }}
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
      {welcoming && <JobSelector />}
    </div>
  );
});

const ConditionLevelInput = (() => {
  let anyInstanceFocused = false;
  let delayedChange: Function | null = null;
  return mobxReact.observer<{
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
      const input = inputRef.current!;
      input.addEventListener('wheel', handleWheel, { passive: false });
      return () => input.removeEventListener('wheel', handleWheel);
    }, []);
    const handleChange = () => onChange(parseInt(inputValue, 10) || 0);
    return (
      <TextField
        inputRef={inputRef}
        className="condition_level-input mdc-text-field--compact"
        value={inputValue}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
          setInputValue(e.target.value);
        }}
        onFocus={e => {
          e.target.select();
          anyInstanceFocused = true;
        }}
        onBlur={() => {
          setTimeout(() => {
            if (!anyInstanceFocused) {
              mobx.runInAction(() => {
                delayedChange?.();
                delayedChange = null;
                handleChange();
              });
            } else {
              delayedChange = handleChange;
            }
          }, 0);
          anyInstanceFocused = false;
        }}
        onKeyPress={e => {
          if (e.key === 'Enter') {
            (e.target as HTMLInputElement).blur();
          }
        }}
      />
    );
  });
})();
