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
      {groupedGears ? groupedGears.map(gear => (
        <GearRow key={gear.id} gear={gear} />
      )) : (
        <tr className="gears_empty">
          <td colSpan={store.schema.stats.length + 2}>无匹配</td>
        </tr>
      )}
      </tbody>
    </table>
  );
});

const GearRow = observer<{ gear: IGear }>(({ gear }) => {
  const store = useStore();
  return (
    <tr
      data-id={gear.id}
      className={classNames('gears_item', !store.isViewing && gear.isEquipped && '-selected')}
      onClick={store.isViewing ? undefined : () => store.equip(gear)}
    >
      <td className="gears_name">
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
          {gear.materiaStats[stat] && (
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

export { Slot };
