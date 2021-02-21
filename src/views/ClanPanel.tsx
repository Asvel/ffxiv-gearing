import * as mobxReact from 'mobx-react-lite';
import * as G from '../game';
import { useStore } from './components/contexts';
import { RippleLazy } from './components/RippleLazy';
import { DropdownPopperProps } from './components/Dropdown';

export const ClanPanel = mobxReact.observer<DropdownPopperProps>(({ toggle }) => {
  const store = useStore();
  return (
    <div className="clan card">
      <table>
        <tbody>
        {G.races.map((raceName, i) => (
          <tr key={i}>
            <td className="clan_race">{raceName}</td>
            {[i * 2, i * 2 + 1].map(clan => (
              <td key={clan}>
                <RippleLazy>
                  <div
                    className="clan_item"
                    onClick={() => {
                      store.setClan(clan);
                      toggle();
                    }}
                    children={G.clans[clan]}
                  />
                </RippleLazy>
              </td>
            ))}
          </tr>
        ))}
        </tbody>
      </table>
    </div>
  );
});
