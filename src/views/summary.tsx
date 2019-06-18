import * as React from 'react';
import { observer } from 'mobx-react';
import * as classNames from 'classnames';
import * as G from '../gear';
import { Component } from './context';

@observer
class Summary extends Component {
  render() {
    const { store } = this;
    const effects = store.equippedEffects;
    return (
      <div className="summary card">
        {/*<div className="summary_title">总属性</div>*/}
        {/*<div className="divider" />*/}
        <div className="summary_race">{store.raceName}</div>
        {store.schema.stats.map(stat => (
          <div key={stat} className="summary_stat">
            <div className="summary_stat-name">{G.statNames[stat]}</div>
            <span className="summary_stat-value">{store.equippedStats[stat]}</span>
            <span className="summary_stat-effect">
              {stat === 'CRT' && <span><i />{effects.crtRate}%<i />×{effects.crtDamage}</span>}
              {stat === 'DET' && <span><i />×{effects.detDamage}</span>}
              {stat === 'DHT' && <span><i />{effects.dhtRate}%</span>}
              {stat === 'SPS' && <span><i />{effects.gcd}s<i />×{effects.ssDamage}</span>}
              {stat === 'PIE' && <span><i />{effects.mp} MP</span>}
              {stat === 'VIT' && <span><i />{effects.hp} HP</span>}
            </span>
          </div>
        ))}
      </div>
    );
  }
}

export { Summary };
