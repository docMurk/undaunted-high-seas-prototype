// Free-form card table. Cards in playArea[] hold normalized {x, y} in 0..1
// so positions survive container resize (split-pane width changes). Renders as
// `position: absolute` with `left/top` as percent so the table feels like a
// physical surface that scales with the window.

import React, { useRef, useState } from 'react';
import Card from './Card.jsx';
import { setDragPayload, getDragPayload } from './dragdrop.js';

export default function PlayArea({ state, dispatch, onZoom }) {
  const ref = useRef(null);
  const localPlayer = state.localPlayer || 'p1';
  const [hoverKey, setHoverKey] = useState(null);

  const allowDrop = (e) => { e.preventDefault(); };

  const onDrop = (e) => {
    e.preventDefault();
    const payload = getDragPayload(e);
    if (!payload) return;
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    const fx = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const fy = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
    dispatch({
      type: 'MOVE_CARD',
      cardKey: payload.cardKey,
      from: payload.from,
      to: { zone: 'playArea', position: { x: fx, y: fy } },
      faceUp: !e.shiftKey,
    });
    setHoverKey(null);
  };

  const onDragStart = (e, card) => {
    setDragPayload(e, {
      cardKey: card.cardKey,
      from: { zone: 'playArea' },
    });
    setHoverKey(null);
  };

  const cards = state.playArea || [];

  return (
    <div
      ref={ref}
      onDragOver={allowDrop}
      onDrop={onDrop}
      className="relative w-full h-full bg-slate-900/40 ring-1 ring-dashed ring-slate-700/60 rounded-lg overflow-hidden"
    >
      <div className="absolute top-2 left-3 text-[10px] uppercase tracking-wider text-slate-500 pointer-events-none select-none">
        Play area · drop cards anywhere · Shift+drop = face-down · hover to enlarge · dbl-click to flip
      </div>
      {cards.map((c) => {
        // Stored coords are normalized 0..1. Legacy pixel coords (>1) center.
        const rawX = c.x;
        const rawY = c.y;
        const fx = (typeof rawX === 'number' && rawX >= 0 && rawX <= 1) ? rawX : 0.5;
        const fy = (typeof rawY === 'number' && rawY >= 0 && rawY <= 1) ? rawY : 0.5;
        const isHover = hoverKey === c.cardKey;
        return (
          <div
            key={c.cardKey}
            className="absolute"
            style={{
              left: `${fx * 100}%`,
              top:  `${fy * 100}%`,
              transform: `translate(-50%, -50%) scale(${isHover ? 1.8 : 1})`,
              transformOrigin: 'center center',
              transition: 'transform 160ms cubic-bezier(0.2,0.9,0.3,1)',
              zIndex: isHover ? 40 : 1,
              filter: isHover
                ? 'drop-shadow(0 14px 28px rgba(0,0,0,0.65))'
                : 'drop-shadow(0 4px 8px rgba(0,0,0,0.45))',
              willChange: 'transform',
            }}
            onMouseEnter={() => setHoverKey(c.cardKey)}
            onMouseLeave={() => setHoverKey(k => k === c.cardKey ? null : k)}
          >
            <Card
              card={c}
              cardData={state.cardData}
              size="md"
              showHoverZoom={false}
              onDragStart={onDragStart}
              onDoubleClick={() => {
                if (c.owner === localPlayer || c.owner == null) {
                  dispatch({ type: 'FLIP_CARD', cardKey: c.cardKey });
                } else if (onZoom) {
                  onZoom(c);
                }
              }}
            />
          </div>
        );
      })}
    </div>
  );
}
