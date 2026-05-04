// Renders placed ships on the board, handles select/drag/rotate/firing arcs.
// Active only when state.locked === true (tile layer is inert).
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  hexCenter, hexPoints, nearestHex, hexDistance, hexLineSteps, HEX_SIZE,
  GRID_COLS, GRID_ROWS,
} from '../hex/coords.js';
import {
  isShipPlaceable, LOS_BLOCKING_TERRAIN, TARGET_EXCLUDE_TERRAIN,
} from '../state/store.js';

const ARC_RANGE = 4;

export const TOKEN_SIZE = HEX_SIZE * 0.72;

export const FACTION = {
  blue: { fill: '#1c3a5e', stroke: '#0a1a2e', accent: '#dbe6f3', text: '#f4f7fb' },
  red:  { fill: '#9a2a2c', stroke: '#511518', accent: '#f3e6d4', text: '#fbf0e0' },
};

const ARC_FILL_BROADSIDE = 'rgba(245, 158, 11, 0.42)';
const ARC_FILL_FOREAFT   = 'rgba(180,  83,  9, 0.52)';
const SELECT_OUTLINE = '#fbbf24';

// Sub-hex slot positions when multiple ships share a hex.
const SLOT_DIRS = [
  { dx: -1, dy: -1 }, { dx: 1, dy: -1 },
  { dx: -1, dy:  1 }, { dx: 1, dy:  1 },
];

function inHexPosition(col, row, slot, total) {
  const c = hexCenter(col, row);
  if (total <= 1) return c;
  const off = TOKEN_SIZE / 2 + 2;
  const d = SLOT_DIRS[slot] || SLOT_DIRS[0];
  return { x: c.x + d.dx * off, y: c.y + d.dy * off };
}

// Inset of the X firing-arc lines from the token corners.
const X_INSET = 2.5;

// Render a single ship token. Square body, corner-to-corner X dividing it into
// 4 firing-arc quadrants (top=fore, bottom=aft, left/right=broadsides), bow
// chevron in the top quadrant, large class+number label centered. When
// `ship.suppressed` is true a translucent dark overlay is drawn on top.
export function ShipToken({ ship, x, y, selected, ghosted, onPointerDown, locked, mini }) {
  const s = FACTION[ship.faction];
  const size = mini ? TOKEN_SIZE * 0.85 : TOKEN_SIZE;
  const half = size / 2;
  const labelW = size * 0.58;
  const labelH = size * 0.42;
  const chevX = size * 0.18;
  const chevTopY = -half + size * 0.06;
  const chevBaseY = -half + size * 0.22;
  return (
    <g
      transform={`translate(${x.toFixed(2)},${y.toFixed(2)})`}
      onPointerDown={onPointerDown}
      style={{
        cursor: locked ? (ghosted ? 'grabbing' : 'grab') : 'default',
        opacity: ghosted ? 0.55 : 1,
        pointerEvents: locked ? 'auto' : 'none',
      }}
    >
      {/* Drop shadow */}
      {!mini && (
        <rect
          x={-half + 1.2} y={-half + 1.8}
          width={size} height={size}
          rx="2"
          fill="rgba(8, 12, 20, 0.55)"
        />
      )}
      <g transform={`rotate(${ship.facing})`}>
        {/* Body */}
        <rect
          x={-half} y={-half}
          width={size} height={size}
          rx="2"
          fill={s.fill}
          stroke={selected ? SELECT_OUTLINE : s.stroke}
          strokeWidth={selected ? 2.4 : 1.2}
        />
        {/* X firing arcs — corner to corner, divides token into top/right/bottom/left quadrants */}
        <line
          x1={-half + X_INSET} y1={-half + X_INSET}
          x2={half - X_INSET}  y2={half - X_INSET}
          stroke={s.accent} strokeWidth={0.9} opacity={0.55}
        />
        <line
          x1={half - X_INSET}  y1={-half + X_INSET}
          x2={-half + X_INSET} y2={half - X_INSET}
          stroke={s.accent} strokeWidth={0.9} opacity={0.55}
        />
        {/* Bow chevron in the top (fore) quadrant */}
        <polygon
          points={`0,${chevTopY.toFixed(2)} ${(-chevX).toFixed(2)},${chevBaseY.toFixed(2)} ${chevX.toFixed(2)},${chevBaseY.toFixed(2)}`}
          fill={s.accent}
          stroke={s.stroke}
          strokeWidth={0.5}
        />
        {/* Counter-rotated label so text reads upright at any facing */}
        <g transform={`rotate(${-ship.facing})`}>
          <rect
            x={-labelW / 2} y={-labelH / 2 + 1.5}
            width={labelW} height={labelH}
            rx="1.5"
            fill={s.fill}
            stroke={s.stroke}
            strokeWidth={0.4}
            opacity={0.95}
          />
          <text
            x="0" y={2}
            fontSize={size * 0.42}
            fontFamily="ui-sans-serif, system-ui, sans-serif"
            fontWeight={700}
            fill={s.text}
            textAnchor="middle"
            dominantBaseline="middle"
            style={{ userSelect: 'none', pointerEvents: 'none' }}
          >
            {ship.label || ship.id}
          </text>
        </g>
      </g>
      {/* Suppression overlay — flipped to "shaded" side */}
      {ship.suppressed && (
        <>
          <rect
            x={-half} y={-half}
            width={size} height={size}
            rx="2"
            fill="rgba(8, 10, 18, 0.55)"
            pointerEvents="none"
          />
          <text
            x={half - 2} y={half - 2}
            fontSize={size * 0.22}
            fontFamily="ui-sans-serif, system-ui, sans-serif"
            fontWeight={700}
            fill="#fde68a"
            textAnchor="end"
            dominantBaseline="alphabetic"
            style={{ userSelect: 'none', pointerEvents: 'none' }}
          >
            SUP
          </text>
        </>
      )}
    </g>
  );
}

