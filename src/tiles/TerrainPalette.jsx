// Sidebar for paint mode: 6 brushes (terrain types + fort), saved-maps panel.
import React, { useEffect, useState, useCallback } from 'react';
import { TERRAIN_TYPES, FORT_TYPES } from '../state/store.js';
import { listMaps, loadMap, saveMap, deleteMap, mapExists, renameMap } from '../state/maps.js';

export const TERRAIN_COLORS = {
  open:      '#0e3358',
  coastline: '#d2b48c',
  reef:      '#5d7a8a',
  island:    '#4a7a3a',
  fog:       '#94a3b8',
};

export const TERRAIN_LABELS = {
  open:      'Open water',
  coastline: 'Coastline',
  reef:      'Reef / sandbar',
  island:    'Island',
  fog:       'Fog bank',
};

const BRUSHES = [
  { id: 'open',      label: 'Open',      hint: 'Default sea — paints over anything' },
  { id: 'coastline', label: 'Coastline', hint: 'Blocks LoS only when fortified' },
  { id: 'reef',      label: 'Reef',      hint: 'Blocks movement, not LoS' },
  { id: 'island',    label: 'Island',    hint: 'Blocks movement and LoS' },
  { id: 'fog',       label: 'Fog',       hint: 'Blocks LoS, not movement' },
  { id: 'fort',      label: 'Fort ⚑',   hint: 'Toggle fort on coastline / island' },
];

function Swatch({ id, active }) {
  const color = TERRAIN_COLORS[id] || '#475569';
  if (id === 'fort') {
    return (
      <div className="w-6 h-6 rounded relative flex items-center justify-center"
           style={{ background: '#1e293b', border: '1px solid #475569' }}>
        <span className="text-amber-300 text-xs leading-none">⚑</span>
      </div>
    );
  }
  return (
    <div className="w-6 h-6 rounded"
         style={{ background: color, border: active ? '2px solid #fbbf24' : '1px solid #1e293b' }} />
  );
}

