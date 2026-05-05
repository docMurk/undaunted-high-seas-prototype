// Bottom-pinned 3-card hand strip. Hotkeys 1/2/3 select a card; Z opens the
// shared CardModal on selected card; drag any card to any zone or PlayArea.

import React, { useEffect, useState } from 'react';
import Card from './Card.jsx';
import { setDragPayload, getDragPayload } from './dragdrop.js';

const HAND_SIZE = 3;

export default function Hand({ state, dispatch, onZoom }) {
  const localPlayer = state.localPlayer || 'p1';
  const z = state.zones?.[localPlayer];
  const hand = z?.hand || [];
  const cards = [...hand];
  while (cards.length < HAND_SIZE) cards.push(null);

  const [selected, setSelected] = useState(0);

  useEffect(() => {
    const onKey = (e) => {
      const tag = e.target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.key === '1' || e.key === '2' || e.key === '3') {
        const idx = +e.key - 1;
        if (idx < hand.length) setSelected(idx);
      } else if (e.key === 'z' || e.key === 'Z') {
        const c = hand[selected];
        if (c && onZoom) onZoom(c);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [hand, selected, onZoom]);

  const handleDragStart = (e, card) => {
    setDragPayload(e, {
      cardKey: card.cardKey,
      from: { player: localPlayer, zone: 'hand' },
    });
  };

  const onDeckClick = () => {
    dispatch({ type: 'DRAW_TO_HAND_SIZE', player: localPlayer });
  };

  const deckCount = z?.deck?.length || 0;
  const discardTop = z?.discard?.[z.discard.length - 1];

  // Drop handler for the discard mini (drop a hand card to discard).
  const onDropDiscard = (e) => {
    e.preventDefault();
    const payload = getDragPayload(e);
    if (!payload) return;
    dispatch({
      type: 'MOVE_CARD',
      cardKey: payload.cardKey,
      from: payload.from,
      to: { player: localPlayer, zone: 'discard', position: 'top' },
      faceUp: true,
    });
  };
  const allowDrop = (e) => { e.preventDefault(); };

  return (
    <div className="flex items-end gap-3 p-2 bg-slate-900/70 ring-1 ring-slate-800 rounded-lg">
      {/* Deck mini */}
      <div className="flex flex-col items-center gap-1">
        <div className="text-[9px] uppercase tracking-wider text-slate-500">Deck</div>
        <button
          onClick={onDeckClick}
          className="relative rounded-md w-[60px] h-[84px] bg-slate-800 ring-1 ring-slate-700 hover:ring-amber-500 text-slate-200 text-xs flex items-center justify-center"
          title="Click to draw to hand size (3)"
        >
          {deckCount}
        </button>
      </div>

      {/* Hand cards */}
      <div className="flex items-end gap-3 flex-1 justify-center">
        {cards.map((card, i) => (
          <div
            key={card?.cardKey || `slot-${i}`}
            onClick={() => card && setSelected(i)}
            className={`flex flex-col items-center gap-1 ${selected === i ? 'opacity-100' : ''}`}
          >
            <div className="text-[9px] uppercase tracking-wider text-slate-500">
              {i + 1}{selected === i ? ' ←' : ''}
            </div>
            <Card
              card={card}
              cardData={state.cardData}
              size="md"
              visible={!!card}
              draggable={!!card}
              selected={selected === i && !!card}
              onDragStart={handleDragStart}
              onDoubleClick={() => card && onZoom?.(card)}
            />
          </div>
        ))}
      </div>

      {/* Discard mini (drop target) */}
      <div
        className="flex flex-col items-center gap-1"
        onDragOver={allowDrop}
        onDrop={onDropDiscard}
      >
        <div className="text-[9px] uppercase tracking-wider text-slate-500">Discard</div>
        <div className="rounded-md w-[60px] h-[84px] bg-slate-900/70 ring-1 ring-dashed ring-slate-600 flex items-center justify-center">
          {discardTop ? (
            <Card card={discardTop} cardData={state.cardData} size="xs" draggable={false} showHoverZoom={false} />
          ) : (
            <span className="text-[10px] text-slate-500">empty</span>
          )}
        </div>
      </div>
    </div>
  );
}
