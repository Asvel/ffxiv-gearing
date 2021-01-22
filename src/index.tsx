import * as React from 'react';
import * as ReactDOM from 'react-dom';
import 'mobx-react-lite/batchingForReactDom';
import { autorun } from 'mobx';
import { store } from './stores';
import { App } from './views/app';
import './utils/sanitize.css';
import './views/app.scss';

autorun(() => {
  if (store.job !== undefined && !store.isLoading) {
    document.title = `${store.schema.name}(il${store.equippedLevel}) - 最终幻想14配装器`;
  }
});

const container = document.createElement('div');
document.body.appendChild(container);
ReactDOM.render(<App store={store} />, container);
