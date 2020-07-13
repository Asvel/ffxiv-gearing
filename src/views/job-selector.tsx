import * as React from 'react';
import { observer } from 'mobx-react-lite';
import { Ripple } from '@rmwc/ripple';
import * as G from '../game';
import { useStore } from './context';
import { Icon } from './icon';

const JobSelector = observer(() => {
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
          <JobItem job="BLU" />
        </JobGroup>
      </div>
      <div className="job-selector_column">
        <JobGroup name="能工巧匠">
          <JobItem job="CRP" />
          <JobItem job="BSM" />
          <JobItem job="ARM" />
          <JobItem job="GSM" />
          <JobItem job="LTW" />
          <JobItem job="WVR" />
          <JobItem job="ALC" />
          <JobItem job="CUL" />
        </JobGroup>
      </div>
      <div className="job-selector_column">
        <JobGroup name="大地使者">
          <JobItem job="MIN" />
          <JobItem job="BTN" />
          <JobItem job="FSH" />
        </JobGroup>
      </div>
      <Icon className="job-selector_background-icon" name="meteo" />
    </div>
  );
});

const JobGroup = observer<{ name: string }>(({ name, children }) => {
  return (
    <div className="job-selector_group">
      <div className="job-selector_group-name">{name}</div>
      {children}
    </div>
  );
});

const JobItem = observer<{ job: G.Job }>(({ job }) => {
  const store = useStore();
  const schema = G.jobSchemas[job];
  return (
    <Ripple>
      <a
        className="job-selector_item"
        href={`?${job}`}
        onClick={e => {
          e.preventDefault();
          store.condition.setJob(job);
          history.pushState(history.state, document.title, location.href);
        }}
      >
        {schema.name}
        <Icon className="job-selector_icon" name={'jobs/' + job} />
      </a>
    </Ripple>
  );
});

export { JobSelector }
