import type * as React from 'react';
import * as mobxReact from 'mobx-react-lite';
import * as G from '../game';
import { useStore } from './components/contexts';
import { RippleLazy } from './components/RippleLazy';
import { Icon } from './components/Icon';

export const JobSelector = mobxReact.observer(() => {
  return (
    <div className="job-selector">
      <div className="job-selector_column">
        <JobGroup name="防护职业">
          <JobItem job="PLD" />
          <JobItem job="WAR" />
          <JobItem job="DRK" />
          <JobItem job="GNB" />
        </JobGroup>
        <JobGroup name="近战职业">
          <JobItem job="MNK" />
          <JobItem job="DRG" />
          <JobItem job="NIN" />
          <JobItem job="SAM" />
          <JobItem job="RPR" />
          <JobItem job="VPR" />
        </JobGroup>
      </div>
      <div className="job-selector_column">
        <JobGroup name="治疗职业">
          <JobItem job="WHM" />
          <JobItem job="SCH" />
          <JobItem job="AST" />
          <JobItem job="SGE" />
        </JobGroup>
        <JobGroup name="远程物理职业">
          <JobItem job="BRD" />
          <JobItem job="MCH" />
          <JobItem job="DNC" />
        </JobGroup>
        <JobGroup name="远程魔法职业">
          <JobItem job="BLM" />
          <JobItem job="SMN" />
          <JobItem job="RDM" />
          <JobItem job="PCT" />
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
      <div className="job-selector_background-icon">
        <Icon name="meteo" />
      </div>
    </div>
  );
});

const JobGroup = mobxReact.observer<{ name: string, children: React.ReactNode }>(({ name, children }) => {
  return (
    <div className="job-selector_group">
      <div className="job-selector_group-name">{name}</div>
      {children}
    </div>
  );
});

const JobItem = mobxReact.observer<{ job: G.Job }>(({ job }) => {
  const store = useStore();
  const schema = G.jobSchemas[job];
  return (
    <RippleLazy>
      <a
        className="job-selector_item"
        href={`?${job}`}
        onClick={e => {
          e.preventDefault();
          if (store.job === undefined) {
            window.history.pushState(window.history.state, document.title, window.location.href);
          }
          store.setJob(job);
        }}
      >
        {schema.name}
        <Icon className="job-selector_icon" name={'jobs/' + job} />
      </a>
    </RippleLazy>
  );
});
