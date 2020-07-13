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
  const [ tiersVisible, setTiersVisible ] = React.useState(false);
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
        {!store.isViewing && effects && (
          <Button
            className="summary_tiers-toggle"
            children={`${tiersVisible ? '隐藏' : '显示'}阈值(差值)`}
            onClick={() => {
              setTiersVisible(!tiersVisible);
              (document.querySelector('.app') as HTMLDivElement).style.paddingBottom = `${tiersVisible ? 48 : 64}px`;
            }}
          />
        )}
        {effects && (
          <span className="summary_stat summary_damage">
            {effects.damage.toFixed(5)}
            <div className="summary_stat-name">每威力伤害期望</div>
          </span>
        )}
      </span>
      <span className="summary_divider" />
      {store.schema.stats.map(stat => (
        <span key={stat} className="summary_stat">
          {tiersVisible && store.equippedTiers[stat] !== undefined && (
            <div className="summary_stat-tier">
              <span className="summary_stat-prev">{store.equippedTiers[stat]!.prev}</span>
              <span className="summary_stat-next">+{store.equippedTiers[stat]!.next}</span>
            </div>
          )}
          {store.equippedStats[stat]}
          {effects && (
            <React.Fragment>
              {(stat === 'SKS' || stat === 'SPS') && (
                <div className="summary_stat-effect">
                  {effects.gcd.toFixed(2)}s
                </div>
              )}
              {stat === 'VIT' && (
                <div className="summary_stat-effect summary_stat-effect-hp">
                  {effects.hp}<span className="summary_stat-small">HP</span>
                </div>
              )}
              {stat === 'TEN' && (
                <div className="summary_stat-effect">
                  -{((effects.tenDamage - 1) * 100).toFixed(1)}%
                </div>
              )}
              {stat === 'PIE' && (
                <div className="summary_stat-effect">
                  {effects.mp}<span className="summary_stat-small">MP</span>/3s
                </div>
              )}
            </React.Fragment>
          )}
          <div className="summary_stat-name">{G.statNames[stat]}</div>
        </span>
      ))}
    </div>
  );
});

export { Summary };
