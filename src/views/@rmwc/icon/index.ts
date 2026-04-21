import React from 'react';
import * as RMWC from '../types';
import { createComponent } from '../base';

export interface IconProps {
  icon: RMWC.IconPropT;
}

export type IconHTMLProps = RMWC.HTMLProps<HTMLElement>;

export const Icon = createComponent<IconProps, RMWC.HTMLProps<HTMLElement>>(
  function Icon({ icon, ...rest }) {
    return React.cloneElement(icon, rest);
  }
);
