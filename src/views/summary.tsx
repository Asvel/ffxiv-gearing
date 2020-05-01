import * as React from 'react';
import { observer } from 'mobx-react-lite';
import * as G from '../game';
import { useStore } from './context';

const Summary = observer(() => {
  const store = useStore();
  const effects = store.equippedEffects;
  return (
    <div className="summary card">
      <span className="summary_left">
        <span className="summary_race">{store.raceName}</span>
        {store.equippedLevel}
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
