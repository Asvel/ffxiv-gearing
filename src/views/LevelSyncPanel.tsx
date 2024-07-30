import * as mobxReact from 'mobx-react-lite';
import * as classNames from 'classnames';
import { Button } from '@rmwc/button';
import { List, SimpleListItem, CollapsibleList } from '@rmwc/list';
import * as G from '../game';
import { useStore } from './components/contexts';
import { RippleLazy } from './components/RippleLazy';
import { Icon } from './components/Icon';
import { DropdownPopperProps } from './components/Dropdown';

export const LevelSyncPanel = mobxReact.observer<DropdownPopperProps>(({ toggle }) => {
  const store = useStore();
  return (
    <div className="level-sync card">
      <List>
        {G.jobLevels.map(jobLevel=> jobLevel <= store.schema.jobLevel && (
          <CollapsibleList
            key={jobLevel}
            defaultOpen={jobLevel === (store.syncLevelText === undefined ? initialExpandedJobLevel : store.jobLevel)}
            handle={
              <SimpleListItem
                className="level-sync_group"
                text={`${jobLevel}级`}
                metaIcon={<Icon className="level-sync_group-icon" name="chevron-right" />}
              />
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
      </List>
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
