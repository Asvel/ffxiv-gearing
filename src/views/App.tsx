import * as mobxReact from 'mobx-react-lite';
import type { IStore } from '../stores';
import { StoreContext } from './components/contexts';
import { Loading } from './Loading';
import { Slot } from './Slot';
import { SlotCompact } from './SlotCompact';
import { Condition } from './Condition';
import { Summary } from './Summary';
import { About } from './About';

export const App = mobxReact.observer<{ store: IStore }>(({ store }) => {
  return (
    <StoreContext.Provider value={store}>
      <Loading />
      {store.loadingStatus !== 'loading' && (
        <div className={`app app-${store.mode}`}>
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
          {store.tiersShown && !store.isViewing && store.equippedEffects && <div className="summary_tiers-spacer" />}
          <div id="popper" />
        </div>
      )}
    </StoreContext.Provider>
  );
});
