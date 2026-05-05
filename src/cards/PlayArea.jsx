// Free-form 2D card overlay positioned over (or beside) the board. Cards in
// playArea[] hold {x, y} coordinates from drop/reposition events.

import React, { useRef } from 'react';
import Card from './Card.jsx';
import { setDragPayload, getDragPayload } from './dragdrop.js';

export default function PlayArea({ state, dispatch, height = 280 }) {
  const ref = useRef(null);
  const localPlayer = state.localPlayer || 'p1';

  const allowDrop = (e) => { e.preventDefault(); };

  const onDrop = (e) => {
    e.preventDefault();
    const payload = getDragPayload(e);
    if (!payload) return;
    const rect = ref.current?.getBoundingClientRect();
    const x = rect ? e.clientX - rect.left : 0;
    const y = rect ? e.clientY - rect.top  : 0;
    dispatch({
      type: 'MOVE_CARD',
      cardKey: payload.cardKey,
      from: payload.from,
      to: { zone: 'playArea', position: { x, y } },
      faceUp: !e.shiftKey,
    });
  };

  const onDragStart = (e, card) => {
    setDragPayload(e, {
      cardKey: card.cardKey,
      from: { zone: 'playArea' },
    });
  };

  const cards = state.playArea || [];

  return (
    <div
      ref={ref}
      onDragOver={allowDrop}
      onDrop={onDrop}
      className="relative bg-slate-900/40 ring-1 ring-dashed ring-slate-700/60 rounded-lg overflow-hidden"
      style={{ height }}
    >
      <div className="absolute top-1 left-2 text-[10px] uppercase tracking-wider text-slate-500 pointer-events-none">
        Play area · drop cards anywhere · Shift+drop = face-down
      </div>
      {cards.map((c) => (
        <div
          key={c.cardKey}
          className="absolute"
          style={{
            left: (c.x || 20) - 60,
            top:  (c.y || 60) - 84,
          }}
        >
          <Card
            card={c}
            cardData={state.cardData}
            size="sm"
            onDragStart={onDragStart}
            onDoubleClick={() => {
              if (c.owner === localPlayer || c.owner == null) {
                dispatch({ type: 'FLIP_CARD', cardKey: c.cardKey });
              }
            }}
          />
        </div>
      ))}
    </div>
  );
}
