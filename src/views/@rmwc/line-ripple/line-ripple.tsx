// eslint-disable-next-line @typescript-eslint/no-unused-vars
import * as RMWC from '../types';
import React from 'react';
import { useLineRippleFoundation } from './foundation';
import { createComponent, Tag } from '../base';

export interface LineRippleProps {
  active?: boolean;
  center?: number;
}

export const LineRipple = createComponent<LineRippleProps>(
  function LineRipple(props, ref) {
    const { active, center, ...rest } = props;
    const { rootEl } = useLineRippleFoundation(props);

    return (
      <Tag
        {...rest}
        tag="span"
        element={rootEl}
        className="mdc-line-ripple"
        ref={ref}
      />
    );
  }
);
