import * as React from 'react';
import { observer } from 'mobx-react-lite';
import { Ripple } from '@rmwc/ripple';
import { Button } from '@rmwc/button';
import * as G from '../game';
import { useStore } from './context';
import { Dropdown } from './dropdown';

const Summary = observer(() => {
  const store = useStore();
  const effects = store.equippedEffects;
  return (
    <div className="summary card">
      <span className="summary_left">
        <Dropdown
          label={({ ref, toggle }) => (
            <Button ref={ref} className="summary_clan" onClick={toggle}>
              {store.raceName} - {store.clanName}
            </Button>
          )}
          popper={({ toggle }) => (
            <div className="clan card">
              <table>
                <tbody>
                {G.races.map((raceName, i) => (
                  <tr key={i}>
                    <td className="clan_race">{raceName}</td>
                    {[i * 2, i * 2 + 1].map(clan => (
                      <td key={clan}>
                        <Ripple>
                          <div
                            className="clan_item"
                            onClick={() => {
                              store.setClan(clan);
                              toggle();
                            }}
                            children={G.clans[clan]}
                          />
                        </Ripple>
                      </td>
                    ))}
                  </tr>
                ))}
                </tbody>
              </table>
            </div>
          )}
          placement="top-start"
          modifiers={React.useMemo(() => ([{ name: 'offset', options: { offset: [-8, 0] } }]), [])}
          strategy="fixed"
        />
        <span className="summary_equipped-level">
          il{store.equippedLevel}
        </span>
      </span>
      <span className="summary_divider" />
      <span className="summary_middle">
        <span className="summary_stat summary_damage">
          {store.equippedEffects.damage.toFixed(5)}
          <div className="summary_stat-name">每威力伤害期望</div>
        </span>
      </span>
      <span className="summary_divider" />
      {store.schema.stats.map(stat => (
        <span key={stat} className="summary_stat">
          {store.equippedStats[stat]}
          {stat === 'SKS' || stat === 'SPS' ? (
            <div className="summary_stat-effect">{effects.gcd}s</div>
          ) : stat === 'VIT' ? (
            <div className="summary_stat-effect">{effects.hp}<span className="summary_stat-small">HP</span></div>
          ) : stat === 'PIE' ? (
            <div className="summary_stat-effect">{effects.mp}<span className="summary_stat-small">MP</span>/3s</div>
          ) : (
            <div className="summary_stat-name">{G.statNames[stat]}</div>
          )}
        </span>
      ))}
    </div>
  );
});

export { Summary };
