// JSON export/import of board state. Format version 2 includes the
// multiplayer / cards slices added by the High Seas digital build (PRD).

import { EMPTY_ZONES } from './cardActions.js';
import { serializeForShared } from '../net/sync.js';

const FORMAT_VERSION = 2;

export function exportBoard(state) {
  // If a localPlayer is set, run the export through serializeForShared so
  // the file doesn't leak owner-private cardIds. Solo / no-player export is
  // captured verbatim.
  const owner = state.localPlayer || null;
  const stripped = owner ? serializeForShared(state, owner) : state;
  const json = JSON.stringify({
    version: FORMAT_VERSION,
    palette: stripped.palette,
    placed: stripped.placed,
    ships: stripped.ships,
    locked: stripped.locked,
    mode: stripped.mode,
    terrain: stripped.terrain,
    activeBrush: stripped.activeBrush,
    activeMapName: stripped.activeMapName,
    // cards / multiplayer slices
    players:  stripped.players,
    zones:    stripped.zones,
    playArea: stripped.playArea,
    rolls:    stripped.rolls,
    gameOver: stripped.gameOver,
  }, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `high-seas-board-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function importBoardFromFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        if (!data || (data.version !== 1 && data.version !== 2)) {
          reject(new Error('Unrecognized board file (expected version 1 or 2).'));
          return;
        }
        resolve({
          palette: data.palette || [],
          placed: Array.isArray(data.placed) ? data.placed : [],
          ships: data.ships || [],
          locked: !!data.locked,
          mode: data.mode === 'paint' ? 'paint' : 'tile',
          terrain: data.terrain || {},
          activeBrush: data.activeBrush || 'coastline',
          activeMapName: data.activeMapName || null,
          selectedTileInstanceId: null,
          selectedShipId: null,
          // v2 multiplayer slices (default-empty for v1 imports)
          players:  data.players  || { p1: null, p2: null },
          zones:    data.zones    || { p1: EMPTY_ZONES(), p2: EMPTY_ZONES() },
          playArea: Array.isArray(data.playArea) ? data.playArea : [],
          rolls:    Array.isArray(data.rolls) ? data.rolls : [],
          gameOver: !!data.gameOver,
        });
      } catch (e) {
        reject(e);
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}
