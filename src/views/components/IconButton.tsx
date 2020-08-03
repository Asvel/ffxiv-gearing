import * as React from 'react';
import * as classNames from 'classnames';
import { Ripple } from '@rmwc/ripple';
import { Icon } from './Icon';

interface IconButtonProps extends React.HTMLProps<HTMLButtonElement> {
  icon: string,
}

export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ icon, className, ...otherProps }, ref) => (
    <Ripple unbounded>
      <button
        {...otherProps}
        ref={ref}
        className={classNames('mdc-icon-button', 'mdc-icon-button--dense', className)}
        type="button"
        children={<Icon className="mdc-icon-button__icon" name={icon} />}
      />
    </Ripple>
  )
);
