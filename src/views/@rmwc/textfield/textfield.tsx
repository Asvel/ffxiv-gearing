import { MDCTextFieldFoundation } from '../../@material/textfield';
import * as RMWC from '../types';
import React from 'react';

import {
  Tag,
  createComponent,
  mergeRefs,
  useClassNames,
  useId
} from '../base';
import { LineRipple } from '../line-ripple';
import { withRipple } from '../ripple';

import { useTextFieldFoundation } from './textfield-foundation';

/*********************************************************************
 * TextField
 *********************************************************************/

/** A TextField component for accepting text input from a user. */
export interface TextFieldProps extends RMWC.WithRippleProps {
  /** Sets the value for controlled TextFields. */
  value?: string | number;
  /** Adds help text to the field */
  invalid?: boolean;
  /** Makes the Textfield disabled. */
  disabled?: boolean;
  /** Makes the Textfield required. */
  required?: boolean;
  /** How to align the text inside the TextField. Defaults to 'start'. */
  align?: 'start' | 'end';
  /** A label for the input. */
  label?: React.ReactNode;
  /** The label floats automatically based on value, but you can use this prop for manual control. */
  textarea?: boolean;
  /** Makes the TextField fullwidth. */
  fullwidth?: boolean;
  /** Add a leading icon. */
  rootProps?: Object;
  /** A reference to the native input or textarea. */
  inputRef?: React.Ref<HTMLInputElement | HTMLTextAreaElement | null>;
  /** The type of input field to render, search, number, etc */
  type?: string;
  /** Add prefix. */
  prefix?: string;
  /** Add suffix. */
  suffix?: string;
  /** Advanced: A reference to the MDCFoundation. */
  foundationRef?: React.Ref<MDCTextFieldFoundation | null>;
  /** Make textarea resizeable */
  resizeable?: boolean;
}

export type TextFieldHTMLProps = RMWC.HTMLProps<
  HTMLInputElement,
  Omit<React.AllHTMLAttributes<HTMLInputElement>, 'label'>
>;

/** A TextField component for accepting text input from a user. */
export const TextField: RMWC.ComponentType<
  TextFieldProps,
  TextFieldHTMLProps,
  'input'
> = createComponent<TextFieldProps, TextFieldHTMLProps>(
  function TextField(props, ref) {
    const {
      label,
      style,
      align,
      invalid,
      disabled,
      children,
      textarea,
      fullwidth,
      inputRef,
      rootProps = {},
      foundationRef,
      ripple,
      prefix,
      suffix,
      resizeable,
      ...rest
    } = props;

    const {
      rootEl,
      inputEl,
      shakeLabel,
      floatLabel,
      notchWidth,
      lineRippleActive,
      lineRippleCenter,
    } = useTextFieldFoundation(props);

    const id = useId('textfield', props);
    const labelId = id + '-label';

    const className = useClassNames(props, [
      'mdc-text-field',
      'mdc-text-field--upgraded',
      {
        'mdc-text-field--filled': true,
        'mdc-text-field--textarea': textarea,
        'mdc-text-field--invalid': invalid,
        'mdc-text-field--disabled': disabled,
        'mdc-text-field--no-label': !label,
        'mdc-text-field--end-aligned': align === 'end',
        'rmwc-text-field--fullwidth': fullwidth
      }
    ]);

    const renderTextarea = resizeable ? (
      <span className="mdc-text-field__resizer">
        <Tag
          {...rest}
          element={inputEl}
          className="mdc-text-field__input"
          disabled={disabled}
          tag="textarea"
          ref={mergeRefs(ref, inputRef)}
        />
      </span>
    ) : (
      <>
        <Tag
          {...rest}
          element={inputEl}
          className="mdc-text-field__input"
          disabled={disabled}
          tag="textarea"
          ref={mergeRefs(ref, inputRef)}
        />
      </>
    );

    return (
      <>
        <TextFieldRoot
          {...rootProps}
          element={rootEl}
          style={style}
          className={className}
          ref={ref}
        >
          {children}
          <TextFieldRipple />
          {!!prefix && !textarea && <TextFieldPrefix prefix={prefix} />}
          {textarea ? (
            renderTextarea
          ) : (
            <Tag
              {...rest}
              aria-labelledby={labelId}
              element={inputEl}
              className="mdc-text-field__input"
              disabled={disabled}
              tag="input"
              ref={mergeRefs(ref, inputRef)}
            />
          )}
          {!!suffix && !textarea && <TextFieldSuffix suffix={suffix} />}
          <LineRipple active={lineRippleActive} center={lineRippleCenter} />
        </TextFieldRoot>
      </>
    );
  }
);

const TextFieldRipple = React.memo(function TextFieldRipple() {
  return <span className="mdc-text-field__ripple"></span>;
});

const TextFieldRoot = withRipple({ surface: false })(
  React.forwardRef(function TextFieldRoot(props: any, ref: React.Ref<any>) {
    return <Tag {...props} tag="label" ref={ref} />;
  })
);

const TextFieldPrefix = React.memo(function TextFieldPrefix({
  prefix
}: {
  prefix: string;
}) {
  return (
    <span className="mdc-text-field__affix mdc-text-field__affix--prefix">
      {prefix}
    </span>
  );
});

const TextFieldSuffix = React.memo(function TextFieldSuffix({
  suffix
}: {
  suffix: string;
}) {
  return (
    <span className="mdc-text-field__affix mdc-text-field__affix--suffix">
      {suffix}
    </span>
  );
});
