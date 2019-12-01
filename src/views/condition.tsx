import * as React from 'react';
import { observer } from 'mobx-react-lite';
import { Ripple } from '@rmwc/ripple';
import { Button } from '@rmwc/button';
import { TextField } from '@rmwc/textfield';
import { useStore } from './context';
import { Icon } from './icon';
import { JobSelector } from './job-selector';

const Condition = observer(() => {
  const store = useStore();
  const { condition } = store;
  type ExpandedPanel = 'job' | 'materia' | 'import' | 'share' | 'history' | null;
  const [ expandedPanel, setExpandedPanel ] = React.useState<ExpandedPanel>(null);
  const toggleExpandedPanel = (panel: ExpandedPanel) => setExpandedPanel(v => v === panel ? null : panel);
  return (
    <div className="condition card">
      {store.condition.job === undefined ? (
        <span className="condition_job -empty">选择一个职业开始配装</span>
      ) : (
        <Ripple>
          <span className="condition_job" onClick={() => toggleExpandedPanel('job')}>
            <Icon className="condition_job-icon" name="jobs/WHM" />
            <span className="condition_job-name">{store.schema.name}</span>
          </span>
        </Ripple>
      )}
      <span className="condition_divider" />
      <span className="condition_level">
        <span className="condition_level-value">
          <ConditionLevelInput
            value={condition.minLevel}
            onChange={value => condition.setMinLevel(value)}
          />
          <span className="condition_level-separator">-</span>
          <ConditionLevelInput
            value={condition.maxLevel}
            onChange={value => condition.setMaxLevel(value)}
          />
        </span>
        品级
      </span>
      {store.condition.job !== undefined && <span className="condition_divider" />}
      {store.condition.job !== undefined && (
        <Button className="condition_button">魔晶石</Button>
      )}
      <span className="condition_right">
        {store.condition.job !== undefined && (
          <Button className="condition_button">分享</Button>
        )}
        <Button className="condition_button" onClick={() => toggleExpandedPanel('import')}>导入</Button>
        <Button className="condition_button">历史记录</Button>
        <span className="condition_divider" />
        <span className="condition_version">游戏版本 {condition.versionString}</span>
      </span>
      {(store.condition.job === undefined || expandedPanel === 'job') && <JobSelector />}
      {expandedPanel === 'import' && (
        <div>
          <a
            href={encodeURI(`javascript:void(document.body.appendChild(document.createElement('script')).src='`
               + location.origin + location.pathname + `import.js?'+Math.random())`)}
          >导入配装</a>
        </div>
      )}
    </div>
  );
});

interface ConditionLevelInputProps {
  value: number;
  onChange: (value: number) => void;
}
const ConditionLevelInput = observer<ConditionLevelInputProps>(({ value, onChange })  => {
  const [ inputValue, setInputValue ] = React.useState(value.toString());
  const inputRef = React.useRef<HTMLInputElement>(null);
  React.useEffect(() => {
    const handleWheel = (e: HTMLElementEventMap['wheel']) => {
      e.preventDefault();
      if (e.deltaY !== 0) {
        (e.target as HTMLInputElement).focus();
        const delta = e.deltaY < 0 ? 5 : -5;
        setInputValue(v => (parseInt(v) + delta).toString());
      }
    };
    // FIXME: use onWheel when https://github.com/facebook/react/issues/14856 fix
    inputRef.current!.addEventListener('wheel', handleWheel);
    return () => inputRef.current!.removeEventListener('wheel', handleWheel);
  }, []);
  return (
    <TextField
      inputRef={inputRef}
      className="condition_level-input"
      value={inputValue}
      onBlur={() => onChange(parseInt(inputValue))}
      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setInputValue(e.target.value)}
    />
  );
});

export { Condition };
