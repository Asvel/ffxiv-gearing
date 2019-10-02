import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { observer } from 'mobx-react-lite';
import * as PopperJS from "popper.js";
import * as Popper from 'react-popper';

export interface DropdownLabelProps {
  ref: (ref: HTMLElement | null) => void;
  expanded: boolean;
  toggle: () => void;
}

export interface DropdownPopperProps {
  toggle: () => void;
}

export interface DropdownProps {
  label: (props: DropdownLabelProps) => React.ReactNode
  popper: (props: DropdownPopperProps) => React.ReactNode;
  placement: PopperJS.Placement;
  modifiers?: PopperJS.Modifiers;
}

const Dropdown = observer<DropdownProps>(({ label, popper, placement, modifiers }) => {
  const [ expanded, setExpanded ] = React.useState(false);
  const labelRef = React.useRef<HTMLElement | null>(null);
  const popperRef = React.useRef<HTMLElement | null>(null);
  const popperContainer = document.getElementById('popper');
  const toggle = (e?: UIEvent) => {
    setExpanded(!expanded);
    if (e) {
      e.stopPropagation();
    }
  };
  if (expanded) {
    onGlobalClick = e => {
      const target = e.target as Element;
      if (target && labelRef.current && popperRef.current) {
        if (!labelRef.current.contains(target) && !popperRef.current.contains(target)) {
          setExpanded(false);
          onGlobalClick = undefined;
        }
      }
    };
    onGlobalKeyup = e => {
      const target = e.target as Element;
      // label (比如是一个 button) 有可能成为按键事件的 target
      if (target && (target.tagName === 'BODY' || target === labelRef.current) && e.key === 'Escape') {
        setExpanded(false);
        onGlobalKeyup = undefined;
      }
    };
  }
  return (
    <React.Fragment>
      {label({
        ref: r => labelRef.current = r,
        expanded,
        toggle,
      })}
      {expanded && popperContainer && ReactDOM.createPortal(
        <Popper.Popper
          referenceElement={labelRef.current!}
          innerRef={el => popperRef.current = el}
          placement={placement}
          modifiers={modifiers}
        >
          {({ placement, ref, style }) => (
            <div ref={ref} style={style} data-placement={placement} onClick={e => e.stopPropagation()}>
              {popper({ toggle })}
            </div>
          )}
        </Popper.Popper>,
        popperContainer
      )}
    </React.Fragment>
  );
});

let onGlobalClick: ((e: MouseEvent) => void) | undefined;
window.addEventListener('click', e => onGlobalClick && onGlobalClick(e), true);
let onGlobalKeyup: ((e: KeyboardEvent) => void) | undefined;
window.addEventListener('keyup', e => onGlobalKeyup && onGlobalKeyup(e), true);

export { Dropdown };
