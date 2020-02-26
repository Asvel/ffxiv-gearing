import * as React from 'react';
import { observer } from 'mobx-react-lite';
import * as classNames from 'classnames';
import { Ripple } from '@rmwc/ripple';
import Clipboard from 'react-clipboard.js';
import * as G from '../gear';
import { IGear } from "../stores";
import { useStore } from './context';
import { Icon } from './icon';
import { IconButton } from './icon-button';
import { Dropdown } from './dropdown';
import { Materia } from './materia';

const Slot = observer<{ slot: G.Slot }>(({ slot }) => {
  const store = useStore();
  const groupedGears = store.groupedGears[slot.slot];
  return (
    <table className="gears_slot table card">
      <thead>
      <tr>
        <th className="gears_name">{slot.name}</th>
        <th className="gears_materias">魔晶石</th>
        {store.schema.stats.map(stat => (
          <th key={stat} className="gears_stat">
            {G.statNames[stat]}
          </th>
        ))}
      </tr>
      </thead>
      <tbody>
      {groupedGears !== undefined ? groupedGears.map(gear => (
        <GearRow key={gear.id} gear={gear} />
      )) : (
        <GearRow gear={undefined} />
      )}
      </tbody>
    </table>
  );
});

const SlotCompact = observer(() => {
  const store = useStore();
  return (
    <table className="gears_slot table card">
      <thead>
      <tr>
        <th className="gears_name-compact">装备</th>
        <th className="gears_materias">魔晶石</th>
        {store.schema.stats.map(stat => (
          <th key={stat} className="gears_stat">
            {G.statNames[stat]}
          </th>
        ))}
      </tr>
      </thead>
      <tbody>
      {store.schema.slots.map(slot => (
        <GearRow key={slot.slot} gear={store.equippedGears.get(slot.slot.toString())} slotName={slot.name} />
      ))}
      </tbody>
    </table>
  );
});

const GearRow = observer<{ gear?: IGear, slotName?: string }>(({ gear, slotName }) => {
  const store = useStore();
  return gear === undefined ? (
    <tr className="gears_item">
      <td className="gears_name">
        {slotName !== undefined && <span className="gears_inline-slot">{slotName.slice(0, 2)}</span>}
        <span className="gears_empty">{store.isViewing ? '无装备' : '无匹配'}</span>
      </td>
      <td className="gears_materias" />
      <td colSpan={store.schema.stats.length}/>
    </tr>
  ): (
    <tr
      data-id={gear.id}
      className={classNames('gears_item', !store.isViewing && gear.isEquipped && '-selected')}
      onClick={store.isViewing ? undefined : () => store.equip(gear)}
    >
      <td className="gears_name">
        {slotName !== undefined && <span className="gears_inline-slot">{slotName.slice(0, 2)}</span>}
        {gear.name}{gear.hq && <Icon className="gears_hq" name="hq"/>}
        <Dropdown
          label={({ ref, toggle }) => (
            <IconButton ref={ref} className="gears_more" icon="more" onClick={toggle} />
          )}
          popper={({ toggle }) => (
            <GearMenu gear={gear} toggle={toggle} />
          )}
          placement="bottom-end"
        />
        <span className="gears_level">il{gear.level}</span>
      </td>
      <td className="gears_materias">
        {gear.materias.map((materia, i) => (
          <Materia key={i} materia={materia} />
        ))}
      </td>
      {store.schema.stats.map(stat => (
        <td
          key={stat}
          className={classNames(
            'gears_stat',
            G.statHighlight[stat] && (gear.bareStats[stat] ?? 0) >= (gear.caps[stat] ?? Infinity) && '-full'
          )}
        >
          {gear.stats[stat]}
          {gear.materiaStats[stat] && (  // FIXME
            <span className="gears_stat-materia">+{gear.materiaStats[stat]}</span>
          )}
        </td>
      ))}
    </tr>
  );
});

const GearMenu = observer<{ gear: IGear, toggle: () => void }>(({ gear, toggle }) => {
  const store = useStore();
  return (
    <div className="gear-menu card">
      <Ripple>
        <div/* for ripple */>
          <Clipboard
            className="gear-menu_item"
            component="div"
            data-clipboard-text={gear.name}
            onClick={toggle}
            children="复制道具名"
          />
        </div>
      </Ripple>
      <div className="gear-menu_divider" />
      <Ripple>
        <a
          className="gear-menu_item"
          href={`https://ff14.huijiwiki.com/wiki/%E7%89%A9%E5%93%81:` + encodeURI(gear.name)}
          target="_blank"
          tabIndex={0}
        >
          在 最终幻想XIV中文维基 中查看 <Icon className="gear-menu_external" name="open-in-new" />
        </a>
      </Ripple>
      <Ripple>
        <a
          className="gear-menu_item"
          href={`http://www.garlandtools.org/db/#item/` + gear.id}
          target="_blank"
          tabIndex={0}
        >
          在 Garland Data 中查看 <Icon className="gear-menu_external" name="open-in-new" />
        </a>
      </Ripple>
      {gear.stats.WPN !== undefined && <div className="gear-menu_divider" />}
      {gear.stats.WPN !== undefined && <div className="gear-menu_item">武器基本性能：{gear.stats.WPN}</div>}
      {gear.stats.DLY !== undefined && (
        <div className="gear-menu_item">攻击间隔：{(gear.stats.DLY / 1000).toFixed(2)}</div>
      )}
    </div>
  );
});

export { Slot, SlotCompact };
