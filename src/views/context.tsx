import * as React from 'react';
import { IStore } from "../stores";

export const StoreContext = React.createContext<IStore>(undefined as any);

export class Component<P={}, S={}> extends React.Component<P, S> {
  static contextType = StoreContext;
  get store() {
    // noinspection JSDeprecatedSymbols
    return this.context as IStore;
  }
}
