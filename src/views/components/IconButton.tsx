import * as React from 'react';
import classNames from 'clsx';
import { RippleLazy } from './RippleLazy';
import { Icon } from './Icon';

export interface IconButtonProps extends React.HTMLProps<HTMLButtonElement> {
  icon: string,
}

export const IconButton = ({ icon, className, ...otherProps }: IconButtonProps) => {
  return (
    <RippleLazy unbounded>
      <button
        {...otherProps}
        className={classNames('mdc-icon-button', 'mdc-icon-button--dense', className)}
        type="button"
        children={<Icon className="mdc-icon-button__icon" name={icon} />}
      />
    </RippleLazy>
  );
};
