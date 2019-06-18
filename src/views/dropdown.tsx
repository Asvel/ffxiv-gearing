import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { observer } from 'mobx-react';
import * as classNames from 'classnames';
import * as PopperJS from "popper.js";
import * as Popper from 'react-popper';
import { Component } from './context';

export interface DropdownLabelProps {
  ref: (ref: React.ReactInstance | null) => void;
  expanded: boolean;
  toggle: () => void;
}

export interface DropdownProps {
  label: (props: DropdownLabelProps) => React.ReactNode
  popper: () => React.ReactNode;
  placement: PopperJS.Placement;
  modifiers?: PopperJS.Modifiers;
}

@observer
class Dropdown extends Component<DropdownProps, { expanded: boolean }> {
  labelElement: Element | null;
  popperElement: Element | null;
  constructor(props: DropdownProps) {
    super(props);
    this.state = {
      expanded: false,
    };
    this.setLabelRef = this.setLabelRef.bind(this);
    this.toggle = this.toggle.bind(this);
  }
  render() {
    const { label, popper, placement, modifiers } = this.props;
    const { expanded } = this.state;
    const popperContainer = document.getElementById('popper');
    return (
      <React.Fragment>
        {label({ ref: this.setLabelRef, expanded, toggle: this.toggle })}
        {expanded && popperContainer && ReactDOM.createPortal(
          <Popper.Popper
            referenceElement={this.labelElement!}
            innerRef={el => this.popperElement = el}
            placement={placement}
            modifiers={modifiers}
          >
            {({ placement, ref, style }) => (
              <div ref={ref} style={style} data-placement={placement}>
                {popper()}
              </div>
            )}
          </Popper.Popper>,
          popperContainer
        )}
      </React.Fragment>
    );
  }
  componentDidUpdate() {
    const { expanded } = this.state;
    if (expanded) {
      expandedDropdown = this;
    }
  }
  setLabelRef(ref: React.ReactInstance) {
    this.labelElement = ReactDOM.findDOMNode(ref) as Element | null;
  }
  toggle(e?: UIEvent) {
    this.setState({ expanded: !this.state.expanded });
    if (e) {
      e.stopPropagation();
    }
  }
}

let expandedDropdown: Dropdown | undefined;
window.addEventListener('click', e => {
  const target = e.target as Element;
  if (expandedDropdown && target && expandedDropdown.labelElement && expandedDropdown.popperElement) {
    if (!expandedDropdown.labelElement.contains(target) && !expandedDropdown.popperElement.contains(target)) {
      expandedDropdown.toggle();
      expandedDropdown = undefined;
    }
  }
}, true);
window.addEventListener('keyup', e => {
  const target = e.target as Element;
  if (expandedDropdown && target) {
    if (target.tagName === 'BODY') {
      expandedDropdown.toggle();
      expandedDropdown = undefined;
    }
  }
}, true);

export { Dropdown };
