import * as React from 'react';
import * as ReactDOM from 'react-dom';
import * as classNames from 'classnames';
const { MDCRipple } = require('@material/ripple');

class Ripple extends React.Component<{ children: React.ReactNode, className?: string, unbounded?: boolean }> {
  render() {
    const { children, className, unbounded }  = this.props;
    return (
      <span
        className={classNames(
          className,
          'mdc-ripple-surface',
          'mdc-ripple-surface--accent',
          unbounded && 'mdc-ripple-unbounded'
        )}
        children={children}
      />
    );
  }
  componentDidMount() {
    MDCRipple.attachTo(ReactDOM.findDOMNode(this)!, { isUnbounded: true });
  }
}


export { Ripple }
