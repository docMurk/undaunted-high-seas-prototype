// HTML strip below the board showing reserved ships (col === null).
// Drag a reserved ship onto the board to place it.
import React, { useEffect, useState } from 'react';
import { hexCenter, hexPoints, HEX_SIZE, nearestHex } from '../hex/coords.js';

const TOKEN_SIZE = 38;

const FACTION = {
  blue: { fill: '#1c3a5e', stroke: '#0a1a2e', accent: '#dbe6f3', text: '#f4f7fb' },
  red:  { fill: '#9a2a2c', stroke: '#511518', accent: '#f3e6d4', text: '#fbf0e0' },
};

function MiniShipSvg({ ship }) {
  const s = FACTION[ship.faction];
  const half = TOKEN_SIZE / 2;
  return (
    <svg width={TOKEN_SIZE + 6} height={TOKEN_SIZE + 6} viewBox={`-${half + 3} -${half + 3} ${TOKEN_SIZE + 6} ${TOKEN_SIZE + 6}`}>
      <g transform={`rotate(${ship.facing})`}>
        <rect x={-half} y={-half} width={TOKEN_SIZE} height={TOKEN_SIZE}
              rx="2" fill={s.fill} stroke={s.stroke} strokeWidth="1.2" />
        <polygon
          points={`0,${(-half + 0.6).toFixed(2)} ${(-3.2).toFixed(2)},${(-half + 4.6).toFixed(2)} ${(3.2).toFixed(2)},${(-half + 4.6).toFixed(2)}`}
          fill={s.accent}
        />
        <g transform={`rotate(${-ship.facing})`}>
          <text x="0" y="0.5" fontSize={TOKEN_SIZE * 0.30}
                fontFamily="ui-sans-serif, system-ui, sans-serif"
                fontWeight="700" fill={s.text}
                textAnchor="middle" dominantBaseline="middle"
                style={{ userSelect: 'none', pointerEvents: 'none' }}>
            {ship.id}
          </text>
        </g>
      </g>
    </svg>
  );
}

export default function ShipReserve({ state, dispatch, boardSvgRef }) {
  const reserved = state.ships.filter(s => s.col === null);
  const [drag, setDrag] = useState(null);
  // drag = { shipId, currentX, currentY }

  useEffect(() => {
    if (!drag) return;
    const onMove = (e) => {
      setDrag(d => d ? { ...d, currentX: e.clientX, currentY: e.clientY } : d);
    };
    const onUp = (e) => {
      const svg = boardSvgRef.current;
      if (svg) {
        const rect = svg.getBoundingClientRect();
        const inside = e.clientX >= rect.left && e.clientX <= rect.right
                    && e.clientY >= rect.top && e.clientY <= rect.bottom;
        if (inside) {
          const pt = svg.createSVGPoint();
          pt.x = e.clientX; pt.y = e.clientY;
          const sp = pt.matrixTransform(svg.getScreenCTM().inverse());
          const hex = nearestHex(sp.x, sp.y);
          if (hex) {
            const occupants = state.ships.filter(s =>
              s.col === hex.col && s.row === hex.row && s.id !== drag.shipId).length;
            if (occupants < 4) {
              dispatch({ type: 'PLACE_SHIP', id: drag.shipId, col: hex.col, row: hex.row });
            }
          }
        }
      }
      setDrag(null);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [drag, state.ships, dispatch, boardSvgRef]);

  const startDrag = (e, shipId) => {
    e.preventDefault();
    setDrag({ shipId, currentX: e.clientX, currentY: e.clientY });
  };

  return (
    <>
      <div className="bg-slate-900/90 ring-1 ring-slate-800 rounded-lg p-2">
        <div className="text-xs uppercase tracking-wider text-slate-400 mb-1.5 flex items-center justify-between">
          <span>Ship Reserve {state.locked ? '' : '(unlock to deploy)'}</span>
          <div className="flex gap-1">
            <button
              onClick={() => dispatch({ type: 'ADD_SHIP', faction: 'blue' })}
              className="px-1.5 py-0.5 text-[10px] rounded bg-blue-900 hover:bg-blue-800 text-blue-100"
            >+ RN</button>
            <button
              onClick={() => dispatch({ type: 'ADD_SHIP', faction: 'red' })}
              className="px-1.5 py-0.5 text-[10px] rounded bg-red-900 hover:bg-red-800 text-red-100"
            >+ FR</button>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {reserved.length === 0 && (
            <div className="text-xs text-slate-500 italic py-2">All ships deployed.</div>
          )}
          {reserved.map(ship => (
            <div
              key={ship.id}
              onPointerDown={state.locked ? (e) => startDrag(e, ship.id) : undefined}
              className={state.locked
                ? 'cursor-grab active:cursor-grabbing bg-slate-800 hover:bg-slate-700 rounded p-1 transition'
                : 'opacity-50 bg-slate-800 rounded p-1'}
              style={{ touchAction: 'none' }}
              title={state.locked ? `${ship.id} — drag onto board` : `${ship.id} — lock tiles to deploy`}
            >
              <MiniShipSvg ship={ship} />
            </div>
          ))}
        </div>
      </div>

      {drag && (
        <div
          style={{
            position: 'fixed',
            left: drag.currentX - (TOKEN_SIZE + 6) / 2,
            top:  drag.currentY - (TOKEN_SIZE + 6) / 2,
            pointerEvents: 'none',
            zIndex: 9999,
            opacity: 0.85,
          }}
        >
          <MiniShipSvg ship={state.ships.find(s => s.id === drag.shipId)} />
        </div>
      )}
    </>
  );
}
