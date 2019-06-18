import * as React from 'react';
import * as ReactDOM from 'react-dom';
import * as classNames from 'classnames';
const { MDCRipple } = require('@material/ripple');

class Button extends React.Component<any> {
  render() {
    const { className } = this.props;
    return (
      <button
        {...this.props}
        className={classNames(className, 'mdc-button')}
      />
    );
  }
  componentDidMount() {
    MDCRipple.attachTo(ReactDOM.findDOMNode(this));
  }
}

export { Button }
