import * as React from 'react';
import { IStore } from "../stores";

export const StoreContext = React.createContext<IStore>(undefined as any);

export function useStore(): IStore {
  return React.useContext(StoreContext);
}
