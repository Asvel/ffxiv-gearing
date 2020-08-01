import * as React from 'react';
import { observer } from 'mobx-react-lite';
import { Ripple } from '@rmwc/ripple';
import { Button } from '@rmwc/button';
import { TextField } from '@rmwc/textfield';
import Clipboard from 'react-clipboard.js';
import * as G from '../game';
import { useStore } from './context';
import { Icon } from './icon';
import { Dropdown } from './dropdown';
import { JobSelector } from './job-selector';

const ConditionEditing = observer(() => {
  const store = useStore();
  type ExpandedPanel = 'job' | 'materia' | null;
  const [ expandedPanel, setExpandedPanel ] = React.useState<ExpandedPanel>(null);
  const toggleExpandedPanel = (panel: ExpandedPanel) => setExpandedPanel(v => v === panel ? null : panel);
  return (
    <div className="condition card" style={store.job === undefined ? { width: '900px' } : {}}>
      {store.job === undefined ? (
        <span className="condition_job -empty">选择一个职业开始配装</span>
      ) : (
        <Ripple>
          <span className="condition_job" onClick={() => toggleExpandedPanel('job')}>
            <Icon className="condition_job-icon" name={'jobs/' + store.job} />
            <span className="condition_job-name">{store.schema.name}</span>
          </span>
        </Ripple>
      )}
      {store.job !== undefined && <span className="condition_divider" />}
      {store.job !== undefined && (
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
      {/*{store.job !== undefined && <span className="condition_divider" />}*/}
      {/*{store.job !== undefined && (*/}
      {/*  <Button className="condition_button">魔晶石</Button>*/}
      {/*)}*/}
      <span className="condition_right">
        {store.job !== undefined && (
          <Dropdown
            label={({ ref, toggle }) => (
              <Button ref={ref} className="condition_button" onClick={toggle}>分享</Button>
            )}
            popper={({ toggle }) => (
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
        <Dropdown
          label={({ ref, toggle }) => (
            <Button ref={ref} className="condition_button" onClick={toggle}>导入</Button>
          )}
          popper={({ toggle }) => (
            <div className="import card">
              <div className="import_title">使用方法：</div>
              <div>将下方的链接添加为浏览器书签（一种较方便的方式是拖拽下方链接至书签栏），</div>
              <div>然后打开想导入的配装所在的页面，点击此书签。</div>
              <a
                ref={r => r && r.setAttribute('href', encodeURI(
                  `javascript:void(document.body.appendChild(document.createElement('script')).src='`
                  + location.origin + location.pathname + `import.js?'+Math.random())`))}
                className="import_bookmarklet"
                onClick={e => e.preventDefault()}
                children="导入配装"
              />
              <div className="import_title">目前支持从以下配装器导入：</div>
              <div>Ariyala's Final Fantasy XIV Toolkit (ffxiv.ariyala.com)</div>
              <div>FF14俺tools：装備シミュレータ (ffxiv.es.exdreams.net)</div>
              <div>Etro (etro.gg)</div>
              <div className="import_warn">此功能可能因外部设计变动，不可预期地暂时不可用。</div>
            </div>
          )}
          placement="bottom-end"
        />
        {/*<Button className="condition_button">历史记录</Button>*/}
        <span className="condition_divider" />
        <span className="condition_version">数据版本 {G.versions.data}</span>
      </span>
      {(store.job === undefined || expandedPanel === 'job') && <JobSelector />}
    </div>
  );
});

const ConditionViewing = observer(() => {
  const store = useStore();
  return store.job === undefined ? null : (
    <div className="condition card">
      <span className="condition_job">
        <Icon className="condition_job-icon" name={'jobs/' + store.job} />
        <span className="condition_job-name">{store.schema.name}</span>
      </span>
      {/*<span className="condition_divider" />*/}
      {/*<Button className="condition_button">魔晶石</Button>*/}
      <span className="condition_right">
        <Button
          className="condition_button"
          onClick={() => {
            store.startEditing();
            history.pushState(null, document.title, location.href.replace(/\?.*$/, ''));  // TODO: recheck behavior
          }}
          children="编辑"
        />
        {/*<Button className="condition_button">历史记录</Button>*/}
        <span className="condition_divider" />
        <span className="condition_version">数据版本 {G.versions.data}</span>
      </span>
    </div>
  );
});

interface ConditionLevelInputProps {
  value: number;
  onChange: (value: number) => void;
}
const ConditionLevelInput = observer<ConditionLevelInputProps>(({ value, onChange })  => {
  const [ inputValue, setInputValue ] = React.useState(value.toString());
  const [ prevValue, setPrevValue ] = React.useState(value);
  if (value !== prevValue) {
    setInputValue(value.toString());
    setPrevValue(value);
  }
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

export { ConditionEditing, ConditionViewing };
