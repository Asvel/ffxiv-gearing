import * as mobxReact from 'mobx-react-lite';
import { Radio } from '@rmwc/radio';
import { useStore } from './components/contexts';

export const SettingPanel = mobxReact.observer(() => {
  const store = useStore();
  return (
    <div className="setting card">
      <div className="setting_section">
        <span className="setting_title">装备名显示方式</span>
        <span className="setting_sub">国服未实装的装备总会显示为获取途径</span>
      </div>
      <div className="setting_controls">
        <Radio
          label="显示装备名"
          checked={store.setting.gearDisplayName === 'name'}
          onChange={() => store.setting.setGearDisplayName('name')}
        />
        <Radio
          label="显示获取途径"
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
        <span className="setting_title">隐藏已废弃的装备</span>
        <span className="setting_sub">部分粉色稀有度的装备、未强化的旧点数装备</span>
      </div>
      <div className="setting_controls">
        <Radio
          label="隐藏"
          checked={store.setting.hideObsoleteGears}
          onChange={() => store.setting.setHideObsoleteGears(true)}
        />
        <Radio
          label="显示"
          checked={!store.setting.hideObsoleteGears}
          onChange={() => store.setting.setHideObsoleteGears(false)}
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
  );
});
