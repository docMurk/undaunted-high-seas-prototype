import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';

// ---------- Geometry ----------
const HEX_SIZE = 58;                          // hex "radius" (center to vertex)
const TOKEN_SIZE = HEX_SIZE * 0.40;           // square token edge length
const GRID_COLS = 6;
const GRID_ROWS = 6;
const HEX_WIDTH = Math.sqrt(3) * HEX_SIZE;    // pointy-top: flat-to-flat width
const HEX_HEIGHT = 2 * HEX_SIZE;              // pointy-top: vertex-to-vertex height
const HEX_VSPACE = HEX_HEIGHT * 0.75;         // vertical row pitch

const BOARD_PAD = 44;
const BOARD_WIDTH_PX = GRID_COLS * HEX_WIDTH + HEX_WIDTH / 2;
const BOARD_HEIGHT_PX = (GRID_ROWS - 1) * HEX_VSPACE + HEX_HEIGHT;

const PALETTE_GAP = 64;
const PALETTE_W = 132;
const PALETTE_X_CENTER = BOARD_PAD + BOARD_WIDTH_PX + PALETTE_GAP + PALETTE_W / 2;

const SVG_WIDTH = BOARD_PAD + BOARD_WIDTH_PX + PALETTE_GAP + PALETTE_W + BOARD_PAD;
const SVG_HEIGHT = BOARD_PAD * 2 + BOARD_HEIGHT_PX;

// ---------- Visual ----------
const FACTION = {
  blue: { fill: '#1c3a5e', stroke: '#0a1a2e', accent: '#dbe6f3', text: '#f4f7fb', label: 'Royal Navy' },
  red:  { fill: '#9a2a2c', stroke: '#511518', accent: '#f3e6d4', text: '#fbf0e0', label: 'French Navy' },
};

const ARC_FILL_BROADSIDE = 'rgba(245, 158, 11, 0.42)';  // amber/gold (port + starboard)
const ARC_FILL_FOREAFT   = 'rgba(180,  83,  9, 0.52)';  // deeper red-amber (fore + aft)
const SELECT_OUTLINE = '#fbbf24';

// ---------- Hex helpers ----------
function hexCenter(col, row) {
  const x = BOARD_PAD + col * HEX_WIDTH + (row % 2 === 1 ? HEX_WIDTH / 2 : 0) + HEX_WIDTH / 2;
  const y = BOARD_PAD + row * HEX_VSPACE + HEX_HEIGHT / 2;
  return { x, y };
}

function hexPoints(cx, cy, size) {
  const pts = [];
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 180) * (60 * i - 90); // pointy-top: vertex at the top
    pts.push(`${(cx + size * Math.cos(a)).toFixed(2)},${(cy + size * Math.sin(a)).toFixed(2)}`);
  }
  return pts.join(' ');
}

function nearestHex(x, y) {
  let best = null;
  let bestD = Infinity;
  for (let r = 0; r < GRID_ROWS; r++) {
    for (let c = 0; c < GRID_COLS; c++) {
      const h = hexCenter(c, r);
      const d = Math.hypot(x - h.x, y - h.y);
      if (d < bestD) { bestD = d; best = { col: c, row: r, d }; }
    }
  }
  return best && best.d < HEX_SIZE * 0.95 ? { col: best.col, row: best.row } : null;
}

