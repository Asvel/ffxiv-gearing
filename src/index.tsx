import * as React from 'react';
import * as ReactDOM from 'react-dom';
import 'mobx-react-lite/batchingForReactDom';
import { store } from "./stores";
import { App } from './views/app'
import './utils/sanitize.css';
import './views/app.scss';

const _t = (s: string) => s;

document.title = _t('最终幻想14配装器');

let container = document.createElement('div');
document.body.appendChild(container);
ReactDOM.render(<App store={store} />, container);
