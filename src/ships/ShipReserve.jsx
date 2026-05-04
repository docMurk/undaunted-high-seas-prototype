// HTML strip below the board showing reserved ships (col === null).
// Drag a reserved ship onto the board to place it. The reserve is fixed at
// 18 ships (2 factions × 3 classes × 3 numbered) defined in store.js.
import React, { useEffect, useState } from 'react';
import { nearestHex } from '../hex/coords.js';
import { isShipPlaceable, SHIP_CLASSES } from '../state/store.js';
import { FACTION, TOKEN_SIZE } from './ShipLayer.jsx';

// Inline-render a small reserve token. Mirrors ShipToken's geometry but kept
// independent so reserve rendering doesn't depend on the SVG namespace
// propagating through a separate component module.
const MINI_SIZE = Math.round(TOKEN_SIZE * 0.92);
const MINI_PAD = 3;
const MINI_BOX = MINI_SIZE + MINI_PAD * 2;

function MiniShipSvg({ ship }) {
  const s = FACTION[ship.faction];
  const size = MINI_SIZE;
  const half = size / 2;
  const labelW = size * 0.58;
  const labelH = size * 0.42;
  const chevX = size * 0.18;
  const chevTopY = -half + size * 0.06;
  const chevBaseY = -half + size * 0.22;
  const X_INSET = 2.5;
  return (
    <svg width={MINI_BOX} height={MINI_BOX}
         viewBox={`${-MINI_BOX / 2} ${-MINI_BOX / 2} ${MINI_BOX} ${MINI_BOX}`}
         style={{ display: 'block' }}>
      <g transform={`rotate(${ship.facing})`}>
        <rect x={-half} y={-half} width={size} height={size}
              rx="2" fill={s.fill} stroke={s.stroke} strokeWidth={1.2} />
        <line x1={-half + X_INSET} y1={-half + X_INSET}
              x2={half - X_INSET}  y2={half - X_INSET}
              stroke={s.accent} strokeWidth={0.9} opacity={0.55} />
        <line x1={half - X_INSET}  y1={-half + X_INSET}
              x2={-half + X_INSET} y2={half - X_INSET}
              stroke={s.accent} strokeWidth={0.9} opacity={0.55} />
        <polygon
          points={`0,${chevTopY.toFixed(2)} ${(-chevX).toFixed(2)},${chevBaseY.toFixed(2)} ${chevX.toFixed(2)},${chevBaseY.toFixed(2)}`}
          fill={s.accent} stroke={s.stroke} strokeWidth={0.5}
        />
        <g transform={`rotate(${-ship.facing})`}>
          <rect x={-labelW / 2} y={-labelH / 2 + 1.5}
                width={labelW} height={labelH}
                rx="1.5" fill={s.fill} stroke={s.stroke}
                strokeWidth={0.4} opacity={0.95} />
          <text x="0" y={2}
                fontSize={size * 0.42}
                fontFamily="ui-sans-serif, system-ui, sans-serif"
                fontWeight={700} fill={s.text}
                textAnchor="middle" dominantBaseline="middle"
                style={{ userSelect: 'none', pointerEvents: 'none' }}>
            {ship.label || ship.id}
          </text>
        </g>
      </g>
      {ship.suppressed && (
        <rect x={-half} y={-half} width={size} height={size}
              rx="2" fill="rgba(8, 10, 18, 0.55)" pointerEvents="none" />
      )}
    </svg>
  );
}

const FACTION_LABEL = { blue: 'British (Royal Navy)', red: 'French (Marine Royale)' };

function FactionRow({ faction, ships, locked, onStartDrag }) {
  // Split into class buckets in canonical order, render small inline header per class.
  const byClass = SHIP_CLASSES.reduce((acc, c) => {
    acc[c] = ships.filter(s => s.class === c).sort((a, b) => a.label.localeCompare(b.label));
    return acc;
  }, {});
  const accent = FACTION[faction];
  return (
    <div className="flex items-center gap-3">
      <div className="text-[10px] uppercase tracking-wider w-32 flex-shrink-0"
           style={{ color: accent.accent }}>
        {FACTION_LABEL[faction]}
      </div>
      <div className="flex flex-wrap gap-3">
        {SHIP_CLASSES.map(cls => (
          byClass[cls].length > 0 && (
            <div key={cls} className="flex gap-1">
              {byClass[cls].map(ship => (
                <div
                  key={ship.id}
                  onPointerDown={locked ? (e) => onStartDrag(e, ship.id) : undefined}
                  className={locked
                    ? 'cursor-grab active:cursor-grabbing bg-slate-800 hover:bg-slate-700 rounded p-0.5 transition'
                    : 'opacity-50 bg-slate-800 rounded p-0.5'}
                  style={{ touchAction: 'none' }}
                  title={locked
                    ? `${ship.label} (${ship.class}) — drag onto board`
                    : `${ship.label} — lock map to deploy`}
                >
                  <MiniShipSvg ship={ship} />
                </div>
              ))}
            </div>
          )
        ))}
      </div>
    </div>
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
            if (occupants < 4 && isShipPlaceable(state.terrain, hex.col, hex.row)) {
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
  }, [drag, state.ships, state.terrain, dispatch, boardSvgRef]);

  const startDrag = (e, shipId) => {
    e.preventDefault();
    setDrag({ shipId, currentX: e.clientX, currentY: e.clientY });
  };

  const blueReserve = reserved.filter(s => s.faction === 'blue');
  const redReserve  = reserved.filter(s => s.faction === 'red');
  const total = state.ships.length;
  const deployed = state.ships.filter(s => s.col !== null).length;

  return (
    <>
      <div className="bg-slate-900/90 ring-1 ring-slate-800 rounded-lg p-2">
        <div className="text-xs uppercase tracking-wider text-slate-400 mb-1.5 flex items-center justify-between">
          <span>Ship Reserve {state.locked ? '' : '(lock map to deploy)'}</span>
          <span className="text-[10px] text-slate-500">
            {deployed}/{total} deployed
          </span>
        </div>
        <div className="flex flex-col gap-2">
          <FactionRow faction="blue" ships={blueReserve} locked={state.locked} onStartDrag={startDrag} />
          <FactionRow faction="red"  ships={redReserve}  locked={state.locked} onStartDrag={startDrag} />
        </div>
      </div>

      {drag && (() => {
        const ship = state.ships.find(s => s.id === drag.shipId);
        if (!ship) return null;
        return (
          <div
            style={{
              position: 'fixed',
              left: drag.currentX - MINI_BOX / 2,
              top:  drag.currentY - MINI_BOX / 2,
              pointerEvents: 'none',
              zIndex: 9999,
              opacity: 0.85,
            }}
          >
            <MiniShipSvg ship={ship} />
          </div>
        );
      })()}
    </>
  );
}
