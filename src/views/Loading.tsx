import * as React from 'react';
import * as mobxReact from 'mobx-react-lite';
import { LinearProgress } from './@rmwc/linear-progress';
import { useStore } from './components/contexts';

export const Loading = mobxReact.observer(() => {
  const store = useStore();
  const [ shown, setShown ] = React.useState(false);
  React.useEffect(() => {
    if (store.loadingStatus !== 'ready') {
      const timeout = setTimeout(() => setShown(true), 500);
      return () => clearTimeout(timeout);
    } else {
      setShown(false);
    }
  }, [store.loadingStatus]);
  return (
    <div className="loading">
      <LinearProgress closed={!shown} />
    </div>
  );
});
