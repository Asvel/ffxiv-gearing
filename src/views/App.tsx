import * as mobxReact from 'mobx-react-lite';
import classNames from 'clsx';
import type { IStore } from '../stores';
import { StoreContext } from './components/contexts';
import { Slot } from './Slot';
import { SlotCompact } from './SlotCompact';
import { Condition } from './Condition';
import { Summary } from './Summary';
import { About } from './About';
import { useEffect } from 'react';

export const App = mobxReact.observer<{ store: IStore }>(({ store }) => {
  useEffect(() => {
    const themeClassMap = {
      'light-highSaturation': 'theme-light--highSaturation',
      'dark': 'theme-dark',
    };
    Object.entries(themeClassMap).forEach(([theme, className]) => {
      if (store.setting.appTheme === theme) {
        document.body.classList.add(className);
      } else {
        document.body.classList.remove(className);
      }
    });
  }, [store.setting.appTheme]);

  return store.isLoading ? null : (
    <StoreContext.Provider value={store}>
      <div className={classNames('app', `app-${store.mode}`)}>
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
    </StoreContext.Provider>
  );
});
