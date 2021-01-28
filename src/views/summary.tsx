import * as React from 'react';
import * as mobxReact from 'mobx-react-lite';
import * as classNames from 'classnames';
import { Button } from '@rmwc/button';
import { Tooltip } from '@rmwc/tooltip';
import * as G from '../game';
import { useStore } from './components/contexts';
import { RippleLazy } from './components/RippleLazy';
import { Icon } from './components/Icon';
import { Dropdown } from './components/Dropdown';

export const Summary = mobxReact.observer(() => {
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
          )}
          placement="top-start"
          modifiers={[{ name: 'offset', options: { offset: [-8, 0] } }]}
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
            <Tooltip
              content="包括食物和组队加成，不包括其他任何手动施放的增益（如爆发药、连环计、天语、以太复制等）"
              showArrow
            >
              <span className="summary_damage-tip">
                <Icon name="help" />
              </span>
            </Tooltip>
            <div className="summary_stat-name">每威力伤害期望</div>
          </span>
        )}
      </span>
      <span className="summary_divider" />
      {store.schema.stats.map(stat => (
        <span key={stat} className={classNames('summary_stat', store.schema.skeletonGears && '-skeleton')}>
          {tiersVisible && store.equippedTiers !== undefined && store.equippedTiers[stat] !== undefined && (
            <div className="summary_stat-tier">
              <span className="summary_stat-prev">{store.equippedTiers[stat]!.prev}</span>
              <span className="summary_stat-next">+{store.equippedTiers[stat]!.next}</span>
            </div>
          )}
          {store.equippedStats[stat]}
          {effects && (
            <>
              {(stat === 'SKS' || stat === 'SPS') && (
                <Tooltip
                  content={store.schema.statModifiers?.gcdReason ?? ''}
                  showArrow
                  open={store.schema.statModifiers?.gcdReason === undefined ? false : undefined}
                >
                  <div className={classNames('summary_stat-effect', store.schema.statModifiers?.gcdReason && '-tip')}>
                    {effects.gcd.toFixed(2) + 's'}
                  </div>
                </Tooltip>
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
            </>
          )}
          <div className="summary_stat-name">{G.statNames[stat]}</div>
        </span>
      ))}
    </div>
  );
});
