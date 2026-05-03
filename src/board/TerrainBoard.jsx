// Paint-mode board: 90 paintable hexes. Click + drag with active brush to
// paint terrain or toggle forts. Off-tile corner hexes render as out-of-play
// (subtle dashed outline, non-interactive).
import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  hexCenter, hexPoints, isPaintable,
  HEX_SIZE, BOARD_PAD, BOARD_WIDTH_PX, BOARD_HEIGHT_PX,
  GRID_COLS, GRID_ROWS,
} from '../hex/coords.js';
import { TERRAIN_COLORS } from '../tiles/TerrainPalette.jsx';

const BOARD_VIEW_W = BOARD_WIDTH_PX + BOARD_PAD * 2;
const BOARD_VIEW_H = BOARD_HEIGHT_PX + BOARD_PAD * 2;

function FortGlyph({ cx, cy }) {
  // Small crenellated mark: a square base with three battlements.
  const s = 7;
  const x0 = cx - s, y0 = cy - s + 2;
  return (
    <g pointerEvents="none">
      <rect x={x0} y={y0} width={s * 2} height={s * 1.4} fill="#1e293b" stroke="#fbbf24" strokeWidth="0.8" />
      <rect x={x0} y={y0 - 3} width={3} height={3} fill="#1e293b" stroke="#fbbf24" strokeWidth="0.8" />
      <rect x={x0 + s - 1.5} y={y0 - 3} width={3} height={3} fill="#1e293b" stroke="#fbbf24" strokeWidth="0.8" />
      <rect x={x0 + s * 2 - 3} y={y0 - 3} width={3} height={3} fill="#1e293b" stroke="#fbbf24" strokeWidth="0.8" />
    </g>
  );
}

export default function TerrainBoard({ state, dispatch }) {
  const svgRef = useRef(null);
  const [painting, setPainting] = useState(false);
  // Track last painted hex during a drag so we don't dispatch repeats — esp.
  // important for the fort brush which toggles on each apply.
  const lastPaintedRef = useRef(null);

  const paintHex = useCallback((col, row) => {
    const key = `${col},${row}`;
    if (lastPaintedRef.current === key) return;
    lastPaintedRef.current = key;
    dispatch({ type: 'PAINT_HEX', col, row });
  }, [dispatch]);

  // Global pointer-up ends the painting drag.
  useEffect(() => {
    if (!painting) return;
    const onUp = () => { setPainting(false); lastPaintedRef.current = null; };
    window.addEventListener('pointerup', onUp);
    return () => window.removeEventListener('pointerup', onUp);
  }, [painting]);

  const onHexDown = (col, row) => (e) => {
    e.preventDefault();
    e.stopPropagation();
    setPainting(true);
    lastPaintedRef.current = null;
    paintHex(col, row);
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };

  const onHexEnter = (col, row) => () => {
    if (!painting) return;
    paintHex(col, row);
  };

  const hexes = [];
  for (let r = 0; r < GRID_ROWS; r++) {
    for (let c = 0; c < GRID_COLS; c++) {
      const { x, y } = hexCenter(c, r);
      const playable = isPaintable(c, r);
      if (!playable) {
        hexes.push(
          <polygon
            key={`off-${c}-${r}`}
            points={hexPoints(x, y, HEX_SIZE - 2)}
            fill="none"
            stroke="#1e293b"
            strokeWidth="0.5"
            strokeDasharray="2 3"
            opacity="0.35"
            pointerEvents="none"
          />
        );
        continue;
      }
      const key = `${c},${r}`;
      const t = state.terrain[key];
      const type = t?.type || 'open';
      const fort = !!t?.fort;
      const fill = TERRAIN_COLORS[type] || TERRAIN_COLORS.open;
      const stroke = type === 'open' ? '#1e3a5f' : '#0a1726';
      hexes.push(
        <g key={`hex-${c}-${r}`}>
          <polygon
            points={hexPoints(x, y, HEX_SIZE - 1)}
            fill={fill}
            stroke={stroke}
            strokeWidth="0.8"
            onPointerDown={onHexDown(c, r)}
            onPointerEnter={onHexEnter(c, r)}
            style={{ cursor: 'crosshair', touchAction: 'none' }}
          />
          {type === 'fog' && (
            <polygon
              points={hexPoints(x, y, HEX_SIZE - 4)}
              fill="url(#fogPattern)"
              pointerEvents="none"
            />
          )}
          {fort && <FortGlyph cx={x} cy={y} />}
        </g>
      );
    }
  }

  return (
    <div className="relative bg-slate-950 rounded-lg ring-1 ring-slate-800 p-2">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${BOARD_VIEW_W} ${BOARD_VIEW_H}`}
        width={BOARD_VIEW_W}
        height={BOARD_VIEW_H}
        style={{ display: 'block', maxWidth: '100%', height: 'auto', touchAction: 'none' }}
      >
        <defs>
          <pattern id="fogPattern" patternUnits="userSpaceOnUse" width="6" height="6"
                   patternTransform="rotate(45)">
            <rect width="6" height="6" fill="rgba(241,245,249,0)" />
            <line x1="0" y1="3" x2="6" y2="3" stroke="rgba(241,245,249,0.45)" strokeWidth="1.5" />
          </pattern>
        </defs>
        <rect x={0} y={0} width={BOARD_VIEW_W} height={BOARD_VIEW_H} fill="#0a1726" />
        {hexes}
      </svg>
    </div>
  );
}
