import * as React from 'react';
import { observer } from 'mobx-react';
import { IStore } from "../stores";
import { StoreContext } from './context';
import { Welcome } from './welcome';
import { Gearing } from './gearing';

@observer
class App extends React.Component<{ store: IStore }> {
  render() {
    const { store } = this.props;
    return (
      <StoreContext.Provider value={store}>
        <div className="app">
          {store.condition.job === undefined ? (
            <Welcome />
          ) : (
            <Gearing />
          )}
        </div>
      </StoreContext.Provider>
    );
  }
}

export { App };