export default function TerrainPalette({ state, dispatch }) {
  const [maps, setMaps] = useState(() => listMaps());

  const refreshMaps = useCallback(() => setMaps(listMaps()), []);

  // Refresh when this component mounts (e.g. switching modes).
  useEffect(() => { refreshMaps(); }, [refreshMaps]);

  const onSelectBrush = (brush) => dispatch({ type: 'SET_BRUSH', brush });

  const onSaveAs = () => {
    const suggested = state.activeMapName || '';
    const name = prompt('Save map as:', suggested);
    if (!name) return;
    const trimmed = name.trim();
    if (!trimmed) return;
    if (mapExists(trimmed) && !confirm(`Overwrite "${trimmed}"?`)) return;
    saveMap(trimmed, state.terrain);
    dispatch({ type: 'SET_ACTIVE_MAP_NAME', name: trimmed });
    refreshMaps();
  };

  const onSave = () => {
    if (!state.activeMapName) { onSaveAs(); return; }
    saveMap(state.activeMapName, state.terrain);
    refreshMaps();
  };

  const onLoad = (name) => {
    const terrain = loadMap(name);
    if (!terrain) return;
    if (Object.keys(state.terrain).length > 0
        && !confirm(`Load "${name}"? Current unsaved terrain will be replaced.`)) return;
    dispatch({ type: 'LOAD_TERRAIN', terrain, name });
  };

  const onDelete = (name) => {
    if (!confirm(`Delete saved map "${name}"?`)) return;
    deleteMap(name);
    if (state.activeMapName === name) {
      dispatch({ type: 'SET_ACTIVE_MAP_NAME', name: null });
    }
    refreshMaps();
  };

  const onRename = (name) => {
    const next = prompt(`Rename "${name}" to:`, name);
    if (!next || next.trim() === name) return;
    const trimmed = next.trim();
    if (!renameMap(name, trimmed)) {
      alert(`Cannot rename — "${trimmed}" already exists.`);
      return;
    }
    if (state.activeMapName === name) {
      dispatch({ type: 'SET_ACTIVE_MAP_NAME', name: trimmed });
    }
    refreshMaps();
  };

  const onClear = () => {
    if (Object.keys(state.terrain).length === 0) return;
    if (!confirm('Clear all painted terrain?')) return;
    dispatch({ type: 'CLEAR_TERRAIN' });
  };

  const hexCount = Object.keys(state.terrain).length;
  const fortCount = Object.values(state.terrain).filter(t => t.fort).length;

  return (
    <div className="h-full flex flex-col gap-3 bg-slate-900/60 ring-1 ring-slate-800 rounded-lg p-3 overflow-hidden">
      <div>
        <h2 className="text-sm font-semibold text-slate-100">Terrain Brushes</h2>
        <p className="text-[11px] text-slate-500 mt-0.5">
          Click a brush, then click + drag hexes to paint.
        </p>
      </div>

      <div className="flex flex-col gap-1">
        {BRUSHES.map(b => {
          const active = state.activeBrush === b.id;
          return (
            <button
              key={b.id}
              onClick={() => onSelectBrush(b.id)}
              className={`flex items-center gap-2 px-2 py-1.5 rounded text-left transition ${
                active ? 'bg-slate-700 ring-1 ring-amber-400' : 'bg-slate-800 hover:bg-slate-700'
              }`}
              title={b.hint}
            >
              <Swatch id={b.id} active={active} />
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium text-slate-100">{b.label}</div>
                <div className="text-[10px] text-slate-400 truncate">{b.hint}</div>
              </div>
            </button>
          );
        })}
      </div>

      <div className="text-[11px] text-slate-500 px-1">
        {hexCount} hex{hexCount === 1 ? '' : 'es'} painted
        {fortCount > 0 ? ` · ${fortCount} fort${fortCount === 1 ? '' : 's'}` : ''}
      </div>

      <div className="h-px bg-slate-800" />

      <div>
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-sm font-semibold text-slate-100">Saved Maps</h3>
          {state.activeMapName && (
            <span className="text-[10px] text-amber-300 truncate ml-2" title={state.activeMapName}>
              · {state.activeMapName}
            </span>
          )}
        </div>
        <div className="flex gap-1 mb-2">
          <button
            onClick={onSave}
            className="flex-1 px-2 py-1 text-xs rounded bg-emerald-700 hover:bg-emerald-600 text-emerald-50"
          >
            {state.activeMapName ? 'Save' : 'Save…'}
          </button>
          <button
            onClick={onSaveAs}
            className="flex-1 px-2 py-1 text-xs rounded bg-slate-800 hover:bg-slate-700 text-slate-100"
          >
            Save as…
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-auto">
        {maps.length === 0 ? (
          <div className="text-[11px] text-slate-500 italic px-1 py-2">No saved maps yet.</div>
        ) : (
          <ul className="flex flex-col gap-1">
            {maps.map(m => {
              const isActive = state.activeMapName === m.name;
              return (
                <li key={m.name} className={`group rounded px-2 py-1 text-xs ${
                  isActive ? 'bg-slate-700/60 ring-1 ring-amber-500/40' : 'bg-slate-800/60 hover:bg-slate-800'
                }`}>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => onLoad(m.name)}
                      className="flex-1 text-left truncate text-slate-100 hover:text-amber-200"
                      title={`Updated ${new Date(m.updatedAt).toLocaleString()}`}
                    >
                      {m.name}
                    </button>
                    <button
                      onClick={() => onRename(m.name)}
                      className="opacity-0 group-hover:opacity-100 px-1 text-slate-400 hover:text-slate-100"
                      title="Rename"
                    >✎</button>
                    <button
                      onClick={() => onDelete(m.name)}
                      className="opacity-0 group-hover:opacity-100 px-1 text-red-400 hover:text-red-300"
                      title="Delete"
                    >✕</button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <button
        onClick={onClear}
        className="px-2 py-1 text-xs rounded bg-slate-800 hover:bg-red-900 text-slate-300 hover:text-red-100"
      >
        Clear board
      </button>
    </div>
  );
}
