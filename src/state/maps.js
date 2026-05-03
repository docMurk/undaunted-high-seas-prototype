// Saved terrain maps, persisted in localStorage. Each map = a named snapshot
// of the painted terrain layer (no tiles, no ships). Independent of the
// JSON export/import in serialize.js, which captures the whole board.

const STORAGE_KEY = 'highseas:maps:v1';

function readAll() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAll(maps) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(maps));
}

export function listMaps() {
  return readAll()
    .map(m => ({ name: m.name, createdAt: m.createdAt, updatedAt: m.updatedAt }))
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
}

export function loadMap(name) {
  const m = readAll().find(m => m.name === name);
  return m ? m.terrain : null;
}

export function saveMap(name, terrain) {
  const all = readAll();
  const idx = all.findIndex(m => m.name === name);
  const now = Date.now();
  if (idx >= 0) {
    all[idx] = { ...all[idx], terrain, updatedAt: now };
  } else {
    all.push({ name, terrain, createdAt: now, updatedAt: now });
  }
  writeAll(all);
}

export function deleteMap(name) {
  writeAll(readAll().filter(m => m.name !== name));
}

export function renameMap(oldName, newName) {
  const all = readAll();
  if (all.some(m => m.name === newName)) return false;
  const m = all.find(m => m.name === oldName);
  if (!m) return false;
  m.name = newName;
  m.updatedAt = Date.now();
  writeAll(all);
  return true;
}

export function mapExists(name) {
  return readAll().some(m => m.name === name);
}
