import * as React from 'react';
import { observer } from 'mobx-react';
import * as classNames from 'classnames';
import * as G from '../gear';
import { IGear } from "../stores";
import { Component } from './context';
import { Icon } from './icon';
import { IconButton } from './icon-button';
import { Dropdown } from './dropdown';
import { Materia } from './materia';

@observer
class Slot extends Component<{ slot: G.Slot }> {
  render() {
    const { store } = this;
    const { slot } = this.props;
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
  }
}

@observer
class GearRow extends Component<{ gear: IGear }> {
  render() {
    const { store } = this;
    const { gear } = this.props;
    return (
      <tr
        data-id={gear.id}
        className={classNames('gears_item', gear.equipped && '-selected')}
        onClick={() => store.equip(gear)}
      >
        <td className="gears_name">
          {gear.name}{gear.hq && <Icon className="gears_hq" name="hq"/>}
          <Dropdown
            label={({ ref, expanded, toggle }) => (
              <IconButton ref={ref} className="gears_more" onClick={toggle}>
                <Icon className="mdc-icon-button__icon" name="more" />
              </IconButton>
            )}
            popper={() => (
              <GearMenu gear={gear} />
            )}
            placement="bottom-end"
          />
          <span className="gears_level">il{gear.level}</span>
        </td>
        <td className="gears_materias">
          {gear.materias.map((materia, i) => materia.isValid && (
            <Materia key={i} materia={materia} />
          ))}
        </td>
        {store.schema.stats.map(stat => (
          <td
            key={stat}
            className={classNames(
              'gears_stat',
              G.statHighlight[stat] && (gear.bareStats[stat] || 0) >= (gear.caps[stat] || Infinity) && '-full'
            )}
          >
            {gear.stats[stat]}
            {gear.materiaStats[stat] && (
              <span className="gears_stat-materia">+{gear.materiaStats[stat]}</span>
            )}
          </td>
        ))}
        {/*<td>*/}
          {/*<IconButton className="gears_more"><Icon className="mdc-icon-button__icon" name="more" /></IconButton>*/}
        {/*</td>*/}
      </tr>
    );
  }
}

@observer
class GearMenu extends Component<{ gear: IGear }> {
  render() {
    const { store } = this;
    const { gear } = this.props;
    return (
      <div>
        {gear.name}
      </div>
    );
  }
}

export { Slot };
