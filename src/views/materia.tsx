import * as React from 'react';
import { observer } from 'mobx-react';
import * as classNames from 'classnames';
import * as G from '../gear';
import { IMateria } from "../stores";
import { Component } from './context';
import { Dropdown } from './dropdown';

@observer
class Materia extends Component<{ materia: IMateria }> {
  static popperModifiers = { offset: { offset: '-96px, 0' } };
  render() {
    const { materia } = this.props;
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
            onClick={toggle}
            children={materia.name}
          />
        )}
        popper={() => (
          <MateriaPanel materia={materia} />
        )}
        placement="bottom-start"
        modifiers={Materia.popperModifiers}
      />
    );
  }
}

// @observer
// class Materia2 extends Component<{ materia: IMateria }> {
//   static popperModifiers = { offset: { offset: '-96px, 0' } };
//   render() {
//     const { materia } = this.props;
//     const labelClassName = classNames(
//       'gears_materia',
//       materia.isAdvanced ? '-advanced' : '-normal',
//       materia.expanded && '-active'
//     );
//     const popperContainer = document.getElementById('popper');
//     return materia.expanded && popperContainer ? (
//       <Popper.Manager>
//         <Popper.Reference>
//           {({ ref }) => (
//             <span ref={ref} className={labelClassName}>
//               <Observer render={() => materia.name} />
//             </span>
//           )}
//         </Popper.Reference>
//         {ReactDOM.createPortal(
//           <Popper.Popper
//             innerRef={el => {
//               popperElement = el || undefined;
//               popperOutsideClickHandler = () => materia.setExpanded(false);
//             }}
//             placement="bottom-start"
//             modifiers={Materia.popperModifiers}
//           >
//             {({ placement, ref, style }) => (
//               <div ref={ref} style={style} data-placement={placement}>
//                 <MateriaPanel materia={materia} />
//               </div>
//             )}
//           </Popper.Popper>,
//           popperContainer
//         )}
//       </Popper.Manager>
//     ) : (
//       <span
//         className={labelClassName}
//         onClick={e => {
//           materia.setExpanded(true);
//           e.stopPropagation();
//         }}
//       >
//         {materia.name}
//       </span>
//     );
//   }
//   componentDidMount() {
//     let { materia } = this.props;
//     if (materia.expanded) {
//       this.forceUpdate();
//     }
//   }
// }

@observer
class MateriaPanel extends Component<{ materia: IMateria }>  {
  render() {
    const { store } = this;
    const { materia } = this.props;
    return (
      <table className="materias table card" onClick={e => e.stopPropagation()}>
        <tbody>
        {store.schema.stats.slice(1).map(stat => materia.canMeldStat(stat) && (
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
            {G.materias[stat].map((value, i) => i < materia.maxMeldableGrade && (
              <td
                key={i}
                className={classNames(
                  'materias_grade',
                  materia.stat === stat && materia.grade === i + 1 && '-selected'
                )}
                onClick={() => materia.meld(stat, (i + 1) as G.MateriaGrade)}
                children={'+' + value}
              />
            )).reverse()}
          </tr>
        ))}
        <tr>
          <td className="materias_meldable-title" colSpan={2}>可镶嵌量</td>
          <td
            className={classNames('materias_remove', materia.stat === undefined && '-selected')}
            colSpan={materia.maxMeldableGrade}
            onClick={() => materia.meld(undefined)}
          >
            不镶嵌魔晶石
          </td>
        </tr>
        </tbody>
      </table>
    );
  }
}
//
// let popperElement: HTMLElement | undefined;
// let popperOutsideClickHandler: Function | undefined;
// window.addEventListener('click', e => {
//   if (popperElement !== undefined && popperOutsideClickHandler !== undefined) {
//     if (!popperElement.contains(e.target as Element)) {
//       popperOutsideClickHandler();
//       popperElement = undefined;
//       popperOutsideClickHandler = undefined;
//     }
//   }
// }, true);
// window.addEventListener('keyup', e => {
//   if (popperElement !== undefined && popperOutsideClickHandler !== undefined) {
//     if (e.target && (e.target as Element).tagName === 'BODY') {
//       popperOutsideClickHandler();
//       popperElement = undefined;
//       popperOutsideClickHandler = undefined;
//     }
//   }
// }, true);

export { Materia };
