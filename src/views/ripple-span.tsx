import * as React from 'react';
import * as classNames from 'classnames';
import { withRipple, InjectedProps } from './ripple';

interface RippleSpanProps extends InjectedProps<HTMLSpanElement>, React.HTMLProps<HTMLSpanElement> {
  children?: React.ReactNode;
  className: string;
  initRipple: React.Ref<HTMLSpanElement>;
  unbounded: boolean;
}

const RippleSpan = withRipple<RippleSpanProps, HTMLSpanElement>(props => {
  const { className, initRipple, unbounded, ...otherProps } = props;
  return (
    <span
      className={classNames('ripple-span', className)}
      ref={initRipple}
      {...otherProps}
    />
  );
});

export { RippleSpan }
