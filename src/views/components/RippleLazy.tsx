import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { Ripple } from '../@rmwc/ripple';

export const RippleLazy = (props: Parameters<typeof Ripple>[0]) => {
  const [ isInitialized, setIsInitialized ] = React.useState(false);
  const child = React.Children.only(props.children);
  if (!React.isValidElement(child)) return null;
  const init = () => ReactDOM.flushSync(() => setIsInitialized(true));
  const content = React.cloneElement(child, {
    ...child.props,
    onFocus: init,
    onPointerEnter: init,
    onTouchStart: init,
    onMouseEnter: init,
  });
  return isInitialized ? <Ripple {...props} /> : content;
};
