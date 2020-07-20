import * as React from 'react';
import { observer } from 'mobx-react-lite';
import * as classNames from 'classnames';
import { IStore } from "../stores";
import { StoreContext } from './context';
import { Slot, SlotCompact } from './slot';
import { ConditionEditing, ConditionViewing } from './condition';
import { Summary } from './summary';
import { About } from './about';

const App = observer<{ store: IStore }>(({ store }) => {
  return store.isLoading ? null : (
    <StoreContext.Provider value={store}>
      <div className={classNames('app', `app-${store.mode}`)}>
        {store.isViewing ? <ConditionViewing /> : <ConditionEditing />}
        {store.job !== undefined && (
          store.isViewing ? (
            <SlotCompact />
          ) : (
            store.schema.slots.map(slot => (
              <Slot key={slot.slot} slot={slot}/>
            ))
          )
        )}
        {store.job !== undefined && <Summary />}
        <About />
        <div id="popper" />
      </div>
    </StoreContext.Provider>
  );
});

export { App };
