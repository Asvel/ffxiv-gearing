import * as React from 'react';

const icons = require.context('../../../img', true, /\.svg$/);
const iconViewBoxes = new Map<string, string>();
const domParser = new DOMParser();
function loadIcon(name: string) {
  let viewBox = iconViewBoxes.get(name);
  if (viewBox === undefined) {
    const svgString = icons(`./${name}.svg`) as string;
    const svgEl = domParser.parseFromString(svgString, 'image/svg+xml').documentElement;
    viewBox = svgEl.getAttribute('viewBox') ?? '';
    iconViewBoxes.set(name, viewBox);
    svgEl.setAttribute('id', name);
    let root = document.getElementById('svg-sprites');
    if (root === null) {
      root = document.createElement('svg');
      root.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
      root.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
      root.setAttribute('id', 'svg-sprites');
      root.style.display = 'none';
      document.body.prepend(root);
    }
    root.appendChild(svgEl);
  }
  return viewBox;
}

export const Icon = React.memo<{ className?: string, name: string }>(({ className, name }) => {
  const viewBox = loadIcon(name);
  return (
    <svg className={className} viewBox={viewBox}>
      <use href={'#' + name} />
    </svg>
  );
});
