import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { observer } from 'mobx-react-lite';
import * as PopperJS from "@popperjs/core";
import * as ReactPopper from 'react-popper';

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
  label: (props: DropdownLabelProps) => React.ReactNode
  popper: (props: DropdownPopperProps) => React.ReactNode;
  placement: PopperJS.Placement;
  modifiers?: PopperJS.StrictModifiers[];
  strategy?: PopperJS.PositioningStrategy;
}

export const Dropdown = observer<DropdownProps>(props => {
  const [ expanded, setExpanded ] = React.useState(false);
  const [ labelElement, setLabelElement ] = React.useState<HTMLElement | null>(null);
  const toggle = (e?: UIEvent) => {
    setExpanded(!expanded);
    if (e) {
      e.stopPropagation();
    }
  };
  return (
    <React.Fragment>
      {props.label({
        ref: setLabelElement,
        expanded,
        toggle,
      })}
      {expanded && (
        <DropdownPopper
          {...props}
          expanded={expanded}
          setExpanded={setExpanded}
          labelElement={labelElement}
          toggle={toggle}
        />
      )}
    </React.Fragment>
  );
});

const DropdownPopper = observer<any>(props => {
  const { popper, placement, modifiers, strategy, expanded, setExpanded, labelElement, toggle } = props;
  const [ popperElement, setPopperElement ] = React.useState<HTMLElement | null>(null);
  const popperInstance = ReactPopper.usePopper(labelElement, popperElement, { placement, modifiers, strategy });
  const popperContainer = document.getElementById('popper');
  onGlobalClick = e => {
    if (!expanded) return;
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
    if (!expanded) return;
    const target = e.target as Element;
    // label (比如是一个 button) 有可能成为按键事件的 target
    if (target && (target.tagName === 'BODY' || target === labelElement) && e.key === 'Escape') {
      setExpanded(false);
      onGlobalKeyup = undefined;
    }
  };
  return popperContainer && ReactDOM.createPortal((
    <div
      ref={setPopperElement}
      style={popperInstance.styles.popper}
      {...popperInstance.attributes.popper}
      onClick={e => e.stopPropagation()}
      children={popper({ toggle, labelElement })}
    />
  ), popperContainer);
});

let onGlobalClick: ((e: MouseEvent) => void) | undefined;
window.addEventListener('click', e => onGlobalClick?.(e), true);
let onGlobalKeyup: ((e: KeyboardEvent) => void) | undefined;
window.addEventListener('keyup', e => onGlobalKeyup?.(e), true);
