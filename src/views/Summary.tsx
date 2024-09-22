import * as mobxReact from 'mobx-react-lite';
import classNames from 'clsx';
import { Button } from '@rmwc/button';
import * as G from '../game';
import { useStore } from './components/contexts';
import { Icon } from './components/Icon';
import { Dropdown } from './components/Dropdown';
import { ClanPanel } from './ClanPanel';

export const Summary = mobxReact.observer(() => {
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
          popper={ClanPanel}
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
        {effects && (
          <Button
            className="summary_tiers-toggle"
            children={`${store.tiersShown ? '隐藏' : '显示'}阈值(差值)`}
            onClick={store.toggleTiersShown}
          />
        )}
        {effects && (
          <span className="summary_stat summary_damage">
            {effects.damage.toFixed(5)}
            <span
              className="summary_damage-tip"
              aria-label={store.job !== 'BLU'
                ? '包括食品和组队加成，不包括其他任何手动施放的增益（如爆发药、连环计、身形、天语等）'
                : '包括食品和组队加成，包括“以太复制：进攻”，不包括其他手动施放的增益'
              }
              role="tooltip"
              children={<Icon name="help" />}
            />
             <div className="summary_stat-name">每威力伤害期望</div>
          </span>
        )}
      </span>
      <span className="summary_divider" />
      {store.schema.stats.map(stat => (
        <span key={stat} className={classNames('summary_stat', store.schema.skeletonGears && '-skeleton')}>
          {effects && store.tiersShown && store.equippedTiers?.[stat] !== undefined && (
            <div className="summary_stat-tier">
              <span className="summary_stat-prev">{store.equippedTiers[stat]!.prev}</span>
              <span className="summary_stat-next">+{store.equippedTiers[stat]!.next}</span>
            </div>
          )}
          {store.equippedStats[stat]}
          {effects && (
            <>
              {(stat === 'SKS' || stat === 'SPS') && (
                <div
                  className={classNames(
                    'summary_stat-effect',
                    store.jobLevel >= 80 && store.schema.statModifiers?.gcdReason && '-tip',
                  )}
                  aria-label={store.jobLevel >= 80 ? store.schema.statModifiers?.gcdReason : undefined}
                  role="tooltip"
                  children={effects.gcd.toFixed(2) + 's'}
                />
              )}
              {stat === 'VIT' && (
                <div className="summary_stat-effect summary_stat-effect-hp">
                  {effects.hp}<span className="summary_stat-small">HP</span>
                </div>
              )}
              {stat === 'TEN' && (
                <div className="summary_stat-effect">
                  -{(effects.tenMitigation * 100).toFixed(1)}%
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
