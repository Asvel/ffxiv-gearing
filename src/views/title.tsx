import * as React from 'react';
import { observer } from 'mobx-react-lite';

const Title = observer(() => {
  return (
    <div className="title card">
      <div className="title_text">最终幻想14配装器</div>
      <span className="title_version">1909a</span>
      <span className="title_separator">·</span>
      <a
        className="title_link"
        href="https://github.com/Asvel/ffxiv-gearing#license"
        target="_blank"
        children="License"
      />
      <span className="title_separator">·</span>
      <a
        className="title_link"
        href="https://github.com/Asvel/ffxiv-gearing"
        target="_blank"
        children="Fork"
      />
    </div>
  );
});

export { Title };
