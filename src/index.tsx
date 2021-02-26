import * as ReactDOM from 'react-dom';
import * as mobx from 'mobx';
import './views/components/sanitize.scss';
import './views/components/material.scss';
import { store } from './stores';
import { App } from './views/App';
import './views/app.scss';

mobx.autorun(() => {
  if (store.job !== undefined && !store.isLoading) {
    document.title = `${store.schema.name}(il${store.equippedLevel}) - 最终幻想14配装器`;
  }
});

const container = document.createElement('div');
document.body.appendChild(container);
ReactDOM.render(<App store={store} />, container);

navigator.serviceWorker?.register('./serviceworker.js');
