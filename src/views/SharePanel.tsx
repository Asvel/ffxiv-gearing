import * as mobxReact from 'mobx-react-lite';
import { Button } from './@rmwc/button';
import { useStore } from './components/contexts';

export const SharePanel = mobxReact.observer(() => {
  const store = useStore();
  return (
    <div className="share card">
      <a className="share_url" href={store.shareUrl} target="_blank">{store.shareUrl}</a>
      <div className="share_tip">分享时只会包含选中的装备。</div>
      <span
        className="share_copy"
        onClick={() => navigator.clipboard.writeText(store.shareUrl)}
      >
        <Button>复制</Button>
      </span>
    </div>
  );
});
