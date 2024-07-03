if (localStorage.getItem('ffxiv-gearing.dt.promotion') === null &&
  localStorage.getItem('ffxiv-gearing.ew.promotion') !== null) {
  const keys = Array.from({ length: localStorage.length }, (_, i) => localStorage.key(i)!);
  for (const key of keys) {
    if (key.startsWith('ffxiv-gearing.ew.')) {
      const suffix = key.slice('ffxiv-gearing.ew.'.length);
      if (suffix.startsWith('archive.')) continue;
      localStorage.setItem(`ffxiv-gearing.dt.${suffix}`, localStorage.getItem(key)!);
    }
  }
}

if (window.history.state?.archiveKey?.startsWith('ffxiv-gearing.ew.')) {
  window.history.replaceState(window.history.state, document.title,
    window.location.href.replace(/\/([^\/]*)$/, '/ew/$1'));
  window.location.reload();
}
