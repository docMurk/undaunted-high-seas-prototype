// Top-level editor: composes toolbar + palette + board + ship reserve + cards.
// Owns the cross-component drag state for tile placement and the multiplayer
// (room / faction picker / firebase sync) plumbing.
import React, { useReducer, useState, useRef, useEffect, useCallback } from 'react';
import { reducer, initialState } from './state/store.js';
import Toolbar from './ui/Toolbar.jsx';
import TilePalette, { PaletteDefsSvg } from './tiles/TilePalette.jsx';
import TerrainPalette from './tiles/TerrainPalette.jsx';
import Board from './board/Board.jsx';
import TerrainBoard from './board/TerrainBoard.jsx';
import Tile from './tiles/Tile.jsx';
import ShipReserve from './ships/ShipReserve.jsx';
import ShipRulesPanel from './ships/ShipRulesPanel.jsx';
import Hand from './cards/Hand.jsx';
import ZonePanel from './cards/ZonePanel.jsx';
import PlayArea from './cards/PlayArea.jsx';
import CardModal from './cards/CardModal.jsx';
import FactionPicker from './cards/FactionPicker.jsx';
import { loadCardData, buildDeck } from './cards/data.js';
import { getClientId, getRoomIdFromURL, makeRoomId, setRoomURL } from './net/room.js';
import {
  isFirebaseConfigured, subscribeRoom, writePatch, claimSlot,
} from './net/firebase.js';
import {
  buildSharedPatch, hydrateFromShared, mergeCardMap, saveDeckOrder,
  loadDeckOrder,
} from './net/sync.js';

// Small ghost following the cursor (tile drags only).
const GHOST_HEX = 14;
function PaletteDragGhost({ dragState, mouse }) {
  if (!dragState || dragState.source !== 'palette' || !dragState.tile) return null;
  const hsize = GHOST_HEX;
  const hwidth = 2 * hsize;
  const hspace = hwidth * 0.75;
  const vspace = Math.sqrt(3) * hsize;
  const pad = 3;
  const w = hwidth + hspace + pad * 2;
  const h = 3 * vspace + vspace / 2 + pad * 2;
  const anchor = { x: pad + hwidth / 2, y: pad + vspace / 2 };
  return (
    <div style={{
      position: 'fixed',
      left: mouse.x - w / 2,
      top:  mouse.y - h / 2,
      pointerEvents: 'none',
      opacity: 0.78,
      zIndex: 9999,
    }}>
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
        <Tile
          tile={dragState.tile}
          rotation={dragState.rotation || 0}
          anchor={anchor}
          size={hsize}
          showBoundary={false}
          thumbnail
        />
      </svg>
    </div>
  );
}

