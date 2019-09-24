import * as React from 'react';
import { observer } from 'mobx-react';
import { Ripple } from '@rmwc/ripple';
import * as G from '../gear';
import { Component } from './context';
import { Icon } from './icon';

@observer
class JobSelector extends Component {
  render() {
    return (
      <div className="job-selector">
        <div className="job-selector_column">
          <JobGroup name="防护职业">
            <JobItem job="PLD" />
            <JobItem job="WAR" />
            <JobItem job="DRK" />
          </JobGroup>
          <JobGroup name="治疗职业">
            <JobItem job="WHM" />
            <JobItem job="SCH" />
            <JobItem job="AST" />
          </JobGroup>
        </div>
        <div className="job-selector_column">
          <JobGroup name="近战职业">
            <JobItem job="MNK" />
            <JobItem job="DRG" />
            <JobItem job="NIN" />
            <JobItem job="SAM" />
          </JobGroup>
          <JobGroup name="远程物理职业">
            <JobItem job="BRD" />
            <JobItem job="MCH" />
          </JobGroup>
          <JobGroup name="远程魔法职业">
            <JobItem job="BLM" />
            <JobItem job="SMN" />
            <JobItem job="RDM" />
            <JobItem job="WHM" />
          </JobGroup>
        </div>
        <div className="job-selector_column">
          <JobGroup name="能工巧匠">
            <JobItem job="WHM" />
            <JobItem job="WHM" />
            <JobItem job="WHM" />
            <JobItem job="WHM" />
            <JobItem job="WHM" />
            <JobItem job="WHM" />
            <JobItem job="WHM" />
            <JobItem job="WHM" />
          </JobGroup>
        </div>
        <div className="job-selector_column">
          <JobGroup name="大地使者">
            <JobItem job="WHM" />
            <JobItem job="WHM" />
            <JobItem job="WHM" />
          </JobGroup>
        </div>
        <Icon className="job-selector_background-icon" name="jobs/WHM" />
      </div>
    );
  }
}

@observer
class JobGroup extends Component<{ name: string }> {
  render() {
    const { name, children } = this.props;
    return (
      <div className="job-selector_group">
        <div className="job-selector_group-name">{name}</div>
        {children}
      </div>
    );
  }
}

@observer
class JobItem extends Component<{ job: G.Job }> {
  render() {
    const { store } = this;
    const { job } = this.props;
    const schema = G.jobSchemas[job];
    return (
      <Ripple>
        <span className="job-selector_item" onClick={() => store.condition.setJob(job)}>
          {schema.name}
          <Icon className="job-selector_icon" name="jobs/WHM" />
        </span>
      </Ripple>
    );
  }
}

export { JobSelector }