// LoS reaches target iff every intermediate hex along the line is clear of
// blocking terrain. The target hex itself is not checked here — fog targets
// must remain visible per the "first fog hex is targetable" rule, while
// island/coastline targets are filtered upstream via TARGET_EXCLUDE_TERRAIN.
function losReaches(terrain, c1, r1, c2, r2) {
  if (c1 === c2 && r1 === r2) return true;
  const steps = hexLineSteps(c1, r1, c2, r2);
  for (let i = 1; i < steps.length - 1; i++) {
    for (const h of steps[i]) {
      const t = terrain[`${h.col},${h.row}`];
      if (t && LOS_BLOCKING_TERRAIN.has(t.type)) return false;
    }
  }
  return true;
}

function FiringArcs({ ship, terrain }) {
  if (ship.col === null) return null;
  const shipPx = hexCenter(ship.col, ship.row);
  const bow = ship.facing;
  const EPS = 0.5;
  const foreAft = [];
  const broadside = [];
  for (let r = 0; r < GRID_ROWS; r++) {
    for (let c = 0; c < GRID_COLS; c++) {
      if (c === ship.col && r === ship.row) continue;
      if (hexDistance(ship.col, ship.row, c, r) > ARC_RANGE) continue;
      const tt = terrain[`${c},${r}`];
      if (tt && TARGET_EXCLUDE_TERRAIN.has(tt.type)) continue;
      const px = hexCenter(c, r);
      const dx = px.x - shipPx.x;
      const dy = px.y - shipPx.y;
      let angle = Math.atan2(dx, -dy) * 180 / Math.PI;
      angle = (angle + 360) % 360;
      const rel = (angle - bow + 360) % 360;
      let bucket = null;
      if (rel < EPS || rel > 360 - EPS || Math.abs(rel - 180) < EPS) {
        bucket = foreAft;
      } else if ((rel >= 60 - EPS && rel <= 120 + EPS) ||
                 (rel >= 240 - EPS && rel <= 300 + EPS)) {
        bucket = broadside;
      }
      if (!bucket) continue;
      if (!losReaches(terrain, ship.col, ship.row, c, r)) continue;
      bucket.push({ col: c, row: r });
    }
  }
  const fillHex = (col, row, fill, key) => {
    const { x, y } = hexCenter(col, row);
    return <polygon key={key} points={hexPoints(x, y, HEX_SIZE - 1)} fill={fill} />;
  };
  return (
    <g pointerEvents="none">
      {broadside.map(({ col, row }) =>
        fillHex(col, row, ARC_FILL_BROADSIDE, `bs-${col}-${row}`))}
      {foreAft.map(({ col, row }) =>
        fillHex(col, row, ARC_FILL_FOREAFT, `fa-${col}-${row}`))}
    </g>
  );
}

