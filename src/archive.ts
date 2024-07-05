function createKey(): string {
  let key: string;
  do {
    key = `ffxiv-gearing-${Math.random().toString(36).slice(2, 6)}`;
  } while (sessionStorage.getItem(key) !== null);
  return key;
}

function getCurrentKey(): string | undefined {
  return window.history.state?.archiveKey || undefined;
}

function setCurrentKey(key: string): void {
  window.history.replaceState({ archiveKey: key }, '');
}

let newArchive: object | undefined;
function persistArchiveIfExists(): void {
  if (newArchive !== undefined) {
    let key = getCurrentKey();
    if (key === undefined) {
      key = createKey();
      setCurrentKey(key);
    }
    sessionStorage.setItem(key, JSON.stringify(newArchive));
    newArchive = undefined;
  }
}
setInterval(persistArchiveIfExists, 5000);
window.addEventListener('beforeunload', persistArchiveIfExists);

export function save(archive: object): void {
  newArchive = archive;
}

export function load(key?: string): object | undefined {
  if (key === undefined) {
    key = getCurrentKey();  // eslint-disable-line no-param-reassign
  } else {
    setCurrentKey(key);
  }
  if (key !== undefined) {
    const archive = sessionStorage.getItem(key);
    return archive ? JSON.parse(archive) : undefined;
  }
}
