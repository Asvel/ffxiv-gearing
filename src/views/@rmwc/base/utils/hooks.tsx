import React from 'react';

export const useId = (
  prefix: string,
  props: { [key: string]: any }
): string => {
  const idByLabel = props.label?.replace(/\s/g, '___');
  const reactId = React.useId();
  const internalId = idByLabel ?? reactId;
  if (props.id) {
    return props.id;
  }
  return `${prefix}-${internalId}`;
};
