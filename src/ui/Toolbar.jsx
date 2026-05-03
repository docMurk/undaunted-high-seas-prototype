// Top toolbar: lock, regenerate palette, clear, export, import.
import React, { useRef } from 'react';
import { exportBoard, importBoardFromFile } from '../state/serialize.js';

export default function Toolbar({ state, dispatch }) {
  const fileInput = useRef(null);

  const handleImport = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    importBoardFromFile(file)
      .then(s => dispatch({ type: 'IMPORT_BOARD', state: s }))
      .catch(err => alert('Import failed: ' + err.message));
    e.target.value = ''; // reset
  };

  const placedCount = state.placed.length;
  const paintMode = state.mode === 'paint';
  const terrainCount = Object.keys(state.terrain || {}).length;

  return (
    <div className="flex items-center justify-between px-4 py-2 bg-slate-900 border-b border-slate-800">
      <div className="flex items-center gap-3">
        <div>
          <h1 className="text-base font-semibold text-slate-100">
            High Seas <span className="text-slate-400 font-normal">— Map Editor</span>
          </h1>
          <p className="text-[11px] text-slate-500 mt-0.5">
            {paintMode
              ? <>{terrainCount}/90 hexes painted{state.activeMapName ? ` · ${state.activeMapName}` : ''}</>
              : <>{placedCount}/18 tiles placed · {state.ships.filter(s=>s.col!==null).length}/{state.ships.length} ships deployed</>}
          </p>
        </div>
        <div className="flex rounded-md overflow-hidden ring-1 ring-slate-700 ml-2">
          <button
            onClick={() => dispatch({ type: 'SET_MODE', mode: 'tile' })}
            className={`px-3 py-1.5 text-xs font-medium transition ${
              !paintMode ? 'bg-slate-700 text-slate-50' : 'bg-slate-900 text-slate-400 hover:bg-slate-800'
            }`}
          >Tile mode</button>
          <button
            onClick={() => dispatch({ type: 'SET_MODE', mode: 'paint' })}
            className={`px-3 py-1.5 text-xs font-medium transition ${
              paintMode ? 'bg-slate-700 text-slate-50' : 'bg-slate-900 text-slate-400 hover:bg-slate-800'
            }`}
          >Hex paint</button>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {!paintMode && (<>
        <button
          onClick={() => dispatch({ type: state.locked ? 'UNLOCK_TILES' : 'LOCK_TILES' })}
          className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${
            state.locked
              ? 'bg-amber-700 hover:bg-amber-600 text-amber-50'
              : 'bg-emerald-700 hover:bg-emerald-600 text-emerald-50'
          }`}
        >
          {state.locked ? '🔒 Tiles locked' : '✏️ Edit tiles'}
        </button>
        <div className="h-6 w-px bg-slate-800" />
        <button
          onClick={() => {
            if (confirm('Regenerate the entire tile palette? Placed tiles are kept.')) {
              dispatch({ type: 'REGENERATE_PALETTE' });
            }
          }}
          className="px-3 py-1.5 rounded-md text-sm bg-slate-800 hover:bg-slate-700 text-slate-200 transition"
        >
          Regenerate palette
        </button>
        <button
          onClick={() => {
            if (confirm('Clear all placed tiles and return ships to reserve?')) {
              dispatch({ type: 'CLEAR_BOARD' });
            }
          }}
          className="px-3 py-1.5 rounded-md text-sm bg-slate-800 hover:bg-slate-700 text-slate-200 transition"
        >
          Clear board
        </button>
        </>)}
        <div className="h-6 w-px bg-slate-800" />
        <button
          onClick={() => exportBoard(state)}
          className="px-3 py-1.5 rounded-md text-sm bg-slate-800 hover:bg-slate-700 text-slate-200 transition"
        >
          Export
        </button>
        <input
          ref={fileInput}
          type="file"
          accept="application/json"
          className="hidden"
          onChange={handleImport}
        />
        <button
          onClick={() => fileInput.current?.click()}
          className="px-3 py-1.5 rounded-md text-sm bg-slate-800 hover:bg-slate-700 text-slate-200 transition"
        >
          Import
        </button>
      </div>
    </div>
  );
}
