import * as React from 'react';
import * as ReactDOM from 'react-dom';
import * as mobxReact from 'mobx-react-lite';
import * as PopperJS from '@popperjs/core';

export interface DropdownLabelProps {
  ref: (ref: HTMLElement | null) => void;
  expanded: boolean;
  toggle: () => void;
}

export interface DropdownPopperProps {
  toggle: () => void;
  labelElement: HTMLElement | null;
}

export interface DropdownProps {
  label: React.FunctionComponent<DropdownLabelProps>;
  popper: React.FunctionComponent<DropdownPopperProps>;
  placement: PopperJS.Placement;
  modifiers?: PopperJS.StrictModifiers[];
  strategy?: PopperJS.PositioningStrategy;
}

export const Dropdown = mobxReact.observer<DropdownProps>(props => {
  const [ expanded, setExpanded ] = React.useState(false);
  const [ labelElement, setLabelElement ] = React.useState<HTMLElement | null>(null);
  const toggle = React.useCallback((e?: UIEvent) => {
    setExpanded(expanded => !expanded);
    if (e) {
      e.stopPropagation();
    }
  }, []);
  return (
    <>
      {props.label({
        ref: setLabelElement,
        expanded,
        toggle,
      })}
      {expanded && (
        <DropdownPopper
          {...props}
          setExpanded={setExpanded}
          labelElement={labelElement}
          toggle={toggle}
        />
      )}
    </>
  );
});

const DropdownPopper = mobxReact.observer<DropdownProps & {
  setExpanded: (expanded: boolean) => void;
  labelElement: HTMLElement | null;
  toggle: () => void;
}>(props => {
  const { popper, placement, modifiers=[], strategy='absolute', setExpanded, labelElement, toggle } = props;
  const [ popperOptions ] = React.useState({ placement, modifiers, strategy });
  const [ popperElement, setPopperElement ] = React.useState<HTMLElement | null>(null);
  const popperContainer = document.getElementById('popper');
  React.useLayoutEffect(() => {
    if (labelElement === null || popperElement === null) return;
    if (popperOptions.strategy !== 'fixed') {
      popperOptions.modifiers.push({ name: 'flip', options: { padding: { bottom: 50 } }});
    }
    const popperInstance = PopperJS.createPopper(labelElement, popperElement, popperOptions);
    if (popperOptions.strategy === 'fixed') {
      popperElement.style.zIndex = '7';  // for search: z-index: 7;
    }
    return () => popperInstance.destroy();
  }, [labelElement, popperElement, popperOptions]);
  React.useEffect(() => {
    onGlobalClick = e => {
      const target = e.target as Element;
      if (target && labelElement && popperElement) {
        if (!labelElement.contains(target) && !popperElement.contains(target)) {
          setExpanded(false);
          onGlobalClick = undefined;
          (e as any)._isClosingDropdown = true;
        }
      }
    };
    onGlobalKeyup = e => {
      const target = e.target as Element;
      // label (比如是一个 button) 有可能成为按键事件的 target
      if (target && (target.tagName === 'BODY' || target === labelElement) && e.key === 'Escape') {
        setExpanded(false);
        onGlobalKeyup = undefined;
      }
    };
  }, [labelElement, popperElement, setExpanded]);
  React.useEffect(() => () => {
    onGlobalClick = undefined;
    onGlobalKeyup = undefined;
  }, []);
  return popperContainer && ReactDOM.createPortal((
    <div
      ref={setPopperElement}
      onClick={e => e.stopPropagation()}
      children={React.createElement(popper, { toggle, labelElement })}
    />
  ), popperContainer);
});

let onGlobalClick: ((e: MouseEvent) => void) | undefined;
window.addEventListener('click', e => onGlobalClick?.(e), true);
let onGlobalKeyup: ((e: KeyboardEvent) => void) | undefined;
window.addEventListener('keyup', e => onGlobalKeyup?.(e), true);