export default function Editor() {
  const [state, dispatch] = useReducer(reducer, undefined, initialState);
  const [dragState, setDragState] = useState(null);
  const [paletteRotations, setPaletteRotations] = useState({});
  const [mouse, setMouse] = useState({ x: 0, y: 0 });
  const [zoomedCard, setZoomedCard] = useState(null);
  const [showFactionPicker, setShowFactionPicker] = useState(false);
  const boardSvgRef = useRef(null);
  const dispatchRef = useRef(dispatch);
  dispatchRef.current = dispatch;
  const stateRef = useRef(state);
  stateRef.current = state;

  // ───── Card data load ─────
  useEffect(() => {
    let cancel = false;
    loadCardData()
      .then(data => {
        if (!cancel) dispatch({ type: 'SET_CARD_DATA', data });
      })
      .catch(err => {
        console.error('[cards] failed to load card_data.json', err);
      });
    return () => { cancel = true; };
  }, []);

  // ───── Room flow ─────
  useEffect(() => {
    const url = getRoomIdFromURL();
    if (url) {
      dispatch({ type: 'SET_ROOM_ID', roomId: url });
    }
  }, []);

  // ───── Firebase subscription ─────
  useEffect(() => {
    if (!state.roomId || !isFirebaseConfigured()) {
      dispatch({ type: 'SET_SYNC_STATUS', status: 'offline' });
      return;
    }
    dispatch({ type: 'SET_SYNC_STATUS', status: 'connecting' });
    let off = null;
    let cancelled = false;
    (async () => {
      off = await subscribeRoom(state.roomId, (snap) => {
        if (cancelled) return;
        dispatch({ type: 'SET_SYNC_STATUS', status: 'connected' });
        const owner = stateRef.current.localPlayer;
        const hydrated = owner ? hydrateFromShared(snap, owner, state.roomId) : snap;
        // Merge only the slices we sync; never blow away local-only UI state.
        const patch = {
          placed:   hydrated.placed   ?? stateRef.current.placed,
          terrain:  hydrated.terrain  ?? stateRef.current.terrain,
          ships:    hydrated.ships    ?? stateRef.current.ships,
          locked:   hydrated.locked   ?? stateRef.current.locked,
          playArea: hydrated.playArea ?? stateRef.current.playArea,
          rolls:    hydrated.rolls    ?? stateRef.current.rolls,
          gameOver: hydrated.gameOver ?? stateRef.current.gameOver,
          players:  hydrated.players  ?? stateRef.current.players,
          zones:    {
            ...stateRef.current.zones,
            ...(hydrated.zones || {}),
            // Never let inbound clobber our own deck (we hold authoritative
            // order locally; restored in hydrateFromShared).
            [owner]: hydrated.zones?.[owner] || stateRef.current.zones[owner],
          },
        };
        dispatch({ type: 'APPLY_REMOTE_PATCH', patch });
      }, (err) => {
        console.warn('[sync] error', err);
        dispatch({ type: 'SET_SYNC_STATUS', status: 'error' });
      });
    })();
    return () => {
      cancelled = true;
      if (off) off();
    };
  }, [state.roomId]);

  // ───── Patch-write to firebase on every relevant state mutation ─────
  // Skips when there's no room or no local player. Debounced via microtask.
  const lastPublishedRef = useRef(null);
  useEffect(() => {
    if (!state.roomId || !state.localPlayer || !isFirebaseConfigured()) return;
    const patch = buildSharedPatch(state, state.localPlayer);
    const sig = JSON.stringify(patch);
    if (sig === lastPublishedRef.current) return;
    lastPublishedRef.current = sig;
    writePatch(state.roomId, patch).catch(err => {
      console.warn('[sync] write failed', err);
    });
  }, [
    state.roomId, state.localPlayer,
    state.placed, state.terrain, state.ships, state.locked,
    state.playArea, state.rolls, state.gameOver, state.players,
    state.zones,
  ]);

  // ───── Faction picker logic ─────
  useEffect(() => {
    if (!state.cardData) return;
    if (state.localPlayer) {
      setShowFactionPicker(false);
      return;
    }
    // Auto-open the picker as soon as we have card data (room or no room).
    setShowFactionPicker(true);
  }, [state.cardData, state.localPlayer]);

  const claimedFactions = [
    state.players?.p1?.faction,
    state.players?.p2?.faction,
  ].filter(Boolean);

  const handlePickFaction = useCallback(async (faction) => {
    if (!state.cardData) return;
    const clientId = getClientId();
    let slot = null;

    if (state.roomId && isFirebaseConfigured()) {
      // Try p1 first, then p2.
      for (const candidate of ['p1', 'p2']) {
        const cur = state.players?.[candidate];
        if (cur && cur.clientId && cur.clientId !== clientId) continue;
        if (cur && cur.faction && cur.faction !== faction && cur.clientId !== clientId) continue;
        const res = await claimSlot(state.roomId, candidate, { clientId, faction });
        if (res.ok) { slot = candidate; break; }
      }
      if (!slot) {
        alert('Both player slots are taken or that faction is already claimed.');
        return;
      }
    } else {
      // Solo / no firebase — pick the first slot whose faction matches or is empty.
      for (const candidate of ['p1', 'p2']) {
        const cur = state.players?.[candidate];
        if (!cur || !cur.faction) { slot = candidate; break; }
        if (cur.faction === faction) { slot = candidate; break; }
      }
      slot = slot || 'p1';
      dispatch({
        type: 'SET_PLAYER',
        player: slot,
        clientId,
        faction,
      });
    }

    // Build the deck locally.
    const { cards, cardMap } = buildDeck(state.cardData, faction, slot);
    if (state.roomId) {
      mergeCardMap(state.roomId, cardMap);
      saveDeckOrder(state.roomId, slot, cards);
    }
    dispatch({ type: 'SET_PLAYER', player: slot, clientId, faction });
    dispatch({ type: 'SET_DECK', player: slot, deck: cards });
    dispatch({ type: 'SET_LOCAL_PLAYER', player: slot });
    setShowFactionPicker(false);
  }, [state.cardData, state.roomId, state.players]);

  // Track mouse globally during tile drag.
  useEffect(() => {
    if (!dragState) return;
    const onMove = (e) => setMouse({ x: e.clientX, y: e.clientY });
    window.addEventListener('pointermove', onMove);
    return () => window.removeEventListener('pointermove', onMove);
  }, [dragState]);

  // Q/E rotates selected tile (only when unlocked + no card UI focus).
  useEffect(() => {
    if (state.locked || !state.selectedTileInstanceId) return;
    const onKey = (e) => {
      const tag = e.target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.key === 'q' || e.key === 'Q' || e.key === 'e' || e.key === 'E') {
        dispatch({ type: 'ROTATE_TILE', instanceId: state.selectedTileInstanceId });
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        dispatch({ type: 'REMOVE_TILE', instanceId: state.selectedTileInstanceId });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [state.locked, state.selectedTileInstanceId]);

  const startPaletteDrag = (e, paletteIdx, rotation) => {
    e.preventDefault();
    setMouse({ x: e.clientX, y: e.clientY });
    setDragState({
      source: 'palette',
      paletteIdx,
      tile: state.palette[paletteIdx],
      rotation,
    });
  };

  const togglePaletteRotation = (tileId) => {
    setPaletteRotations(r => ({ ...r, [tileId]: (r[tileId] || 0) === 0 ? 180 : 0 }));
  };

  const regenerateTile = (idx) => {
    dispatch({ type: 'REGENERATE_TILE', paletteIdx: idx });
  };

  const selectedEntry = state.selectedTileInstanceId
    ? state.placed.find(p => p.instanceId === state.selectedTileInstanceId)
    : null;

  const onSelectedRotate = () => {
    if (state.selectedTileInstanceId)
      dispatch({ type: 'ROTATE_TILE', instanceId: state.selectedTileInstanceId });
  };
  const onSelectedClone = () => {
    if (state.selectedTileInstanceId)
      dispatch({ type: 'CLONE_TILE', instanceId: state.selectedTileInstanceId });
  };
  const onSelectedRemove = () => {
    if (state.selectedTileInstanceId)
      dispatch({ type: 'REMOVE_TILE', instanceId: state.selectedTileInstanceId });
  };

  const paintMode = state.mode === 'paint';
  const cardsActive = state.locked && !!state.localPlayer && !!state.cardData;

  // Right-side drawer (zones + ship rules). Collapsed by default once the
  // map is locked so the board / play-area split can breathe; the player
  // can toggle it back open with the edge tab.
  const [rightDrawerOpen, setRightDrawerOpen] = useState(true);
  useEffect(() => {
    setRightDrawerOpen(!state.locked);
  }, [state.locked]);

  // Toolbar callbacks for room flow
  const onCreateRoom = () => {
    const id = makeRoomId();
    setRoomURL(id);
    dispatch({ type: 'SET_ROOM_ID', roomId: id });
  };
  const onLeaveRoom = () => {
    setRoomURL(null);
    dispatch({ type: 'SET_ROOM_ID', roomId: null });
    dispatch({ type: 'SET_SYNC_STATUS', status: 'offline' });
  };
  const onEndGame = () => {
    if (confirm('End the game and freeze the room?')) {
      dispatch({ type: 'END_GAME' });
    }
  };
  const onSwitchPlayer = () => {
    // Solo debug toggle: act as the other side. Useful before networking is up.
    const next = state.localPlayer === 'p1' ? 'p2' : 'p1';
    if (!state.players?.[next]?.faction) {
      // No faction yet for that slot — open the picker for it.
      dispatch({ type: 'SET_LOCAL_PLAYER', player: null });
      setShowFactionPicker(true);
      return;
    }
    dispatch({ type: 'SET_LOCAL_PLAYER', player: next });
  };

  return (
    <div className="min-h-screen w-full bg-slate-950 text-slate-100 flex flex-col font-sans">
      <PaletteDefsSvg />
      <Toolbar
        state={state}
        dispatch={dispatch}
        onCreateRoom={onCreateRoom}
        onLeaveRoom={onLeaveRoom}
        onEndGame={onEndGame}
        onSwitchPlayer={onSwitchPlayer}
        onPickFaction={() => setShowFactionPicker(true)}
      />

      <div className={`flex-1 flex gap-3 p-3 overflow-hidden ${cardsActive ? 'pb-[110px]' : ''}`}>
        {/* Palette sidebar — only meaningful while editing (unlocked) */}
        {(() => {
          const sidebarOpen = !state.locked;
          return (
            <div
              className={`flex-shrink-0 flex flex-col overflow-hidden transition-all duration-300 ease-in-out ${
                sidebarOpen ? 'w-72 opacity-100' : 'w-0 opacity-0 -translate-x-2'
              }`}
              aria-hidden={!sidebarOpen}
            >
              <div className="w-72 flex-1 min-h-0 flex flex-col gap-3">
                {paintMode ? (
                  <TerrainPalette state={state} dispatch={dispatch} />
                ) : (
                  <TilePalette
                    palette={state.palette}
                    rotations={paletteRotations}
                    onStartDrag={startPaletteDrag}
                    onRegenerateTile={regenerateTile}
                    onRotatePreview={togglePaletteRotation}
                  />
                )}
              </div>
            </div>
          );
        })()}

        {/* Main column: board (and play-area, in locked mode) over reserve / hints */}
        <div className="flex-1 flex flex-col gap-3 min-w-0">
          {/* Board / play-area row. In locked mode this becomes a split:
              the board takes the left half of the visible table, and the
              play area takes the right half. Both feel like surfaces the
              player navigates with the same camera. */}
          <div className="flex-1 flex gap-3 min-h-0 min-w-0">
            {/* Left side: board on top, ship reserve below the board */}
            <div className="flex-1 min-w-0 flex flex-col gap-3">
              <div className="flex-1 min-w-0 flex justify-center overflow-auto">
                {paintMode ? (
                  <TerrainBoard state={state} dispatch={dispatch} svgRef={boardSvgRef} />
                ) : (
                  <Board
                    state={state}
                    dispatch={dispatch}
                    dragState={dragState}
                    setDragState={setDragState}
                    svgRef={boardSvgRef}
                  />
                )}
              </div>
              {(!paintMode || state.locked) && (
                <ShipReserve state={state} dispatch={dispatch} boardSvgRef={boardSvgRef} />
              )}
            </div>
            {cardsActive && (
              <div className="flex-1 min-w-0">
                <PlayArea state={state} dispatch={dispatch} onZoom={setZoomedCard} />
              </div>
            )}
          </div>

          {/* Selected tile actions (tile mode only) */}
          {!paintMode && selectedEntry && !state.locked && (
            <div className="bg-slate-900/90 ring-1 ring-slate-800 rounded-lg p-2 flex items-center gap-2">
              <span className="text-xs text-slate-400 mr-2">
                Tile @ ({selectedEntry.col},{selectedEntry.row}) · {selectedEntry.tile.category}
                {selectedEntry.rotation === 180 ? ' · rotated 180°' : ''}
              </span>
              <button onClick={onSelectedRotate} className="px-2 py-1 text-xs rounded bg-slate-800 hover:bg-slate-700 text-slate-100">Rotate 180°</button>
              <button onClick={onSelectedClone}  className="px-2 py-1 text-xs rounded bg-slate-800 hover:bg-slate-700 text-slate-100">Clone</button>
              <button onClick={onSelectedRemove} className="px-2 py-1 text-xs rounded bg-red-900 hover:bg-red-800 text-red-100">Remove</button>
            </div>
          )}

          <div className="text-[11px] text-slate-500 flex items-center gap-4 px-1 pb-1">
            {paintMode && state.locked ? (
              <span>Paint mode · locked · click ships · Q/E rotate · F flip suppressed · Del returns to reserve · wheel zoom · right-drag pan · 0 reset</span>
            ) : paintMode ? (
              <span>
                Paint mode · brush: <span className="text-slate-300">{state.activeBrush}</span>
                {' '}· click + drag to paint · lock the map to deploy ships
              </span>
            ) : state.locked ? (
              <span>Locked · click ships · Q/E rotate · F flip suppressed · Del returns to reserve · wheel zoom · right-drag pan · 0 reset · drag cards onto the play area · hover a card to read it · 1/2/3 select · Z zoom</span>
            ) : (
              <span>Editing · drag tiles to any hex · cursor follows tile · Q/E rotate · Del removes</span>
            )}
          </div>
        </div>

        {/* Right-side drawer: zones + rules + roll log, collapsible. */}
        <div className="relative flex-shrink-0 flex items-stretch">
          <button
            onClick={() => setRightDrawerOpen(o => !o)}
            className="absolute top-1/2 -translate-y-1/2 -left-3 z-10 w-3 h-16 rounded-l-md bg-slate-800/90 hover:bg-slate-700 ring-1 ring-slate-700 text-slate-300 text-[10px] flex items-center justify-center"
            aria-label={rightDrawerOpen ? 'Collapse panel' : 'Expand panel'}
            title={rightDrawerOpen ? 'Collapse' : 'Expand'}
          >
            {rightDrawerOpen ? '›' : '‹'}
          </button>
          <div
            className={`flex flex-col gap-2 overflow-hidden transition-all duration-300 ease-in-out ${
              rightDrawerOpen ? 'w-72 opacity-100' : 'w-0 opacity-0 translate-x-2'
            }`}
            aria-hidden={!rightDrawerOpen}
          >
            <div className="w-72 flex flex-col gap-2">
              {cardsActive && (
                <ZonePanel state={state} dispatch={dispatch} />
              )}
              <ShipRulesPanel state={state} dispatch={dispatch} />
            </div>
          </div>
        </div>
      </div>

      {/* Floating hand — fixed at bottom of viewport, peeks above the table */}
      {cardsActive && (
        <Hand state={state} dispatch={dispatch} onZoom={setZoomedCard} />
      )}

      {!paintMode && <PaletteDragGhost dragState={dragState} mouse={mouse} />}

      {zoomedCard && (
        <CardModal
          card={zoomedCard}
          cardData={state.cardData}
          onClose={() => setZoomedCard(null)}
        />
      )}

      {showFactionPicker && state.cardData && (
        <FactionPicker
          cardData={state.cardData}
          claimedFactions={claimedFactions}
          onPick={handlePickFaction}
          onCancel={() => setShowFactionPicker(false)}
          title={state.roomId ? `Choose a faction · room ${state.roomId}` : 'Choose a faction'}
        />
      )}

      {state.gameOver && (
        <div className="fixed inset-0 z-[110] bg-slate-950/85 flex items-center justify-center">
          <div className="bg-slate-900 ring-1 ring-slate-700 rounded-xl p-8 text-center">
            <div className="text-2xl font-semibold text-slate-100 mb-2">Game over</div>
            <div className="text-sm text-slate-400 mb-4">The room is frozen.</div>
            <button
              onClick={() => dispatch({ type: 'RESUME_GAME' })}
              className="px-4 py-2 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-100 text-sm"
            >Resume</button>
          </div>
        </div>
      )}
    </div>
  );
}
