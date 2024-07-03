import * as mobxReact from 'mobx-react-lite';
import { Radio } from '@rmwc/radio';
import * as G from '../game';
import { useStore } from './components/contexts';

export const FilterPanel = mobxReact.observer(() => {
  const store = useStore();
  return (
    <div className="filter card">
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