export default function ShipLayer({ state, dispatch, toSvgPoint, svgRef }) {
  const { ships, selectedShipId, locked, terrain } = state;
  const terrainMap = terrain || {};
  const [drag, setDrag] = useState(null);
  // drag = { id, startX, startY, currentX, currentY, didMove }

  // Placed ships only.
  const placedShips = useMemo(() => ships.filter(s => s.col !== null), [ships]);

  // Group by hex for slot assignment.
  const layout = useMemo(() => {
    const byHex = new Map();
    placedShips.forEach(s => {
      const k = `${s.col},${s.row}`;
      if (!byHex.has(k)) byHex.set(k, []);
      byHex.get(k).push(s);
    });
    const positions = {};
    byHex.forEach(group => {
      group.sort((a, b) => a.id.localeCompare(b.id));
      group.forEach((s, idx) => {
        positions[s.id] = inHexPosition(s.col, s.row, idx, group.length);
      });
    });
    return positions;
  }, [placedShips]);

  // Drag wiring
  useEffect(() => {
    if (!drag) return;
    const onMove = (e) => {
      const pt = toSvgPoint(e.clientX, e.clientY);
      setDrag(d => {
        if (!d) return d;
        const moved = d.didMove || Math.hypot(pt.x - d.startX, pt.y - d.startY) > 4;
        return { ...d, currentX: pt.x, currentY: pt.y, didMove: moved };
      });
    };
    const onUp = (e) => {
      const pt = toSvgPoint(e.clientX, e.clientY);
      setDrag(d => {
        if (!d) return null;
        if (!d.didMove) {
          dispatch({ type: 'SELECT_SHIP', id: d.id });
          return null;
        }
        // Out of board → return to reserve
        const svg = svgRef.current;
        const rect = svg?.getBoundingClientRect();
        const inside = rect && e.clientX >= rect.left && e.clientX <= rect.right
                              && e.clientY >= rect.top && e.clientY <= rect.bottom;
        if (!inside) {
          dispatch({ type: 'RETURN_SHIP_TO_RESERVE', id: d.id });
          return null;
        }
        const hex = nearestHex(pt.x, pt.y);
        if (hex) {
          const occupants = ships.filter(s =>
            s.col === hex.col && s.row === hex.row && s.id !== d.id).length;
          if (occupants < 4 && isShipPlaceable(terrainMap, hex.col, hex.row)) {
            dispatch({ type: 'PLACE_SHIP', id: d.id, col: hex.col, row: hex.row });
          }
        }
        return null;
      });
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [drag, ships, dispatch, toSvgPoint, svgRef, terrainMap]);

  // Q/E rotation hotkeys
  useEffect(() => {
    if (!locked || !selectedShipId) return;
    const onKey = (e) => {
      const tag = e.target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.key === 'q' || e.key === 'Q') {
        dispatch({ type: 'ROTATE_SHIP', id: selectedShipId, delta: -60 });
      } else if (e.key === 'e' || e.key === 'E') {
        dispatch({ type: 'ROTATE_SHIP', id: selectedShipId, delta: +60 });
      } else if (e.key === 'f' || e.key === 'F') {
        dispatch({ type: 'TOGGLE_SUPPRESSED', id: selectedShipId });
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        dispatch({ type: 'RETURN_SHIP_TO_RESERVE', id: selectedShipId });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [locked, selectedShipId, dispatch]);

  const selectedShip = ships.find(s => s.id === selectedShipId);
  const showArcs = locked && selectedShip && selectedShip.col !== null;

  const positionFor = (ship) => {
    if (drag && drag.id === ship.id && drag.didMove) {
      return { x: drag.currentX, y: drag.currentY };
    }
    return layout[ship.id];
  };

  const dragHover = useMemo(() => {
    if (!drag || !drag.didMove) return null;
    const hex = nearestHex(drag.currentX, drag.currentY);
    if (!hex) return null;
    const others = ships.filter(s =>
      s.col === hex.col && s.row === hex.row && s.id !== drag.id);
    const placeable = isShipPlaceable(terrainMap, hex.col, hex.row);
    return { col: hex.col, row: hex.row, valid: others.length < 4 && placeable };
  }, [drag, ships, terrainMap]);

  return (
    <g>
      {showArcs && <FiringArcs ship={selectedShip} terrain={terrainMap} />}
      {dragHover && (() => {
        const c = hexCenter(dragHover.col, dragHover.row);
        return (
          <polygon
            points={hexPoints(c.x, c.y, HEX_SIZE - 2)}
            fill={dragHover.valid ? 'rgba(34, 197, 94, 0.18)' : 'rgba(239, 68, 68, 0.20)'}
            stroke={dragHover.valid ? '#22c55e' : '#ef4444'}
            strokeWidth="1.6"
            pointerEvents="none"
          />
        );
      })()}
      {placedShips.map(ship => {
        const pos = positionFor(ship);
        if (!pos) return null;
        const isDragging = drag && drag.id === ship.id && drag.didMove;
        return (
          <ShipToken
            key={ship.id}
            ship={ship}
            x={pos.x}
            y={pos.y}
            selected={selectedShipId === ship.id && locked}
            ghosted={isDragging}
            locked={locked}
            onPointerDown={locked ? (e) => {
              e.stopPropagation();
              const pt = toSvgPoint(e.clientX, e.clientY);
              setDrag({
                id: ship.id,
                startX: pt.x, startY: pt.y,
                currentX: pt.x, currentY: pt.y,
                didMove: false,
              });
            } : undefined}
          />
        );
      })}
    </g>
  );
}
