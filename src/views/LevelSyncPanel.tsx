import * as mobxReact from 'mobx-react-lite';
import classNames from 'clsx';
import { Ripple, RippleSurface } from './@rmwc/ripple';
import { Button } from './@rmwc/button';
import { CollapsibleList } from './@rmwc/list';
import * as G from '../game';
import { useStore } from './components/contexts';
import { RippleLazy } from './components/RippleLazy';
import { Icon } from './components/Icon';
import type { DropdownPopperProps } from './components/Dropdown';

export const LevelSyncPanel = mobxReact.observer<DropdownPopperProps>(({ toggle }) => {
  const store = useStore();
  return (
    <div className="level-sync card">
      <ul className="mdc-list">
        {G.jobLevels.map(jobLevel=> jobLevel <= store.schema.jobLevel && (
          <CollapsibleList
            key={jobLevel}
            defaultOpen={jobLevel === (store.syncLevelText === undefined ? initialExpandedJobLevel : store.jobLevel)}
            handle={
              <Ripple surface={false}>
                <li tabIndex={0} className="level-sync_group mdc-list-item">
                  <RippleSurface className="mdc-list-item__ripple" />
                  <span className="mdc-list-item__text">{jobLevel}级</span>
                  <i className="mdc-list-item__meta" aria-hidden="true">
                    <Icon className="level-sync_group-icon" name="chevron-right" />
                  </i>
                </li>
              </Ripple>
            }
            children={
              <div className="level-sync_levels">
                {G.syncLevels[jobLevel].map(level => (
                  <RippleLazy key={level}>
                    <span
                      className={classNames(
                        'level-sync_level',
                        G.syncLevelIsPopular[level] && '-popular',
                        level === store.syncLevel && '-selected',
                      )}
                      onClick={() => {
                        store.setSyncLevel(level, jobLevel);
                        toggle();
                      }}
                      children={level}
                    />
                  </RippleLazy>
                ))}
                {jobLevel !== store.schema.jobLevel && (
                  <RippleLazy>
                    <span
                      className={classNames(
                        'level-sync_job-level-sync',
                        jobLevel === store.jobLevel && store.syncLevel === undefined && '-selected',
                      )}
                      onClick={() => {
                        store.setSyncLevel(undefined, jobLevel);
                        toggle();
                      }}
                      children="仅同步等级"
                    />
                  </RippleLazy>
                )}
              </div>
            }
          />
        ))}
        {(store.jobLevel !== store.schema.jobLevel || store.syncLevel !== undefined) && (
          <Button
            className="level-sync_cancel"
            onClick={() => {
              store.setSyncLevel(undefined, undefined);
              toggle();
            }}
            children="取消同步"
          />
        )}
      </ul>
    </div>
  );
});

const initialExpandedJobLevel = (() => {
  for (let i = G.jobLevels.length - 1; i > 0; i--) {
    for (const syncLevel of G.syncLevels[G.jobLevels[i]]) {
      if (G.syncLevelIsPopular[syncLevel]) {
        return G.jobLevels[i];
      }
    }
  }
})();