// ---------- Axial coords (pointy-top, odd-r offset) ----------
function offsetToAxial(col, row) {
  return { q: col - ((row - (row & 1)) >> 1), r: row };
}
function axialToOffset(q, r) {
  return { col: q + ((r - (r & 1)) >> 1), row: r };
}
// 6 hex directions ordered to match facings 90°, 150°, 210°, 270°, 330°, 30°
const HEX_DIR_AXIAL = [
  { q: +1, r:  0 }, // 90°  (E)
  { q:  0, r: +1 }, // 150° (SE)
  { q: -1, r: +1 }, // 210° (SW)
  { q: -1, r:  0 }, // 270° (W)
  { q:  0, r: -1 }, // 330° (NW)
  { q: +1, r: -1 }, // 30°  (NE)
];
function facingToDirIdx(facing) {
  return ((Math.round((facing - 90) / 60)) + 6) % 6;
}
function inBoundsOffset(col, row) {
  return col >= 0 && col < GRID_COLS && row >= 0 && row < GRID_ROWS;
}
function collectLineHexes(startAxial, vec) {
  const out = [];
  let cur = { q: startAxial.q + vec.q, r: startAxial.r + vec.r };
  while (true) {
    const off = axialToOffset(cur.q, cur.r);
    if (!inBoundsOffset(off.col, off.row)) break;
    out.push(off);
    cur = { q: cur.q + vec.q, r: cur.r + vec.r };
  }
  return out;
}
// Walk both directions along `lineDir` from `startAxial` (inclusive of start).
function collectBidirectionalLine(startAxial, lineDir) {
  const out = [];
  let cur = { ...startAxial };
  while (true) {
    const off = axialToOffset(cur.q, cur.r);
    if (!inBoundsOffset(off.col, off.row)) break;
    out.push(off);
    cur = { q: cur.q + lineDir.q, r: cur.r + lineDir.r };
  }
  cur = { q: startAxial.q - lineDir.q, r: startAxial.r - lineDir.r };
  while (true) {
    const off = axialToOffset(cur.q, cur.r);
    if (!inBoundsOffset(off.col, off.row)) break;
    out.push(off);
    cur = { q: cur.q - lineDir.q, r: cur.r - lineDir.r };
  }
  return out;
}

// 2x2 sub-grid offsets (TL, TR, BL, BR)
const SLOT_DIRS = [
  { dx: -1, dy: -1 }, { dx: 1, dy: -1 },
  { dx: -1, dy:  1 }, { dx: 1, dy:  1 },
];

function inHexPosition(col, row, slot, total) {
  const c = hexCenter(col, row);
  if (total <= 1) return c;
  const off = TOKEN_SIZE / 2 + 3;
  const d = SLOT_DIRS[slot] || SLOT_DIRS[0];
  return { x: c.x + d.dx * off, y: c.y + d.dy * off };
}

function palettePosition(paletteSlot) {
  return { x: PALETTE_X_CENTER, y: BOARD_PAD + 88 + paletteSlot * 96 };
}

// ---------- Initial setup ----------
const INITIAL_SHIPS = [
  { id: 'HMS-1', faction: 'blue', col: 0, row: 0, facing: 150 },
  { id: 'HMS-2', faction: 'blue', col: 1, row: 0, facing: 150 },
  { id: 'HMS-3', faction: 'blue', col: 0, row: 1, facing: 150 },
  { id: 'FR-1',  faction: 'red',  col: 5, row: 5, facing: 330 },
  { id: 'FR-2',  faction: 'red',  col: 4, row: 5, facing: 330 },
  { id: 'FR-3',  faction: 'red',  col: 5, row: 4, facing: 330 },
  { id: 'HMS-4', faction: 'blue', col: null, row: null, facing: 150, paletteSlot: 0 },
  { id: 'FR-4',  faction: 'red',  col: null, row: null, facing: 330, paletteSlot: 1 },
];

