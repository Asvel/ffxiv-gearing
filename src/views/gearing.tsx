import * as React from 'react';
import { observer } from 'mobx-react';
import { Component } from './context';
import { Slot } from './slot';
import { Condition, Condition2 } from './condition';
import { Summary } from './summary';

@observer
class Gearing extends Component {
  render() {
    let { store } = this;
    return store.loading ? null : (
      <div className="app_inner">
        <Condition2 />
        <div className="gears">
          {store.schema.slots.map(slot => (
            <Slot key={slot.slot} slot={slot} />
          ))}
        </div>
        <div className="sidebar">
          <div className="sidebar_inner">
            <Condition />
            <Summary />
          </div>
        </div>
        <div id="popper" />
      </div>
    );
  }
}

export { Gearing };
