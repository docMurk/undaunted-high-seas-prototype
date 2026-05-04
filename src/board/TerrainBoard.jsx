// Paint-mode board: 90 paintable hexes. Click + drag with active brush to
// paint terrain or toggle forts. When locked, painting is suspended and the
// ShipLayer takes over for ship deployment / interaction (mirrors tile mode).
import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  hexCenter, hexPoints,
  HEX_SIZE, BOARD_PAD, BOARD_WIDTH_PX, BOARD_HEIGHT_PX,
  GRID_COLS, GRID_ROWS,
} from '../hex/coords.js';
import { TERRAIN_COLORS } from '../tiles/TerrainPalette.jsx';
import ShipLayer from '../ships/ShipLayer.jsx';
import { useZoomPan } from './useZoomPan.js';

const BOARD_VIEW_W = BOARD_WIDTH_PX + BOARD_PAD * 2;
const BOARD_VIEW_H = BOARD_HEIGHT_PX + BOARD_PAD * 2;

function FortGlyph({ cx, cy }) {
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

export default function TerrainBoard({ state, dispatch, svgRef: svgRefProp }) {
  const internalRef = useRef(null);
  const svgRef = svgRefProp || internalRef;
  const [painting, setPainting] = useState(false);
  const lastPaintedRef = useRef(null);

  const locked = state.locked;
  const { viewBox } = useZoomPan({
    svgRef, enabled: locked, viewW: BOARD_VIEW_W, viewH: BOARD_VIEW_H,
  });

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

  const paintHex = useCallback((col, row) => {
    const key = `${col},${row}`;
    if (lastPaintedRef.current === key) return;
    lastPaintedRef.current = key;
    dispatch({ type: 'PAINT_HEX', col, row });
  }, [dispatch]);

  useEffect(() => {
    if (!painting) return;
    const onUp = () => { setPainting(false); lastPaintedRef.current = null; };
    window.addEventListener('pointerup', onUp);
    return () => window.removeEventListener('pointerup', onUp);
  }, [painting]);

  const onHexDown = (col, row) => (e) => {
    if (locked) return;
    e.preventDefault();
    e.stopPropagation();
    setPainting(true);
    lastPaintedRef.current = null;
    paintHex(col, row);
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };

  const onHexEnter = (col, row) => () => {
    if (locked || !painting) return;
    paintHex(col, row);
  };

  // Empty-area click → deselect ship (matches Board behavior when locked).
  const onSvgPointerDown = (e) => {
    if (!locked) return;
    if (e.target === svgRef.current || e.target.dataset?.bgrect === '1') {
      dispatch({ type: 'SELECT_SHIP', id: null });
    }
  };

  const hexes = [];
  for (let r = 0; r < GRID_ROWS; r++) {
    for (let c = 0; c < GRID_COLS; c++) {
      const { x, y } = hexCenter(c, r);
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
            style={{
              cursor: locked ? 'default' : 'crosshair',
              touchAction: 'none',
              pointerEvents: locked ? 'none' : 'auto',
            }}
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
        viewBox={viewBox}
        width={BOARD_VIEW_W}
        height={BOARD_VIEW_H}
        onPointerDown={onSvgPointerDown}
        style={{ display: 'block', maxWidth: '100%', height: 'auto', touchAction: 'none' }}
      >
        <defs>
          <pattern id="fogPattern" patternUnits="userSpaceOnUse" width="6" height="6"
                   patternTransform="rotate(45)">
            <rect width="6" height="6" fill="rgba(241,245,249,0)" />
            <line x1="0" y1="3" x2="6" y2="3" stroke="rgba(241,245,249,0.45)" strokeWidth="1.5" />
          </pattern>
        </defs>
        <rect x={0} y={0} width={BOARD_VIEW_W} height={BOARD_VIEW_H} fill="#0a1726" data-bgrect="1" />
        {hexes}
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