// ---------- Token ----------
function ShipToken({ ship, x, y, selected, ghosted, onPointerDown }) {
  const s = FACTION[ship.faction];
  const half = TOKEN_SIZE / 2;
  return (
    <g
      transform={`translate(${x.toFixed(2)},${y.toFixed(2)})`}
      onPointerDown={onPointerDown}
      style={{ cursor: ghosted ? 'grabbing' : 'grab', opacity: ghosted ? 0.55 : 1 }}
    >
      <rect
        x={-half + 1.5} y={-half + 2.5}
        width={TOKEN_SIZE} height={TOKEN_SIZE}
        rx="2.5"
        fill="rgba(8, 12, 20, 0.45)"
      />
      <g transform={`rotate(${ship.facing})`}>
        <rect
          x={-half} y={-half}
          width={TOKEN_SIZE} height={TOKEN_SIZE}
          rx="2"
          fill={s.fill}
          stroke={selected ? SELECT_OUTLINE : s.stroke}
          strokeWidth={selected ? 2.4 : 1.2}
        />
        <line x1={-half + 1.5} y1={-half + 1.5} x2={half - 1.5} y2={half - 1.5}
              stroke={s.accent} strokeWidth="1" opacity="0.55" />
        <line x1={-half + 1.5} y1={ half - 1.5} x2={half - 1.5} y2={-half + 1.5}
              stroke={s.accent} strokeWidth="1" opacity="0.55" />
        <polygon
          points={`0,${(-half + 0.6).toFixed(2)} ${(-3.6).toFixed(2)},${(-half + 5.2).toFixed(2)} ${(3.6).toFixed(2)},${(-half + 5.2).toFixed(2)}`}
          fill={s.accent}
        />
        <g transform={`rotate(${-ship.facing})`}>
          <text
            x="0" y="0.5"
            fontSize={TOKEN_SIZE * 0.26}
            fontFamily="ui-sans-serif, system-ui, -apple-system, sans-serif"
            fontWeight="700"
            fill={s.text}
            textAnchor="middle"
            dominantBaseline="middle"
            style={{ userSelect: 'none', pointerEvents: 'none' }}
          >
            {ship.id}
          </text>
        </g>
      </g>
    </g>
  );
}

