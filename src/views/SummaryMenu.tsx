import * as mobxReact from 'mobx-react-lite';
import Clipboard from 'react-clipboard.js';
import { useStore } from './components/contexts';
import { RippleLazy } from './components/RippleLazy';
import { Icon } from './components/Icon';
import type { DropdownPopperProps } from './components/Dropdown';

export const SummaryMenu = mobxReact.observer<{
  toggle: DropdownPopperProps['toggle'],
}>(({ toggle }) => {
  const store = useStore();
  return (
    <div className="gear-menu card">
      <RippleLazy>
        <a
          className="gear-menu_item"
          href={`http://garlandtools.cn/db/${store.garlandGroup}`}
          target="garlandtools"
          tabIndex={0}
        >
          在 Garland 数据 中以工具组查看 <Icon className="gear-menu_external" name="open-in-new" />
        </a>
      </RippleLazy>
      <div className="gear-menu_divider" />
      <RippleLazy>
        <div/* for ripple */>
          <Clipboard
            className="gear-menu_item"
            component="div"
            data-clipboard-text={store.equippedStatsText}
            onClick={toggle}
          >
            复制套装总属性值
          </Clipboard>
        </div>
      </RippleLazy>
    </div>
  );
});
