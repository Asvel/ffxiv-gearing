import * as mobxReact from 'mobx-react-lite';
import * as classNames from 'classnames';
import * as G from '../game';
import { useStore } from './components/contexts';
import { GearRow } from './GearRow';

export const SlotCompact = mobxReact.observer(() => {
  const store = useStore();
  return (
    <table className="gears_slot table card">
      <thead>
      <tr>
        <th className="gears_left-compact">装备</th>
        <th className="gears_materias">魔晶石</th>
        {store.schema.stats.map(stat => (
          <th key={stat} className="gears_stat">
            {G.statNames[stat]}
          </th>
        ))}
      </tr>
      </thead>
      <tbody className={classNames(store.isMateriaNamesSameWidth && 'gears_materias-same-width')}>
      {store.schema.slots.map((slot, i) => (
        <GearRow
          key={slot.slot}
          gear={store.equippedGears.get(slot.slot.toString())}
          slot={slot}
          isGroupEnd={i < store.schema.slots.length - 1 && slot.uiGroup !== store.schema.slots[i + 1].uiGroup}
        />
      ))}
      </tbody>
    </table>
  );
});
