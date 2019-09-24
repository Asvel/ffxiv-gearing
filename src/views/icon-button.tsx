import * as React from 'react';
import * as classNames from 'classnames';
import { Ripple } from '@rmwc/ripple';
import { Icon } from './icon';

interface IconButtonProps extends React.HTMLProps<HTMLButtonElement> {
  icon: string,
}

class IconButton extends React.Component<IconButtonProps> {
  render() {
    const { icon, className, ...otherProps } = this.props;
    return (
      <Ripple unbounded>
        <button
          {...otherProps}
          className={classNames('mdc-icon-button', 'mdc-icon-button--dense', className)}
          type="button"
          children={<Icon className="mdc-icon-button__icon" name={icon} />}
        />
      </Ripple>
    );
  }
}

export { IconButton }
