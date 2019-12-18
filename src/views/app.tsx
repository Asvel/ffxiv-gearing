import * as React from 'react';
import { observer } from 'mobx-react-lite';
import * as classNames from 'classnames';
import { IStore } from "../stores";
import { StoreContext } from './context';
import { Slot } from './slot';
import { ConditionEditing, ConditionViewing } from './condition';
import { Title } from './title';
import { Summary } from './summary';

const App = observer<{ store: IStore }>(({ store }) => {
  return store.isLoading ? null : (
    <StoreContext.Provider value={store}>
      <div className={classNames('app', `app-${store.mode}`)}>
        <div className="app_inner">
          {store.isViewing ? <ConditionViewing /> : <ConditionEditing />}
          {store.condition.job !== undefined && (
            <div className="gears">
              {store.schema.slots.map(slot => (
                <Slot key={slot.slot} slot={slot} />
              ))}
            </div>
          )}
          <div className="sidebar">
            <div className="sidebar_inner">
              <Title />
              {store.condition.job !== undefined && <Summary />}
            </div>
          </div>
          <div id="popper" />
        </div>
      </div>
    </StoreContext.Provider>
  );
});

export { App };