// ---------- Firing arc overlay (angle-based partition) ----------
// Classify each hex by relative angle from ship's bow:
//   rel ≈ 0°            → fore  (single hex line along bow direction)
//   rel ≈ 180°          → aft   (single hex line along stern direction)
//   60° ≤ rel ≤ 120°    → starboard cone (60° wedge)
//   240° ≤ rel ≤ 300°   → port cone (60° wedge)
//   else                → no arc
// Cone boundaries align with the fore-port / aft-port / fore-stbd / aft-stbd
// hex directions, so cones include hexes exactly along those directions.
function FiringArcs({ ship }) {
  if (ship.col === null) return null;

  const shipPx = hexCenter(ship.col, ship.row);
  const bow = ship.facing;
  const EPS = 0.5;

  const foreAft = [];
  const broadside = [];

  for (let r = 0; r < GRID_ROWS; r++) {
    for (let c = 0; c < GRID_COLS; c++) {
      if (c === ship.col && r === ship.row) continue;
      const px = hexCenter(c, r);
      const dx = px.x - shipPx.x;
      const dy = px.y - shipPx.y;
      // Angle in our convention: 0° = up, CW positive.
      let angle = Math.atan2(dx, -dy) * 180 / Math.PI;
      angle = (angle + 360) % 360;
      const rel = (angle - bow + 360) % 360;

      if (rel < EPS || rel > 360 - EPS || Math.abs(rel - 180) < EPS) {
        foreAft.push({ col: c, row: r });
      } else if (
        (rel >= 60 - EPS && rel <= 120 + EPS) ||
        (rel >= 240 - EPS && rel <= 300 + EPS)
      ) {
        broadside.push({ col: c, row: r });
      }
    }
  }

  const fillHex = (col, row, fill, key) => {
    const { x, y } = hexCenter(col, row);
    return (
      <polygon
        key={key}
        points={hexPoints(x, y, HEX_SIZE - 1)}
        fill={fill}
      />
    );
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

// ---------- Main component ----------
export default function NavalPrototype() {
  const [ships, setShips] = useState(INITIAL_SHIPS);
  const [selectedId, setSelectedId] = useState(null);
  const [showCoords, setShowCoords] = useState(false);
  const [drag, setDrag] = useState(null);
  // drag = { id, startX, startY, currentX, currentY, didMove }
  const [emptyDown, setEmptyDown] = useState(null);
  // emptyDown = { x, y } captured on empty-area pointerdown
  const svgRef = useRef(null);

  const toSvgPoint = useCallback((clientX, clientY) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const pt = svg.createSVGPoint();
    pt.x = clientX; pt.y = clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    const sp = pt.matrixTransform(ctm.inverse());
    return { x: sp.x, y: sp.y };
  }, []);

  // ---- Group ships by hex for slot assignment ----
  const layout = useMemo(() => {
    const byHex = new Map();
    ships.forEach(s => {
      if (s.col !== null) {
        const k = `${s.col},${s.row}`;
        if (!byHex.has(k)) byHex.set(k, []);
        byHex.get(k).push(s);
      }
    });
    const positions = {};
    byHex.forEach(group => {
      group.sort((a, b) => a.id.localeCompare(b.id));
      const total = group.length;
      group.forEach((s, idx) => {
        positions[s.id] = inHexPosition(s.col, s.row, idx, total);
      });
    });
    ships.forEach(s => {
      if (s.col === null) positions[s.id] = palettePosition(s.paletteSlot);
    });
    return positions;
  }, [ships]);

  const positionFor = (ship) => {
    if (drag && drag.id === ship.id && drag.didMove) {
      return { x: drag.currentX, y: drag.currentY };
    }
    return layout[ship.id];
  };

  // ---- Drag highlight ----
  const dragHover = useMemo(() => {
    if (!drag || !drag.didMove) return null;
    const hex = nearestHex(drag.currentX, drag.currentY);
    if (!hex) return null;
    const others = ships.filter(s =>
      s.col === hex.col && s.row === hex.row && s.id !== drag.id
    );
    return { col: hex.col, row: hex.row, valid: others.length < 4 };
  }, [drag, ships]);

  // ---- Pointer drag wiring ----
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
          setSelectedId(d.id);
          return null;
        }
        const hex = nearestHex(pt.x, pt.y);
        if (hex) {
          const occupants = ships.filter(s =>
            s.col === hex.col && s.row === hex.row && s.id !== d.id
          ).length;
          if (occupants < 4) {
            setShips(ss => ss.map(s =>
              s.id === d.id ? { ...s, col: hex.col, row: hex.row } : s
            ));
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
  }, [drag, ships, toSvgPoint]);

  // ---- Empty-area click → deselect ----
  useEffect(() => {
    if (!emptyDown) return;
    const onMove = (e) => {
      const pt = toSvgPoint(e.clientX, e.clientY);
      if (Math.hypot(pt.x - emptyDown.x, pt.y - emptyDown.y) > 4) setEmptyDown(null);
    };
    const onUp = (e) => {
      const pt = toSvgPoint(e.clientX, e.clientY);
      if (Math.hypot(pt.x - emptyDown.x, pt.y - emptyDown.y) < 4) {
        setSelectedId(null);
      }
      setEmptyDown(null);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [emptyDown, toSvgPoint]);

  // ---- Rotation hotkeys ----
  useEffect(() => {
    const onKey = (e) => {
      if (!selectedId) return;
      const tag = e.target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.key === 'q' || e.key === 'Q') {
        setShips(ss => ss.map(s =>
          s.id === selectedId ? { ...s, facing: (s.facing + 360 - 60) % 360 } : s
        ));
      } else if (e.key === 'e' || e.key === 'E') {
        setShips(ss => ss.map(s =>
          s.id === selectedId ? { ...s, facing: (s.facing + 60) % 360 } : s
        ));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedId]);

  // ---- Handlers ----
  const onShipDown = (ship) => (e) => {
    e.stopPropagation();
    const pt = toSvgPoint(e.clientX, e.clientY);
    setDrag({
      id: ship.id,
      startX: pt.x, startY: pt.y,
      currentX: pt.x, currentY: pt.y,
      didMove: false,
    });
  };

  const onSvgDown = (e) => {
    if (drag) return;
    const pt = toSvgPoint(e.clientX, e.clientY);
    setEmptyDown({ x: pt.x, y: pt.y });
  };

  const reset = () => {
    setShips(INITIAL_SHIPS);
    setSelectedId(null);
  };

  const selectedShip = ships.find(s => s.id === selectedId);
  const showArcs = selectedShip && selectedShip.col !== null;

  // ---- Render ----
  return (
    <div className="min-h-screen w-full bg-slate-950 text-slate-100 flex flex-col items-center px-6 py-8 font-sans">
      <div className="w-full max-w-[1200px] flex items-end justify-between mb-5">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-100">
            Naval Prototype <span className="text-slate-400 font-normal">— Undaunted hack sandbox</span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Drag tokens. Click to select. Hotkeys rotate the selection.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 text-sm text-slate-300 select-none cursor-pointer px-3 py-1.5 rounded-md bg-slate-800/60 hover:bg-slate-800 transition">
            <input
              type="checkbox"
              checked={showCoords}
              onChange={(e) => setShowCoords(e.target.checked)}
              className="accent-amber-400"
            />
            Show coords
          </label>
          <button
            onClick={reset}
            className="px-3 py-1.5 rounded-md bg-slate-800/60 hover:bg-slate-700 text-sm text-slate-200 transition"
          >
            Reset
          </button>
        </div>
      </div>

      <div className="relative bg-slate-900/80 rounded-xl shadow-xl ring-1 ring-slate-800/80 p-2">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
          width={SVG_WIDTH}
          height={SVG_HEIGHT}
          onPointerDown={onSvgDown}
          style={{ display: 'block', maxWidth: '100%', height: 'auto', touchAction: 'none' }}
        >
          <defs>
            <clipPath id="boardClip">
              <rect
                x={BOARD_PAD - 2}
                y={BOARD_PAD - 2}
                width={BOARD_WIDTH_PX + 4}
                height={BOARD_HEIGHT_PX + 4}
              />
            </clipPath>
            <linearGradient id="seaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"  stopColor="#1d4669" />
              <stop offset="100%" stopColor="#163955" />
            </linearGradient>
            <linearGradient id="paletteGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"  stopColor="#1e293b" />
              <stop offset="100%" stopColor="#0f172a" />
            </linearGradient>
          </defs>

          {/* Hex grid */}
          <g>
            {Array.from({ length: GRID_ROWS }).map((_, r) =>
              Array.from({ length: GRID_COLS }).map((__, c) => {
                const { x, y } = hexCenter(c, r);
                const hovered = dragHover && dragHover.col === c && dragHover.row === r;
                return (
                  <g key={`${c}-${r}`}>
                    <polygon
                      points={hexPoints(x, y, HEX_SIZE - 1)}
                      fill="url(#seaGrad)"
                      stroke="#0c2238"
                      strokeWidth="1.25"
                    />
                    {hovered && (
                      <polygon
                        points={hexPoints(x, y, HEX_SIZE - 2.5)}
                        fill={dragHover.valid ? 'rgba(34, 197, 94, 0.18)' : 'rgba(239, 68, 68, 0.20)'}
                        stroke={dragHover.valid ? '#22c55e' : '#ef4444'}
                        strokeWidth="1.8"
                        pointerEvents="none"
                      />
                    )}
                    {showCoords && (
                      <text
                        x={x} y={y + HEX_SIZE * 0.66}
                        fontSize="9"
                        fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
                        fill="#7493b1"
                        opacity="0.7"
                        textAnchor="middle"
                        pointerEvents="none"
                        style={{ userSelect: 'none' }}
                      >
                        {c},{r}
                      </text>
                    )}
                  </g>
                );
              })
            )}
          </g>

          {/* Firing arc overlay (above hex grid, below tokens) */}
          {showArcs && <FiringArcs ship={selectedShip} />}

          {/* Palette panel */}
          <g>
            <rect
              x={PALETTE_X_CENTER - PALETTE_W / 2}
              y={BOARD_PAD}
              width={PALETTE_W}
              height={BOARD_HEIGHT_PX}
              rx="10"
              fill="url(#paletteGrad)"
              stroke="#1e293b"
              strokeWidth="1"
            />
            <text
              x={PALETTE_X_CENTER}
              y={BOARD_PAD + 24}
              fontSize="11"
              fontWeight="600"
              fill="#94a3b8"
              fontFamily="ui-sans-serif, system-ui, sans-serif"
              textAnchor="middle"
              style={{ userSelect: 'none', letterSpacing: '0.08em', textTransform: 'uppercase' }}
            >
              Reserve
            </text>
            <text
              x={PALETTE_X_CENTER}
              y={BOARD_PAD + 40}
              fontSize="9.5"
              fill="#64748b"
              fontFamily="ui-sans-serif, system-ui, sans-serif"
              textAnchor="middle"
              style={{ userSelect: 'none' }}
            >
              drag onto board
            </text>

            {/* Hotkey legend at bottom of palette */}
            <g transform={`translate(${PALETTE_X_CENTER}, ${BOARD_PAD + BOARD_HEIGHT_PX - 56})`}>
              <text
                x="0" y="0"
                fontSize="10"
                fontWeight="600"
                fill="#94a3b8"
                fontFamily="ui-sans-serif, system-ui, sans-serif"
                textAnchor="middle"
                style={{ userSelect: 'none', letterSpacing: '0.08em', textTransform: 'uppercase' }}
              >
                Hotkeys
              </text>
              <text x="0" y="18" fontSize="11" fill="#cbd5e1"
                    fontFamily="ui-sans-serif, system-ui, sans-serif" textAnchor="middle"
                    style={{ userSelect: 'none' }}>
                Q · rotate CCW
              </text>
              <text x="0" y="34" fontSize="11" fill="#cbd5e1"
                    fontFamily="ui-sans-serif, system-ui, sans-serif" textAnchor="middle"
                    style={{ userSelect: 'none' }}>
                E · rotate CW
              </text>
            </g>
          </g>

          {/* Ships */}
          <g>
            {ships.map(ship => {
              const pos = positionFor(ship);
              if (!pos) return null;
              const isDragging = drag && drag.id === ship.id && drag.didMove;
              return (
                <ShipToken
                  key={ship.id}
                  ship={ship}
                  x={pos.x}
                  y={pos.y}
                  selected={selectedId === ship.id}
                  ghosted={isDragging}
                  onPointerDown={onShipDown(ship)}
                />
              );
            })}
          </g>
        </svg>
      </div>

      {/* Status / legend strip */}
      <div className="w-full max-w-[1200px] mt-4 flex items-center justify-between text-xs text-slate-400">
        <div className="flex items-center gap-5">
          <div className="flex items-center gap-2">
            <span className="inline-block w-3 h-3 rounded-sm" style={{ background: FACTION.blue.fill }} />
            <span>Royal Navy</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-block w-3 h-3 rounded-sm" style={{ background: FACTION.red.fill }} />
            <span>French Navy</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-block w-3 h-3 rounded-sm" style={{ background: ARC_FILL_BROADSIDE, outline: '1px solid rgba(245,158,11,0.7)' }} />
            <span>Broadside (port / starboard)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-block w-3 h-3 rounded-sm" style={{ background: ARC_FILL_FOREAFT, outline: '1px solid rgba(180,83,9,0.75)' }} />
            <span>Fore / aft</span>
          </div>
        </div>
        <div className="text-slate-500">
          {selectedShip
            ? `Selected · ${selectedShip.id} · facing ${selectedShip.facing}°`
            : 'No selection'}
        </div>
      </div>
    </div>
  );
}
