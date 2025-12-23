import './migrate';
import * as ReactDOMClient from 'react-dom/client';
import * as mobx from 'mobx';
import './views/components/sanitize.scss';
import './views/components/material.scss';
import { store } from './stores';
import { App } from './views/App';
import './views/App.scss';

mobx.autorun(() => {
  if (store.title !== undefined) {
    document.title = store.title;
  }
});

mobx.autorun(() => {
  for (const className of document.body.classList) {
    if (className.startsWith('theme-')) {
      document.body.classList.remove(className);
    }
  }
  if (store.setting.appTheme !== 'light') {
    document.body.classList.add(`theme-${store.setting.appTheme}`);
  }
});

const container = document.createElement('div');
document.body.appendChild(container);
ReactDOMClient.createRoot(container).render(<App store={store} />);

navigator.serviceWorker?.register('./serviceworker.js');
