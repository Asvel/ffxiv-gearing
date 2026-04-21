// from commit cf1ca2da5b59bbbfac98b4607f8243655c396303
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import * as RMWC from '../types';
import React, { useEffect } from 'react';
import type { SwitchProps, SwitchHTMLProps } from '.';
import { useToggleFoundation } from '../toggleable';
import { useFoundation } from '../base';

import { MDCSwitchFoundation, type MDCSwitchAdapter } from '../../@material/switch';

export const useSwitchFoundation = (props: SwitchProps & SwitchHTMLProps) => {
  const { renderToggle, toggleRootProps, id } = useToggleFoundation<
    MDCSwitchFoundation
  >(props);

  const { foundation, ...elements } = useFoundation({
    props,
    elements: {
      rootEl: true,
      checkboxEl: true
    },
    foundation: ({ rootEl, checkboxEl }) => {
      return new MDCSwitchFoundation({
        addClass: (className: string) => rootEl.addClass(className),
        removeClass: (className: string) => rootEl.removeClass(className),
        setNativeControlChecked: (checked: boolean) =>
          checkboxEl.setProp('checked', checked),
        setNativeControlDisabled: (disabled: boolean) =>
          checkboxEl.setProp('disabled', disabled),
        setNativeControlAttr: (attr: string, value: string) =>
          rootEl.setProp(attr as any, value)
      } as MDCSwitchAdapter);
    }
  });

  const { checkboxEl } = elements;

  // On mount, sync the values with the native checkbox
  useEffect(() => {
    checkboxEl.ref &&
      (foundation as any).updateCheckedStyling(
        (checkboxEl.ref as HTMLInputElement).checked
      );
    checkboxEl.ref &&
      foundation.setDisabled((checkboxEl.ref as HTMLInputElement).disabled);
  }, [checkboxEl.ref, foundation]);

  // sync checked
  useEffect(() => {
    if (props.checked !== undefined) {
      (foundation as any).updateCheckedStyling(props.checked);
    }
  }, [props.checked, foundation]);

  // sync disabled
  useEffect(() => {
    if (props.disabled !== undefined) {
      foundation.setDisabled(props.disabled);
    }
  }, [props.disabled, foundation]);

  // Callback handling
  const handleOnChange = (evt: React.ChangeEvent<HTMLInputElement>) => {
    foundation.handleChange(evt as any);
    props.onChange?.(evt);
  };

  checkboxEl.setProp('onChange', handleOnChange, true);

  return { foundation, renderToggle, toggleRootProps, id, ...elements };
};
