import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { Ripple } from '@rmwc/ripple';

export type RippleLazyProps = NonNullable<typeof Ripple.defaultProps>;

export const RippleLazy = (props: RippleLazyProps) => {
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
