import * as mobxReact from 'mobx-react-lite';
import * as classNames from 'classnames';
import { IStore } from '../stores';
import { StoreContext } from './components/contexts';
import { Slot, SlotCompact } from './slot';
import { Condition } from './condition';
import { Summary } from './summary';
import { About } from './about';

export const App = mobxReact.observer<{ store: IStore }>(({ store }) => {
  return store.isLoading ? null : (
    <StoreContext.Provider value={store}>
      <div className={classNames('app', `app-${store.mode}`, store.setting.highSaturation && 'app-high-saturation')}>
        <Condition />
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
