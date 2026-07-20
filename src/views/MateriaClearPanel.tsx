import * as React from 'react';
import * as mobxReact from 'mobx-react-lite';
import classNames from 'clsx';
import * as G from '../game';
import type { IGearUnion } from '../stores';
import { Button } from './@rmwc/button';
import { Radio } from './@rmwc/radio';
import { useStore } from './components/contexts';

export const MateriaClearPanel = mobxReact.observer(() => {
  const store = useStore();
  const [mode, setMode] = React.useState<'all' | 'selected'>('all');
  const [selectedSlots, setSelectedSlots] = React.useState<number[]>([]);
  const slotItems = store.schema.slots.flatMap((slot) => {
    const gear = store.equippedGears.get(slot.slot.toString()) as IGearUnion | undefined;
    if (gear === undefined || gear.isFood) return [];
    const materiaCount = gear.materias.filter((materia) => materia.stat !== undefined).length;
    if (materiaCount === 0) return [];
    return [{ slot, gear, materiaCount }];
  }) as { slot: G.SlotSchema; gear: Exclude<IGearUnion, { isFood: true }>; materiaCount: number }[];
  const selectedSlotSet = new Set(selectedSlots);
  const selectedMateriaCount =
    mode === 'all'
      ? slotItems.reduce((sum, item) => sum + item.materiaCount, 0)
      : slotItems.reduce((sum, item) => sum + (selectedSlotSet.has(item.slot.slot) ? item.materiaCount : 0), 0);
  return (
    <div className="materia-clear">
      <div className="materia-clear_controls">
        <Radio label="清空当前已选装备的全部魔晶石" checked={mode === 'all'} onChange={() => setMode('all')} />
        <Radio label="清空指定部位" checked={mode === 'selected'} onChange={() => setMode('selected')} />
      </div>
      {slotItems.length === 0 ? (
        <div className="materia-clear_empty">当前已选装备没有已配置的魔晶石。</div>
      ) : (
        <>
          {mode === 'selected' && (
            <div className="materia-clear_slots">
              {slotItems.map(({ slot, gear, materiaCount }) => (
                <button
                  key={slot.slot}
                  type="button"
                  className={classNames('materia-clear_slot', selectedSlotSet.has(slot.slot) && '-selected')}
                  onClick={() => {
                    setSelectedSlots((slots) =>
                      slots.includes(slot.slot) ? slots.filter((s) => s !== slot.slot) : slots.concat(slot.slot),
                    );
                  }}
                >
                  <span className="materia-clear_slot-name">{slot.shortName ?? slot.name}</span>
                  <span className="materia-clear_gear-name">{gear.name}</span>
                  <span className="materia-clear_count">{materiaCount}</span>
                </button>
              ))}
            </div>
          )}
          <div className="materia-clear_footer">
            <span className="materia-clear_summary">{`将清空 ${selectedMateriaCount} 颗魔晶石`}</span>
            <Button
              className="materia-clear_submit"
              disabled={selectedMateriaCount === 0}
              onClick={() => {
                store.clearMaterias(mode === 'all' ? undefined : selectedSlots);
                setSelectedSlots([]);
              }}
            >
              清空
            </Button>
          </div>
        </>
      )}
    </div>
  );
});

