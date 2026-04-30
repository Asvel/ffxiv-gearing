import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { Ripple } from '../@rmwc/ripple';

export type RippleLazyProps = Parameters<typeof Ripple>[0] & {
  surfaceClass?: string,
  children: React.ReactElement<any>,
};

export const RippleLazy = React.memo<RippleLazyProps>(props => {
  const { surfaceClass, children, ...rest } = props;
  const [ isInitialized, setIsInitialized ] = React.useState(false);
  const init = React.useCallback(() => {
    ReactDOM.flushSync(() => setIsInitialized(true));
  }, []);
  const childrenWithSurface = React.useMemo(() => {
    if (!isInitialized || surfaceClass === undefined) return children;
    return React.cloneElement(
      children,
      undefined,
      children.props.children,
      <div className={surfaceClass} />,
    );
  }, [surfaceClass, children, isInitialized]);
  return isInitialized
    ? <Ripple
        {...rest}
        surface={surfaceClass === undefined}
        children={childrenWithSurface}
      />
    : React.cloneElement(children, {
        onFocus: init,
        onPointerEnter: init,
        onTouchStart: init,
        onMouseEnter: init,
      });
});
