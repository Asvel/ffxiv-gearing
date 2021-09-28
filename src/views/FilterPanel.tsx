import * as mobxReact from 'mobx-react-lite';
import { Radio } from '@rmwc/radio';
import * as G from '../game';
import { useStore } from './components/contexts';

export const FilterPanel = mobxReact.observer(() => {
  const store = useStore();
  return (
    <div className="filter card">
      <div className="filter_section">
        <span className="filter_title">实装版本</span>
        <span className="filter_sub">当前时间点国服和国际服的装备已经没有差别（直到国际服更新6.0）</span>
      </div>
      <div className="filter_controls">
        <Radio
          label={`显示全部`}
          checked={store.filterPatch === 'all'}
          onChange={() => store.setFilterPatch('all')}
        />
        <Radio
          // label={`显示国服已实装和即将实装的项目（≤${G.patches.next}）`}
          label={`显示国服已实装和即将实装的项目`}
          checked={store.filterPatch === 'next'}
          onChange={() => store.setFilterPatch('next')}
        />
        <Radio
          // label={`只显示国服已实装的项目（≤${G.patches.current}）`}
          label={`只显示国服已实装的项目`}
          checked={store.filterPatch === 'current'}
          onChange={() => store.setFilterPatch('current')}
        />
      </div>
      <div className="filter_section">
        <span className="filter_title">“聚焦”模式</span>
        <span className="filter_sub">隐藏大部分装备，对比某几件</span>
      </div>
      <div className="filter_controls">
        <Radio
          label="不启用"
          checked={store.filterFocus === 'no'}
          onChange={() => store.setFilterFocus('no')}
        />
        <Radio
          label="只显示镶嵌了魔晶石的装备"
          checked={store.filterFocus === 'melded'}
          onChange={() => store.setFilterFocus('melded')}
        />
        <Radio
          label="只显示镶嵌了魔晶石的装备，并隐藏仅有一件装备可供选择的部位"
          checked={store.filterFocus === 'comparable'}
          onChange={() => store.setFilterFocus('comparable')}
        />
      </div>
    </div>
  );
});
