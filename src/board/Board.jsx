// Main editor board. Renders placed tiles + ships. Free-placement model:
// any cursor-anchored hex position is a candidate; snap target is the nearest
// hex to (cursor - grabOffset). Drop is rejected by the reducer if it would
// overlap another tile or fall outside the grid.
import React, { useRef, useEffect, useCallback, useState } from 'react';
import {
  hexCenter, hexPoints, nearestHexUnbounded,
  HEX_SIZE, HEX_HSPACE, HEX_VSPACE, BOARD_PAD,
  BOARD_WIDTH_PX, BOARD_HEIGHT_PX,
  GRID_COLS, GRID_ROWS,
  getTileLayout, tileCentroidOffset, tileFitsInGrid,
} from '../hex/coords.js';
import Tile from '../tiles/Tile.jsx';
import { tileOverlapsAny } from '../state/store.js';
import ShipLayer from '../ships/ShipLayer.jsx';

const BOARD_VIEW_W = BOARD_WIDTH_PX + BOARD_PAD * 2;
const BOARD_VIEW_H = BOARD_HEIGHT_PX + BOARD_PAD * 2;

export default function Board({
  state, dispatch, dragState, setDragState, svgRef: svgRefProp,
}) {
  const internalRef = useRef(null);
  const svgRef = svgRefProp || internalRef;

  const toSvgPoint = useCallback((clientX, clientY) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const pt = svg.createSVGPoint();
    pt.x = clientX; pt.y = clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    const sp = pt.matrixTransform(ctm.inverse());
    return { x: sp.x, y: sp.y };
  }, [svgRef]);

  // Compute the snapped (col, row) anchor for the drag at cursor position.
  // For placed-tile drags we preserve the grab-point offset (cursor stays at
  // the same relative position on the tile). For palette drags we centre the
  // cursor on the tile's centroid (using even-parity centroid as a neutral
  // reference; the snap may land at any col parity).
  const snapAnchor = useCallback((cursorPt) => {
    if (!dragState) return null;
    const rotation = dragState.rotation || 0;
    let targetX, targetY;
    if (dragState.source === 'placed' && dragState.grabOffset) {
      targetX = cursorPt.x - dragState.grabOffset.dx;
      targetY = cursorPt.y - dragState.grabOffset.dy;
    } else {
      const c = tileCentroidOffset(0, rotation);
      targetX = cursorPt.x - c.dx;
      targetY = cursorPt.y - c.dy;
    }
    return nearestHexUnbounded(targetX, targetY);
  }, [dragState]);

  // Validate the snapped placement.
  const validateAnchor = useCallback((anchor) => {
    if (!anchor || !dragState) return false;
    const rotation = dragState.rotation || 0;
    if (!tileFitsInGrid(anchor.col, anchor.row, rotation)) return false;
    const excludeId = dragState.source === 'placed' ? dragState.instanceId : null;
    if (tileOverlapsAny(state.placed, anchor.col, anchor.row, rotation, excludeId)) return false;
    return true;
  }, [dragState, state.placed]);

  // Track the live hover preview (snap target + valid?) during drag.
  const [hover, setHover] = useState(null);
  useEffect(() => {
    if (!dragState) { setHover(null); return; }
    const onMove = (e) => {
      const svg = svgRef.current;
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      const inside = e.clientX >= rect.left && e.clientX <= rect.right
                  && e.clientY >= rect.top  && e.clientY <= rect.bottom;
      if (!inside) { setHover(null); return; }
      const pt = toSvgPoint(e.clientX, e.clientY);
      const anchor = snapAnchor(pt);
      const valid = validateAnchor(anchor);
      setHover({ ...anchor, valid });
    };
    window.addEventListener('pointermove', onMove);
    return () => window.removeEventListener('pointermove', onMove);
  }, [dragState, snapAnchor, validateAnchor, toSvgPoint, svgRef]);

  // Drop.
  useEffect(() => {
    if (!dragState) return;
    const onUp = (e) => {
      const svg = svgRef.current;
      if (!svg) { setDragState(null); return; }
      const rect = svg.getBoundingClientRect();
      const inside = e.clientX >= rect.left && e.clientX <= rect.right
                  && e.clientY >= rect.top  && e.clientY <= rect.bottom;
      if (!inside) {
        // Drop outside → snap back. Use Remove button or Del to delete.
        setDragState(null);
        return;
      }
      const pt = toSvgPoint(e.clientX, e.clientY);
      const anchor = snapAnchor(pt);
      if (!validateAnchor(anchor)) {
        setDragState(null);
        return;
      }
      const rotation = dragState.rotation || 0;
      if (dragState.source === 'palette') {
        dispatch({ type: 'PLACE_TILE',
          paletteIdx: dragState.paletteIdx,
          col: anchor.col, row: anchor.row, rotation });
      } else if (dragState.source === 'placed') {
        dispatch({ type: 'MOVE_TILE',
          instanceId: dragState.instanceId,
          col: anchor.col, row: anchor.row });
      }
      setDragState(null);
    };
    window.addEventListener('pointerup', onUp);
    return () => window.removeEventListener('pointerup', onUp);
  }, [dragState, dispatch, setDragState, toSvgPoint, snapAnchor, validateAnchor, svgRef]);

  // Empty-area click → deselect.
  const onSvgPointerDown = (e) => {
    if (state.locked) return;
    if (e.target === svgRef.current || e.target.dataset?.bgrect === '1') {
      dispatch({ type: 'SELECT_TILE', instanceId: null });
    }
  };

  // Subtle background hex grid (always visible — gives the user a sense of
  // where tiles can land).
  const bgGrid = (() => {
    const out = [];
    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        const { x, y } = hexCenter(c, r);
        out.push(
          <polygon
            key={`bg-${c}-${r}`}
            points={hexPoints(x, y, HEX_SIZE - 1.5)}
            fill="none"
            stroke="#1e3a5f"
            strokeWidth="0.5"
            strokeDasharray="2 3"
            opacity="0.45"
            pointerEvents="none"
          />
        );
      }
    }
    return out;
  })();

  // Hover preview during drag — green if valid, red if invalid.
  // Guarded by dragState too (between drop and the next render hover may
  // still hold a stale value while dragState is already null).
  const hoverPreview = dragState && hover && (() => {
    const rotation = dragState.rotation || 0;
    const layout = getTileLayout(hover.col, rotation);
    const stroke = hover.valid ? '#22c55e' : '#ef4444';
    const fill = hover.valid ? 'rgba(34,197,94,0.18)' : 'rgba(239,68,68,0.20)';
    return layout.slots.map(({ slot, boxCol, boxRow }) => {
      const c = hexCenter(hover.col + boxCol, hover.row + boxRow);
      return (
        <polygon
          key={`prev-${slot}`}
          points={hexPoints(c.x, c.y, HEX_SIZE - 1.5)}
          fill={fill}
          stroke={stroke}
          strokeWidth="1.8"
          opacity="0.95"
          pointerEvents="none"
        />
      );
    });
  })();

  // Placed tiles.
  const placedTiles = state.placed.map(entry => {
    const anchor = hexCenter(entry.col, entry.row);
    const isSelected = state.selectedTileInstanceId === entry.instanceId;
    const isBeingDragged = dragState?.source === 'placed'
                        && dragState.instanceId === entry.instanceId;
    return (
      <Tile
        key={entry.instanceId}
        tile={entry.tile}
        rotation={entry.rotation}
        anchor={anchor}
        originCol={entry.col}
        size={HEX_SIZE}
        showBoundary={!state.locked}
        selected={!state.locked && isSelected}
        faded={isBeingDragged}
        onPointerDown={state.locked ? undefined : (e) => {
          e.stopPropagation();
          dispatch({ type: 'SELECT_TILE', instanceId: entry.instanceId });
          const pt = toSvgPoint(e.clientX, e.clientY);
          // Record where on the tile the user grabbed (offset from anchor).
          setDragState({
            source: 'placed',
            instanceId: entry.instanceId,
            tile: entry.tile,
            rotation: entry.rotation,
            grabOffset: { dx: pt.x - anchor.x, dy: pt.y - anchor.y },
          });
        }}
      />
    );
  });

  return (
    <div className="relative bg-slate-950 rounded-lg ring-1 ring-slate-800 p-2">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${BOARD_VIEW_W} ${BOARD_VIEW_H}`}
        width={BOARD_VIEW_W}
        height={BOARD_VIEW_H}
        onPointerDown={onSvgPointerDown}
        style={{ display: 'block', maxWidth: '100%', height: 'auto', touchAction: 'none' }}
      >
        <rect
          x={0} y={0} width={BOARD_VIEW_W} height={BOARD_VIEW_H}
          fill="#0a1726" data-bgrect="1"
        />
        {bgGrid}
        {placedTiles}
        {hoverPreview}
        <ShipLayer
          state={state}
          dispatch={dispatch}
          toSvgPoint={toSvgPoint}
          svgRef={svgRef}
        />
      </svg>
    </div>
  );
}

export { BOARD_VIEW_W, BOARD_VIEW_H };
