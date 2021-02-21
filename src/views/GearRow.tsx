import * as mobxReact from 'mobx-react-lite';
import * as classNames from 'classnames';
import * as G from '../game';
import { IGearUnion } from '../stores';
import { useStore } from './components/contexts';
import { Icon } from './components/Icon';
import { IconButton } from './components/IconButton';
import { Dropdown } from './components/Dropdown';
import { GearMenu } from './GearMenu';
import { Materia } from './Materia';

export const GearRow = mobxReact.observer<{
  gear?: IGearUnion,
  slot?: G.SlotSchema,
  isGroupEnd?: boolean,
}>(({ gear, slot, isGroupEnd }) => {
  const store = useStore();
  return gear === undefined ? slot?.levelWeight === 0 ? null : (
    <tr className={classNames('gears_item', isGroupEnd && '-group-end')}>
      <td className="gears_left">
        {slot !== undefined && <span className="gears_inline-slot">{(slot.shortName ?? slot.name).slice(0, 2)}</span>}
        <span className="gears_empty">{store.isViewing ? '无装备' : '无匹配'}</span>
      </td>
      <td className="gears_materias" />
      <td colSpan={store.schema.stats.length}/>
    </tr>
  ) : (
    <tr
      data-id={gear.id}
      className={classNames(
        'gears_item',
        gear.isFood && '-food',
        !store.isViewing && gear.isEquipped && '-selected',
        isGroupEnd && '-group-end',
        !gear.isFood && gear.syncedLevel !== undefined && '-synced',
      )}
      onClick={store.isViewing ? undefined : e => {
        // when dropdown open, clicking on a row usually intends to close dropdown
        if ((e.nativeEvent as any)._isClosingDropdown) return;
        store.equip(gear);
      }}
    >
      <td className={classNames('gears_left', `gears_color-${gear.color}`)}>
        {slot !== undefined && <span className="gears_inline-slot">{(slot.shortName ?? slot.name).slice(0, 2)}</span>}
        {store.setting.gearDisplayName === 'source' && !gear.isFood && gear.source ? (
          <span className="gears_name">
            {gear.source}
            {!gear.isInstalled && <span className="gears_patch">{gear.patch}</span>}
          </span>
        ) : gear.isInstalled ? (
          <span className="gears_name">
            {gear.name}
            {gear.hq && <Icon className="gears_hq" name="hq"/>}
          </span>
        ) : (
          <span className="gears_name">
            <span className="gears_origin">{!gear.isFood ? '*' + gear.source : gear.name}</span>
            <span className="gears_patch">{gear.patch}</span>
          </span>
        )}
        <Dropdown
          label={({ ref, toggle }) => (
            <IconButton ref={ref} className="gears_more" icon="more" onClick={toggle} />
          )}
          popper={({ toggle }) => (
            <GearMenu gear={gear} toggle={toggle} />
          )}
          placement="bottom-end"
        />
        <span className="gears_level">il{gear.level}</span>
      </td>
      <td className="gears_materias">
        {!gear.isFood && gear.materias.map((materia, i) => (
          <Materia key={i} materia={materia} />
        ))}
        {gear.isFood && (
          store.isViewing ? (
            <span className="gears_food-utilization">利用率{gear.utilization}%</span>
          ) : (
            <span
              className={classNames('gears_food-utilization', gear.utilization === 100 && '-full')}
              style={{ opacity: gear.utilizationOpacity }}
            >{gear.utilization}%</span>
          )
        )}
        {!gear.isFood && gear.syncedLevel !== undefined && (
          <div className="gears_materias-synced">
            <Icon name="sync" />
          </div>
        )}
      </td>
      {store.schema.stats.map(stat => (
        <td key={stat} className={classNames('gears_stat', store.schema.skeletonGears && '-skeleton')}>
          <span
            className={classNames(
              'gears_stat-value',
              gear.statHighlights[stat] && '-full',
              store.schema.skeletonGears && !gear.isFood && gear.slot !== 17 && '-skeleton',
            )}
            children={(gear.isFood || store.setting.displayMeldedStats ? gear.stats : gear.bareStats)[stat]}
          />
          {store.schema.skeletonGears && !gear.isFood && gear.materias.length > 0 && (
            <span className="gears_stat-caps">/{gear.caps[stat]}</span>
          )}
          {!store.isViewing && stat !== 'VIT' && gear.isFood && gear.requiredStats[stat] && (
            <span
              className={classNames(
                'gears_stat-requirement',
                store.equippedStatsWithoutFood[stat]! >= gear.requiredStats[stat]! && '-enough',
              )}
            >{gear.requiredStats[stat]}+</span>
          )}
        </td>
      ))}
    </tr>
  );
});
