(async () => {
  const origin = new URL(document.currentScript.src.replace(/\?[\d.]*$/, '') + '/../').href;
  __webpack_require__.p = origin;  // eslint-disable-line no-undef

  const data = {
    job: null,
    gears: [],
  };

  const materiaTypes = {
    6: 'PIE', 19: 'TEN', 22: 'DHT', 27: 'CRT', 44: 'DET', 45: 'SKS', 46: 'SPS',
    10: 'GP', 11: 'CP', 70: 'CMS', 71: 'CRL', 72: 'GTH', 73: 'PCP',
  };

  try {

    // Ariyala's Final Fantasy XIV Toolkit
    const { characterData, ContentGearCalculator } = window;
    if (characterData !== undefined) {
      const { identifier, items, materiaData } = characterData.currentSet;
      for (const slot of Object.keys(items)) {
        const item = items[slot];
        const id = item.itemID;
        const materias = (materiaData[`${slot}-${item.itemID}`] || []).map(m => {
          const [ type, level ] = m.split(':');
          return [type, Number(level) + 1];
        });
        data.gears.push({ id, materias });
      }
      data.job = identifier;
      data.jobLevel = parseInt(ContentGearCalculator.currentLevel, 10);
    }

    // FFXIV ORE TOOLS
    const { filterJobClass, equipSelectorList, jqsEquipList, materiaSelectorList, jqsMateriaList } = window;
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
      const lodestoneIds = (await import(/* webpackChunkName: "lodestone-id" */'../data/out/lodestoneIds')).default;
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
        const materiaData = jqsMateriaList[materiaSelectorList[i]].selectedMateriaData;
        if (equip.data) {
          const id = lodestoneIdToItemId[equip.data.id];
          if (id !== undefined) {
            const materias = (materiaData || []).map(m => [materiaTypes[m.key], Number(m.level)]);
            data.gears.push({ id, materias });
          }
        }
      }
    }

    // Etro
    if (/\betro\b/i.test(document.title)) {
      let element = document.getElementById('root')._reactRootContainer._internalRoot.current;
      while (element.child && !(element.memoizedProps?.value?.store)) element = element.child;
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
        if (!gear) continue;
        let { id } = gear;
        let customStats;
        if (gear.baseItemId) {
          id = gear.baseItemId;
          customStats = {};
          for (let i = 0; i <= 6; i++) {
            const stat = materiaTypes[gear[`param${i}`]];
            const value = gear[`param${i}Value`];
            if (stat !== undefined && value > 0) {
              customStats[stat] = value;
            }
          }
        }
        if (id) {
          if (slot === 'food') id = foodIdToItemId[id];
          let materiaKey = id;
          if (slot === 'fingerL') materiaKey += 'L';
          if (slot === 'fingerR') materiaKey += 'R';
          const materia = state.gearsets.gearset.materia?.[materiaKey];
          const materias = [];
          if (materia) {
            for (const [ index, materiaId ] of Object.entries(materia)) {
              const materiaInfo = materiaInfoOfId[materiaId];
              if (materiaInfo !== undefined && materiaInfo.param in materiaTypes) {
                materias[index - 1] = [materiaTypes[materiaInfo.param], materiaInfo.tier];
              }
            }
          }
          data.gears.push({ id, materias, customStats });
        }
      }
      data.job = state.jobs.currentJob.abbrev;
      data.jobLevel = state.gearsets.gearset.level;
      data.syncLevel = state.gearsets.gearset.itemLevelSync;
    }

    // FFXIV Teamcraft
    const teamcraftApp = document.getElementsByTagName('app-gearset-display')[0];
    if (teamcraftApp !== undefined) {
      // obtain component instance in a very evil way...
      const mainUrl = Array.from(document.getElementsByTagName('script'),
          e => e.getAttribute('src')).find(s => s?.includes('/main-'));
      const mainScript = await (await fetch(mainUrl)).text();
      const gearsetPath = /path:"gearset",loadChildren:\(\)=>import\("([^"]+)"/.exec(mainScript)[1];
      const gearsetUrl = new URL(gearsetPath, mainUrl).href;
      const { GearsetModule } = await import(/* webpackIgnore: true */gearsetUrl);
      const Component = GearsetModule.prototype.constructor.ɵinj.imports
        .find(i => i.providers).providers[0].useValue[0].component;
      const { copyToClipboard } = Component.prototype;
      let component;  // eslint-disable-next-line @typescript-eslint/no-this-alias
      Component.prototype.copyToClipboard = function () { component = this; };
      teamcraftApp.querySelector('.page-title [nztype="snippets"]').parentNode.click();
      Component.prototype.copyToClipboard = copyToClipboard;

      const subscribe = observable => new Promise(resolve => { observable.subscribe(v => resolve(v)); });
      const gearset = await subscribe(component.gearset$);
      const materias = await subscribe(component.lazyData.getEntry('materias'));
      const materiaMap = {};
      materias.forEach(m => { materiaMap[m.itemId] = m; });
      for (const item of Object.values(gearset)) {
        if (item?.itemId) {
          const materias = item.materias.map(materiaId => {
            const materia = materiaMap[materiaId];
            if (!materia) return null;
            const stat = materiaTypes[materia.baseParamId];
            if (!stat) return null;
            return [stat, materia.tier];
          });
          data.gears.push({ id: item.itemId, materias });
        }
      }
      const food = await subscribe(component.food$);
      if (food) {  // food
        data.gears.push({ id: food.ID, materias: [] });
      }
      const jobAbbr = await subscribe(component.lazyData.getEntry('jobAbbr'));
      data.job = jobAbbr[gearset.job].en;
      data.jobLevel = await subscribe(component.level$);
    }

  } catch (e) { debugger; }  // eslint-disable-line no-debugger

  if (data.job !== null) {
    const importUrl = origin + '?import-' + encodeURIComponent(JSON.stringify(data));
    console.log(importUrl);
    if (window.open(importUrl) === null) {
      prompt('打开此链接进行导入：', importUrl);
    }
  } else {
    alert('未能在此页面中找到支持导入的数据。');
  }
})();
