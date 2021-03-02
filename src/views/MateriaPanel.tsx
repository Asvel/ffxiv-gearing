import * as mobxReact from 'mobx-react-lite';
import * as classNames from 'classnames';
import * as G from '../game';
import { IMateria } from '../stores';
import { useStore } from './components/contexts';
import { DropdownPopperProps } from './components/Dropdown';

export const MateriaPanel = mobxReact.observer<{
  materia: IMateria,
  labelElement: DropdownPopperProps['labelElement'],
}>(({ materia, labelElement }) => {
  const store = useStore();
  return (
    <table className="materias table card">
      <tbody>
      {store.schema.stats.map(stat => stat in G.materias && (
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
          <td className="materias_stat-name">{G.materiaStatNames[stat].slice(0, 2)}</td>
          {materia.meldableGrades.map(grade => (
            <td
              key={grade}
              className={classNames(
                'materias_grade',
                materia.stat === stat && materia.grade === grade && '-selected',
              )}
              onClick={() => {
                if (materia.stat === undefined) {  // Only for initial melding, not for changing materia
                  const nextMateria = labelElement?.nextElementSibling;
                  if (nextMateria === null) {
                    labelElement?.click();
                  }
                  if (nextMateria?.childNodes.length === 0) {
                    (nextMateria as HTMLElement).click();
                  }
                }
                materia.meld(stat, grade);
              }}
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
