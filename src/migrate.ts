if (localStorage.getItem('ffxiv-gearing.ew.promotion') === null &&
  localStorage.getItem('ffxiv-gearing-promotion') !== null) {
  const keys = Array.from({ length: localStorage.length }, (_, i) => localStorage.key(i)!);
  for (const key of keys) {
    if (key.startsWith('ffxiv-gearing-')) {
      const suffix = key.slice('ffxiv-gearing-'.length);
      if (suffix.length === 8 || suffix.length === 14) continue;  // archive and archive owner
      localStorage.setItem(`ffxiv-gearing.ew.${suffix}`, localStorage.getItem(key)!);
    }
  }
}

if (window.history.state?.archiveKey?.startsWith('ffxiv-gearing-')) {
  window.history.replaceState(window.history.state, document.title,
    window.location.href.replace(/\/([^\/]*)$/, '/shb/$1'));
  window.location.reload();
}
