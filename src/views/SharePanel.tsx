import * as mobxReact from 'mobx-react-lite';
import { Button } from '@rmwc/button';
import Clipboard from 'react-clipboard.js';
import { useStore } from './components/contexts';

export const SharePanel = mobxReact.observer(() => {
  const store = useStore();
  return (
    <div className="share card">
      <a className="share_url" href={store.shareUrl} target="_blank">{store.shareUrl}</a>
      <div className="share_tip">分享时只会包含选中的装备。</div>
      <Clipboard
        className="share_copy"
        component="span"
        data-clipboard-text={store.shareUrl}
        children={<Button>复制</Button>}
      />
    </div>
  );
});
