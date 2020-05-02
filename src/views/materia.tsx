import * as React from 'react';
import { observer } from 'mobx-react-lite';
import * as classNames from 'classnames';
import * as G from '../game';
import { IMateria } from "../stores";
import { useStore } from './context';
import { Dropdown } from './dropdown';

const Materia = observer<{ materia: IMateria }>(({ materia }) => {
  const store = useStore();
  return (
    <Dropdown
      label={({ ref, expanded, toggle }) => (
        <span
          ref={ref}
          className={classNames(
            'gears_materia',
            materia.isAdvanced ? '-advanced' : '-normal',
            expanded && '-active'
          )}
          onClick={store.isViewing ? undefined : toggle}
          children={materia.name}
        />
      )}
      popper={() => (
        <MateriaPanel materia={materia} />
      )}
      placement="bottom-start"
      modifiers={React.useMemo(() => ([{ name: 'offset', options: { offset: [-93, 0] } }]), [])}
    />
  );
});

const MateriaPanel = observer<{ materia: IMateria }>(({ materia }) => {
  const store = useStore();
  return (
    <table className="materias table card">
      <tbody>
      {store.schema.stats.slice(1).map(stat => stat in G.materias && (
        <tr
          key={stat}
          className={classNames('materias_row', materia.gear.currentMeldableStats[stat]! <= 0 && '-invalid')}
        >
          <td
            className={classNames(
              'materias_meldable',
              materia.gear.currentMeldableStats[stat]! < 0 && '-overflowed')
            }
          >
            {materia.gear.currentMeldableStats[stat]}
          </td>
          <td className="materias_stat-name">{G.statNames[stat]}</td>
          {materia.meldableGrades.map(grade => (
            <td
              key={grade}
              className={classNames(
                'materias_grade',
                materia.stat === stat && materia.grade === grade && '-selected'
              )}
              onClick={() => materia.meld(stat, grade)}
              children={'+' + G.materias[stat]![grade - 1]}
            />
          ))}
        </tr>
      ))}
      <tr>
        <td className="materias_meldable-title" colSpan={2}>可镶嵌值</td>
        <td
          className={classNames('materias_remove', materia.stat === undefined && '-selected')}
          colSpan={materia.meldableGrades.length}
          onClick={() => materia.meld(undefined)}
        >
          不镶嵌魔晶石
        </td>
      </tr>
      </tbody>
    </table>
  );
});

export { Materia };
