import * as React from 'react';

const icons = require.context('../../img', true, /\.svg$/);

class Icon extends React.PureComponent<{ className?: string, name: string }> {
  render() {
    const { className, name } = this.props;
    const icon = icons('./' + name + '.svg').default;
    return (
      <svg className={className} viewBox={icon.viewBox}>
        <use xlinkHref={'#' + icon.id} />
      </svg>
    );
  }
}

export { Icon }
