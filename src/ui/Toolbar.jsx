// Top toolbar: lock, regenerate palette, clear, export, import + multiplayer
// controls (room ID, faction LED, sync LED, End Game).
import React, { useRef, useState } from 'react';
import { exportBoard, importBoardFromFile } from '../state/serialize.js';
import { buildRoomShareLink } from '../net/room.js';
import { isFirebaseConfigured } from '../net/firebase.js';

function FactionLed({ state }) {
  const localPlayer = state.localPlayer;
  if (!localPlayer) return null;
  const fac = state.players?.[localPlayer]?.faction;
  if (!fac) return null;
  const info = state.cardData?.factions?.[fac];
  return (
    <div className="flex items-center gap-1.5 text-[11px] text-slate-300">
      <span
        className="inline-block w-3 h-3 rounded-full ring-1 ring-slate-600"
        style={{ background: info?.primary || '#888' }}
      />
      <span>{info?.label || fac}</span>
      <span className="text-slate-500">· {localPlayer}</span>
    </div>
  );
}

function SyncLed({ state }) {
  const map = {
    offline:    { color: 'bg-slate-500', label: 'offline' },
    connecting: { color: 'bg-amber-500 animate-pulse', label: 'connecting' },
    connected:  { color: 'bg-emerald-500', label: 'connected' },
    error:      { color: 'bg-red-500', label: 'error' },
  };
  const info = map[state.syncStatus] || map.offline;
  return (
    <div className="flex items-center gap-1.5 text-[11px] text-slate-400" title={`sync: ${info.label}`}>
      <span className={`inline-block w-2.5 h-2.5 rounded-full ${info.color}`} />
      <span>{info.label}</span>
    </div>
  );
}

function RoomBadge({ state, onCreate, onLeave }) {
  const [copied, setCopied] = useState(false);
  if (!state.roomId) {
    return (
      <button
        onClick={onCreate}
        className="px-2 py-1 rounded text-xs bg-slate-800 hover:bg-slate-700 text-slate-200"
        title={isFirebaseConfigured() ? 'Create a room' : 'Create a room (offline — no sync)'}
      >
        + Room
      </button>
    );
  }
  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(buildRoomShareLink(state.roomId));
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {}
  };
  return (
    <div className="flex items-center gap-1 text-[11px] text-slate-300">
      <span className="font-mono px-1.5 py-0.5 rounded bg-slate-800 ring-1 ring-slate-700">
        room {state.roomId}
      </span>
      <button
        onClick={onCopy}
        className="px-1.5 py-0.5 rounded text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-300"
        title="Copy join link"
      >{copied ? '✓ copied' : '📋'}</button>
      <button
        onClick={onLeave}
        className="px-1.5 py-0.5 rounded text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-300"
        title="Leave room"
      >×</button>
    </div>
  );
}

export default function Toolbar({
  state, dispatch,
  onCreateRoom, onLeaveRoom, onEndGame, onSwitchPlayer, onPickFaction,
}) {
  const fileInput = useRef(null);

  const handleImport = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    importBoardFromFile(file)
      .then(s => dispatch({ type: 'IMPORT_BOARD', state: s }))
      .catch(err => alert('Import failed: ' + err.message));
    e.target.value = '';
  };

  const placedCount = state.placed.length;
  const paintMode = state.mode === 'paint';
  const terrainCount = Object.keys(state.terrain || {}).length;

  return (
    <div className="flex items-center justify-between px-4 py-2 bg-slate-900 border-b border-slate-800 flex-wrap gap-y-1">
      <div className="flex items-center gap-3">
        <div>
          <h1 className="text-base font-semibold text-slate-100">
            High Seas <span className="text-slate-400 font-normal">— Map Editor</span>
          </h1>
          <p className="text-[11px] text-slate-500 mt-0.5">
            {paintMode
              ? <>{terrainCount} hex{terrainCount === 1 ? '' : 'es'} painted{state.activeMapName ? ` · ${state.activeMapName}` : ''} · {state.ships.filter(s=>s.col!==null).length}/{state.ships.length} ships deployed</>
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

      <div className="flex items-center gap-2 flex-wrap">
        {/* Multiplayer cluster */}
        <div className="flex items-center gap-2 px-2 py-1 rounded bg-slate-900/80 ring-1 ring-slate-800">
          <RoomBadge state={state} onCreate={onCreateRoom} onLeave={onLeaveRoom} />
          <SyncLed state={state} />
          <FactionLed state={state} />
          {state.localPlayer ? (
            <button
              onClick={onSwitchPlayer}
              className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300"
              title="Switch player (solo / sandbox)"
            >switch</button>
          ) : (
            <button
              onClick={onPickFaction}
              className="text-[10px] px-1.5 py-0.5 rounded bg-amber-700 hover:bg-amber-600 text-amber-50"
            >pick faction</button>
          )}
          {state.localPlayer && state.locked && (
            <button
              onClick={onEndGame}
              className="text-[10px] px-1.5 py-0.5 rounded bg-red-900 hover:bg-red-800 text-red-100"
            >End game</button>
          )}
        </div>

        <button
          onClick={() => dispatch({ type: state.locked ? 'UNLOCK_TILES' : 'LOCK_TILES' })}
          className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${
            state.locked
              ? 'bg-amber-700 hover:bg-amber-600 text-amber-50'
              : 'bg-emerald-700 hover:bg-emerald-600 text-emerald-50'
          }`}
        >
          {paintMode
            ? (state.locked ? '🔒 Map locked' : '🖌 Paint map')
            : (state.locked ? '🔒 Tiles locked' : '✏️ Edit tiles')}
        </button>
        <div className="h-6 w-px bg-slate-800" />
        {!paintMode && (<>
        <button
          onClick={() => {
            if (confirm('Regenerate the entire tile palette? Placed tiles are kept.')) {
              dispatch({ type: 'REGENERATE_PALETTE' });
            }
          }}
          className="px-3 py-1.5 rounded-md text-sm bg-slate-800 hover:bg-slate-700 text-slate-200 transition"
        >Regenerate palette</button>
        <button
          onClick={() => {
            if (confirm('Clear all placed tiles and return ships to reserve?')) {
              dispatch({ type: 'CLEAR_BOARD' });
            }
          }}
          className="px-3 py-1.5 rounded-md text-sm bg-slate-800 hover:bg-slate-700 text-slate-200 transition"
        >Clear board</button>
        </>)}
        <div className="h-6 w-px bg-slate-800" />
        <button
          onClick={() => exportBoard(state)}
          className="px-3 py-1.5 rounded-md text-sm bg-slate-800 hover:bg-slate-700 text-slate-200 transition"
        >Export</button>
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
        >Import</button>
        <div className="h-6 w-px bg-slate-800" />
        <button
          onClick={() => dispatch({ type: 'TOGGLE_RULES_PANEL' })}
          className={`px-3 py-1.5 rounded-md text-sm transition ${
            state.rulesPanelOpen
              ? 'bg-slate-700 text-slate-50'
              : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
          }`}
          title="Toggle ship rules / dice panel"
        >📖 Rules</button>
      </div>
    </div>
  );
}
