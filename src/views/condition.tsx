import * as React from 'react';
import { observer } from 'mobx-react';
const { MDCTextField } = require('@material/textfield');
import { Component } from './context';
import { RippleSpan } from './ripple-span';
import { Icon } from './icon';
import { JobSelector } from './jobSelector';

@observer
class Condition extends Component {
  render() {
    const { store } = this;
    const { condition } = store;
    return (
      <div className="condition card">
        <div className="condition_job">
          <Icon className="condition_job-icon" name="jobs/WHM" />
          <div className="condition_job-name">{store.schema.name}</div>
          <div className="condition_version">游戏版本 {condition.versionString}</div>
        </div>
        <div className="divider" />
        <div className="condition_level">
          品级
          <span className="condition_level-value">
            <ConditionLevelInput
              value={condition.minLevel}
              onChange={value => condition.setMinLevel(value)}
            />
            <span className="condition_level-separator">-</span>
            <ConditionLevelInput
              value={condition.maxLevel}
              onChange={value => condition.setMaxLevel(value)}
            />
          </span>
        </div>
      </div>
    );
  }
}

@observer
class Condition2 extends Component {
  render() {
    const { store } = this;
    const { condition } = store;
    return (
      <div className="condition2 card">
        <RippleSpan className="condition2_job">
          <Icon className="condition2_job-icon" name="jobs/WHM" />
          <span className="condition2_job-name">{store.schema.name}</span>
        </RippleSpan>
        <span className="condition2_divider" />
        <span className="condition2_level">
          <span className="condition2_level-value">
            <ConditionLevelInput
              value={condition.minLevel}
              onChange={value => condition.setMinLevel(value)}
            />
            <span className="condition2_level-separator">-</span>
            <ConditionLevelInput
              value={condition.maxLevel}
              onChange={value => condition.setMaxLevel(value)}
            />
          </span>
          品级
        </span>
        <span className="condition2_right">
          <span className="condition2_version">游戏版本 {condition.versionString}</span>
        </span>
        <JobSelector />
      </div>
    );
  }
}

interface ConditionLevelInputProps {
  value: number;
  onChange: (value: number) => void;
}
interface ConditionLevelInputState {
  value: string;
}
@observer
class ConditionLevelInput extends Component<ConditionLevelInputProps, ConditionLevelInputState> {
  ref = React.createRef<HTMLDivElement>();
  constructor(props: ConditionLevelInputProps) {
    super(props);
    this.state = {
      value: props.value.toString(),
    };
  }
  render() {
    const { onChange } = this.props;
    const { value } = this.state;
    return (
      <div ref={this.ref} className="condition_level-input mdc-text-field">
        <input
          type="text"
          className="mdc-text-field__input"
          value={value}
          onBlur={() => onChange(parseInt(value))}
          onChange={e => this.setState({ value: e.target.value })}
          onWheel={e => {
            e.preventDefault();
            if (e.deltaY !== 0) {
              (e.target as HTMLInputElement).focus();
              let delta = e.deltaY < 0 ? 5 : -5;
              this.setState({ value: (parseInt(value) + delta).toString() });
            }
          }}
        />
        <div className="mdc-line-ripple" />
      </div>
    );
  }
  componentDidMount() {
    new MDCTextField(this.ref.current);
  }
}

export { Condition, Condition2 };
