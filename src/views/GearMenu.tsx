import * as mobxReact from 'mobx-react-lite';
import type { IGearUnion } from '../stores';
import { useStore } from './components/contexts';
import { RippleLazy } from './components/RippleLazy';
import { Icon } from './components/Icon';
import type { DropdownPopperProps } from './components/Dropdown';

export const GearMenu = mobxReact.observer<{
  gear: IGearUnion,
  toggle: DropdownPopperProps['toggle'],
}>(({ gear, toggle }) => {
  const store = useStore();
  return (
    <div className="gear-menu card">
      <RippleLazy>
        <div
          className="gear-menu_item"
          onClick={() => {
            toggle();
            navigator.clipboard.writeText(gear.name);
          }}
        >
          复制道具名
          {!gear.isFood && gear.source && store.setting.gearDisplayName === 'source' && (
            '：' + gear.name
          )}
        </div>
      </RippleLazy>
      <div className="gear-menu_divider" />
      {!gear.isFood && gear.source && store.setting.gearDisplayName === 'name' && (
        <div className="gear-menu_item">获取途径：{gear.source}</div>
      )}
      {gear.stats.PDMG !== undefined && <div className="gear-menu_item">物理基本性能：{gear.stats.PDMG}</div>}
      {gear.stats.MDMG !== undefined && <div className="gear-menu_item">魔法基本性能：{gear.stats.MDMG}</div>}
      {gear.stats.DLY !== undefined && (
        <div className="gear-menu_item">攻击间隔：{(gear.stats.DLY / 1000).toFixed(2)}</div>
      )}
      <div className="gear-menu_divider" />
      <RippleLazy>
        <a
          className="gear-menu_item"
          href={`https://ff14.huijiwiki.com/wiki/%E7%89%A9%E5%93%81:${encodeURI(gear.name)}`}
          target="_blank"
          tabIndex={0}
        >
          在 最终幻想XIV中文维基 中查看 <Icon className="gear-menu_external" name="open-in-new" />
        </a>
      </RippleLazy>
      <RippleLazy>
        <a
          className="gear-menu_item"
          href={`http://garlandtools.cn/db/#item/${Math.abs(gear.id)}`}
          target="garlandtools"
          tabIndex={0}
        >
          在 Garland 数据 中查看 <Icon className="gear-menu_external" name="open-in-new" />
        </a>
      </RippleLazy>
      <RippleLazy>
        <a
          className="gear-menu_item"
          href={`./lodestone?jp:${Math.abs(gear.id)}`}
          target="_blank"
          tabIndex={0}
        >
          在 The Lodestone 中查看 <Icon className="gear-menu_external" name="open-in-new" />
        </a>
      </RippleLazy>
    </div>
  );
});
