(async () => {
  const origin = new URL(document.currentScript.src.replace(/\?[\d.]*$/, '') + '/../').href;
  __webpack_require__.p = origin;

  const data = {
    job: null,
    level: 80,  // FIXME
    gears: [],
  };

  try {

    // Ariyala's Final Fantasy XIV Toolkit
    const { characterData } = window;
    if (characterData !== undefined) {
      const { identifier, items, materiaData } = characterData.currentSet;
      data.job = identifier;
      for (const slot of Object.keys(items)) {
        const item = items[slot];
        const id = item.itemID;
        const materias = (materiaData[`${slot}-${item.itemID}`] || []).map(m => {
          const [ type, level ] = m.split(':');
          return [type, Number(level) + 1];
        });
        data.gears.push({ id, materias });
      }
    }

    // FFXIV ORE TOOLS
    const { filterJobClass, equipSelectorList, jqsEquipList, materiaSelectorList, jqsMateriaList  } = window;
    if (filterJobClass !== undefined) {
      const materiaTypes = {
        'mat_hit': 'DHT',
        'mat_crit': 'CRT',
        'mat_will': 'DET',
        'mat_skill_speed': 'SKS',
        'mat_spell_speed': 'SPS',
        'mat_dodge': 'TEN',
        'mat_pie': 'PIE',
        'mat_str': 'STR',
        'mat_vit': 'VIT',
        'mat_dex': 'DEX',
        'mat_int': 'INT',
        'mat_mnd': 'MND',
        'mat_work': 'CMS',
        'mat_edit': 'CRL',
        'mat_cp': 'CP',
        'mat_gain': 'GTH',
        'mat_quality': 'PCP',
        'mat_gp': 'GP',
      };
      const lodestoneIds = (await import(/* webpackChunkName: "import.ore" */'../data/out/lodestoneIds')).default;
      const lodestoneIdToItemId = {};
      for (let i = 0; i < lodestoneIds.length; i++) {
        if (lodestoneIds[i] !== undefined) {
          lodestoneIdToItemId[lodestoneIds[i]] = i;
        }
      }
      data.job = filterJobClass;
      for (let i = 0; i < equipSelectorList.length; i++) {
        const equipSelector = equipSelectorList[i];
        const equip = jqsEquipList[equipSelector].setting.data[jqsEquipList[equipSelector].selectedIndex];
        const materias = jqsMateriaList[materiaSelectorList[i]].selectedMateriaData;
        if (equip.data) {
          const id = lodestoneIdToItemId[equip.data.id];
          if (id !== undefined) {
            const materias = (materias || []).map(m => [materiaTypes[m.key], Number(m.level)]);
            data.gears.push({ id, materias });
          }
        }
      }
    }

    // Etro
    if (/\betro\b/i.test(document.title)) {
      const materiaTypes = {
        6: 'PIE',
        19: 'TEN',
        22: 'DHT',
        27: 'CRT',
        44: 'DET',
        45: 'SKS',
        46: 'SPS',
        10: 'GP',
        11: 'CP',
        70: 'CMS',
        71: 'CRL',
        72: 'GTH',
        73: 'PCP',
      };
      let element = document.getElementById('root')._reactRootContainer._internalRoot.current;
      while (element.child && !(element.memoizedProps && element.memoizedProps.value &&
        element.memoizedProps.value.store)) element = element.child;
      const state = element.memoizedProps.value.store.getState();
      const materiaInfoOfId = {};
      for (const materiaInfo of state.materia.materiaSelectOptions) {
        materiaInfoOfId[materiaInfo.id] = materiaInfo;
      }
      const foodIdToItemId = {};
      for (const food of state.food.listResult) {
        foodIdToItemId[food.id] = food.item;
      }
      for (const [ slot, gear ] of Object.entries(state.gearsets.gearset)) {
        let { id } = gear || {};
        if (id) {
          if (slot === 'food') id = foodIdToItemId[id];
          let materiaKey = id;
          if (slot === 'fingerL') materiaKey += 'L';
          if (slot === 'fingerR') materiaKey += 'R';
          const materia = state.gearsets.gearset.materia[materiaKey];
          const materias = [];
          if (materia) {
            for (const [ index, materiaId ] of Object.entries(materia)) {
              const materiaInfo = materiaInfoOfId[materiaId];
              if (materiaInfo.param in materiaTypes) {
                materias[index - 1] = [materiaTypes[materiaInfo.param], materiaInfo.tier];
              }
            }
          }
          data.gears.push({ id, materias });
        }
      }
      data.job = state.jobs.currentJob.abbrev;
    }

  } catch (e) { debugger; }

  if (data.job !== null) {
    const importUrl = origin + '?import-' + encodeURIComponent(JSON.stringify(data));
    console.log(importUrl);
    if (open(importUrl) === null) {
      prompt('Open this url to import.', importUrl);
    }
  } else {
    alert('No compatible data found on this site.');
  }
})();
