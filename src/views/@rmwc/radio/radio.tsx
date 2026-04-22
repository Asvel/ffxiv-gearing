import * as RMWC from '../types';
import React from 'react';
import { MDCRadioFoundation } from '../../@material/radio';
import { Tag, useClassNames, mergeRefs, createComponent } from '../base';
import { withRipple } from '../ripple';
import type { ToggleableProps, ToggleHTMLProps } from '../toggleable';
import { useRadioFoundation } from './foundation';

/*********************************************************************
 * Radio
 *********************************************************************/

/** A Radio button component. */
export interface RadioProps
  extends RMWC.WithRippleProps,
    ToggleableProps<MDCRadioFoundation> {}

export type RadioHTMLProps = ToggleHTMLProps;

/** A Radio button component. */
export const Radio: RMWC.ComponentType<RadioProps, RadioHTMLProps, 'input'> =
  createComponent<RadioProps, RadioHTMLProps>(function Radio(props) {
    const { renderToggle, id, toggleRootProps, rootEl } =
      useRadioFoundation(props);

    const {
      children,
      className,
      label,
      style,
      inputRef,
      foundationRef,
      ref,
      ...rest
    } = props;

    const radio = (
      <RadioRoot
        {...rootEl.props(toggleRootProps)}
        ref={mergeRefs(rootEl.reactRef, ref)}
      >
        <input
          {...rest}
          className="mdc-radio__native-control"
          type="radio"
          id={id}
          ref={inputRef}
        />
        <RadioBackground />
        <RadioRipple />
      </RadioRoot>
    );

    return renderToggle(radio);
  });

/*********************************************************************
 * Bits
 *********************************************************************/

const RadioRipple = React.memo(function RadioRipple() {
  return <div className="mdc-radio__ripple" />;
});

const RadioRoot = withRipple({
  surface: false,
  unbounded: true
})(
  function RadioRoot(props: RadioProps & RMWC.HTMLProps) {
    const { disabled, ...rest } = props;
    const className = useClassNames(props, [
      'mdc-radio',
      {
        'mdc-radio--disabled': disabled
      }
    ]);
    return <Tag {...rest} className={className} />;
  }
);

const RadioBackground = React.memo(function RadioBackground() {
  return (
    <div className="mdc-radio__background">
      <div className="mdc-radio__outer-circle" />
      <div className="mdc-radio__inner-circle" />
    </div>
  );
});
