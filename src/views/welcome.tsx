import * as React from 'react';
import { observer } from 'mobx-react';
import { Component } from './context';
import { Button } from './button';
import { Icon } from './icon';
import { JobSelector } from './jobSelector';

@observer
class Welcome extends Component {
  render() {
    return (
      <div className="welcome card">
        <Icon className="welcome_logo" name="logo" />
        <div className="welcome_appname">最终幻想14配装器</div>
        <div className="welcome_divider" />
        <JobSelector />
        <span className="welcome_extra-action">
          <Button>从其他配装器导入</Button>
          <Button>历史记录</Button>
        </span>
      </div>
    );
  }
}

export { Welcome };
