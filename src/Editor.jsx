// Top-level editor: composes toolbar + palette + board + ship reserve.
// Owns the cross-component drag state for tile placement.
import React, { useReducer, useState, useRef, useEffect } from 'react';
import { reducer, initialState } from './state/store.js';
import Toolbar from './ui/Toolbar.jsx';
import TilePalette, { PaletteDefsSvg } from './tiles/TilePalette.jsx';
import TerrainPalette from './tiles/TerrainPalette.jsx';
import Board from './board/Board.jsx';
import TerrainBoard from './board/TerrainBoard.jsx';
import Tile from './tiles/Tile.jsx';
import ShipReserve from './ships/ShipReserve.jsx';

// Small ghost following the cursor — only useful for palette drags before
// the cursor enters the board (placed-tile drags fade the source tile and
// the snap preview shows the destination).
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
  // dragState = { source: 'palette'|'placed', paletteIdx?|instanceId?, tile, rotation, grabOffset? }
  const [paletteRotations, setPaletteRotations] = useState({});
  const [mouse, setMouse] = useState({ x: 0, y: 0 });
  const boardSvgRef = useRef(null);

  // Track mouse globally during drag (used by the cursor ghost).
  useEffect(() => {
    if (!dragState) return;
    const onMove = (e) => setMouse({ x: e.clientX, y: e.clientY });
    window.addEventListener('pointermove', onMove);
    return () => window.removeEventListener('pointermove', onMove);
  }, [dragState]);

  // Q/E rotates the selected tile 180° (only when unlocked).
  // When locked, ShipLayer owns Q/E for ship facings.
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

  return (
    <div className="min-h-screen w-full bg-slate-950 text-slate-100 flex flex-col font-sans">
      <PaletteDefsSvg />
      <Toolbar state={state} dispatch={dispatch} />

      <div className="flex-1 flex gap-3 p-3 overflow-hidden">
        {/* Palette sidebar */}
        <div className="w-72 flex-shrink-0 flex flex-col gap-3">
          <div className="flex-1 min-h-0">
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

        {/* Board area */}
        <div className="flex-1 flex flex-col gap-3 min-w-0">
          <div className="flex-1 flex justify-center overflow-auto">
            {paintMode ? (
              <TerrainBoard state={state} dispatch={dispatch} />
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

          {/* Selected tile actions (tile mode only) */}
          {!paintMode && selectedEntry && !state.locked && (
            <div className="bg-slate-900/90 ring-1 ring-slate-800 rounded-lg p-2 flex items-center gap-2">
              <span className="text-xs text-slate-400 mr-2">
                Tile @ ({selectedEntry.col},{selectedEntry.row}) · {selectedEntry.tile.category}
                {selectedEntry.rotation === 180 ? ' · rotated 180°' : ''}
              </span>
              <button
                onClick={onSelectedRotate}
                className="px-2 py-1 text-xs rounded bg-slate-800 hover:bg-slate-700 text-slate-100"
              >Rotate 180°</button>
              <button
                onClick={onSelectedClone}
                className="px-2 py-1 text-xs rounded bg-slate-800 hover:bg-slate-700 text-slate-100"
              >Clone</button>
              <button
                onClick={onSelectedRemove}
                className="px-2 py-1 text-xs rounded bg-red-900 hover:bg-red-800 text-red-100"
              >Remove</button>
            </div>
          )}

          {/* Ship reserve (tile mode only) */}
          {!paintMode && <ShipReserve state={state} dispatch={dispatch} boardSvgRef={boardSvgRef} />}

          {/* Status strip */}
          <div className="text-[11px] text-slate-500 flex items-center gap-4 px-1">
            {paintMode ? (
              <span>
                Paint mode · brush: <span className="text-slate-300">{state.activeBrush}</span>
                {' '}· click + drag to paint · Save & re-load named maps from the sidebar
              </span>
            ) : state.locked ? (
              <span>Locked · click ships · Q/E rotate · Del returns to reserve</span>
            ) : (
              <span>Editing · drag tiles to any hex · cursor follows tile · Q/E rotate · Del removes</span>
            )}
          </div>
        </div>
      </div>

      {!paintMode && <PaletteDragGhost dragState={dragState} mouse={mouse} />}
    </div>
  );
}
