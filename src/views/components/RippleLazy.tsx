import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { Ripple } from '../@rmwc/ripple';

export type RippleLazyProps = Parameters<typeof Ripple>[0] & {
  children: React.ReactElement<any>,
};

export const RippleLazy = (props: RippleLazyProps) => {
  const [ isInitialized, setIsInitialized ] = React.useState(false);
  const init = () => ReactDOM.flushSync(() => setIsInitialized(true));
  return isInitialized
    ? <Ripple {...props} />
    : React.cloneElement(props.children, {
        onFocus: init,
        onPointerEnter: init,
        onTouchStart: init,
        onMouseEnter: init,
      });
};
