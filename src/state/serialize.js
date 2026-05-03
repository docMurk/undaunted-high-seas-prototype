// JSON export/import of board state.

export function exportBoard(state) {
  const json = JSON.stringify({
    version: 1,
    palette: state.palette,
    placed: state.placed,
    ships: state.ships,
    locked: state.locked,
    mode: state.mode,
    terrain: state.terrain,
    activeBrush: state.activeBrush,
    activeMapName: state.activeMapName,
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
        if (!data || data.version !== 1) {
          reject(new Error('Unrecognized board file (expected version 1).'));
          return;
        }
        resolve({
          palette: data.palette || [],
          placed: data.placed || {},
          ships: data.ships || [],
          locked: !!data.locked,
          mode: data.mode === 'paint' ? 'paint' : 'tile',
          terrain: data.terrain || {},
          activeBrush: data.activeBrush || 'coastline',
          activeMapName: data.activeMapName || null,
          selectedTileKey: null,
          selectedShipId: null,
        });
      } catch (e) {
        reject(e);
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}
