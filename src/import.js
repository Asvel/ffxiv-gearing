(async () => {
  const origin = new URL(document.currentScript.src + '/../').href;
  __webpack_require__.p = origin;

  const data = {
    job: null,
    level: 70,  // FIXME
    gears: [],
  };

  // Ariyala's Final Fantasy XIV Toolkit
  const { characterData } = window;
  if (characterData !== undefined) {
    const { identifier, items, materiaData } = characterData.currentSet;
    data.job = identifier;
    for (const slot of Object.keys(items)) {
      const item = items[slot];
      const id = item.itemID;
      const materias = (materiaData[`${slot}-${item.itemID}`] || []).map(m => {
        const [type, level] = m.split(':');
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
