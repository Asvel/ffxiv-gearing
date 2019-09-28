import * as React from 'react';

const icons = require.context('../../img', true, /\.svg$/);

const Icon = React.memo<{ className?: string, name: string }>(({ className, name }) => {
  const icon = icons('./' + name + '.svg').default;
  return (
    <svg className={className} viewBox={icon.viewBox}>
      <use xlinkHref={'#' + icon.id} />
    </svg>
  );
});

export { Icon }
