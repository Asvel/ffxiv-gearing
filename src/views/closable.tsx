import * as React from 'react';
import * as classNames from 'classnames';

class Closable extends React.Component<any> {
  ref = React.createRef<HTMLButtonElement>();
  render() {
    const { children } = this.props;
    return children;
  }
}

export { Closable }
