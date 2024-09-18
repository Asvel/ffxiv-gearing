import * as mobxReact from 'mobx-react-lite';
import classNames from 'clsx';
import type { IMateria } from '../stores';
import { useStore } from './components/contexts';
import { Dropdown } from './components/Dropdown';
import { MateriaPanel } from './MateriaPanel';

export const Materia = mobxReact.observer<{ materia: IMateria }>(({ materia }) => {
  const store = useStore();
  return (
    <Dropdown
      label={({ ref, expanded, toggle }) => (
        <span
          ref={ref}
          className={classNames(
            'gears_materia',
            materia.isAdvanced ? '-advanced' : '-normal',
            expanded && '-active',
          )}
          onClick={store.isViewing ? undefined : toggle}
          onContextMenu={store.isViewing ? undefined : e => {
            if (!document.getSelection()?.toString()) {
              e.preventDefault();
              materia.meld(undefined);
            }
          }}
          children={materia.name}
        />
      )}
      popper={({ labelElement }) => (
        <MateriaPanel materia={materia} labelElement={labelElement} />
      )}
      placement="bottom-start"
      modifiers={[{ name: 'offset', options: { offset: [-104 - materia.index * 50, 0] } }]}
    />
  );
});
