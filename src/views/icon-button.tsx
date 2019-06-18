import * as React from 'react';
import * as classNames from 'classnames';
import { withRipple, InjectedProps } from './ripple';

interface IconButtonProps extends InjectedProps<HTMLButtonElement>, React.HTMLProps<HTMLButtonElement> {
  children?: React.ReactNode;
  className: string;
  initRipple: React.Ref<HTMLButtonElement>;
  unbounded: boolean;
}

const IconButton = withRipple<IconButtonProps, HTMLButtonElement>(props => {
  const { className, initRipple, type, unbounded, ...otherProps } = props;
  return (
    <button
      className={classNames('mdc-icon-button', 'mdc-icon-button--dense', className)}
      ref={initRipple}
      {...otherProps}
    />
  );
}, { unbounded: true });

export { IconButton }
