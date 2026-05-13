// Floating hand: three cards anchored to the bottom edge of the viewport,
// fanned slightly, peeking up. Hover lifts a card fully into view at larger
// scale so the player can read it without losing the board behind. The hand
// container itself is `pointer-events: none` so the map keeps receiving wheel
// and right-drag events between/under cards; each card and the deck/discard
// chips opt back in.
//
// Hotkeys 1/2/3 select a card; Z opens the CardModal on the selected card;
// drag any card onto the PlayArea or a zone panel to move it.

import React, { useEffect, useState } from 'react';
import Card from './Card.jsx';
import { setDragPayload, getDragPayload } from './dragdrop.js';

const HAND_SIZE = 3;

const CARD_W = 120;   // matches Card size="md"
const CARD_H = 168;
const PEEK   = 56;    // amount of card visible at rest
const SPREAD = 96;    // horizontal step between adjacent cards
const FAN    = [-7, 0, 7];  // rotation degrees per slot

export default function Hand({ state, dispatch, onZoom }) {
  const localPlayer = state.localPlayer || 'p1';
  const z = state.zones?.[localPlayer];
  const hand = z?.hand || [];
  const slots = [...hand];
  while (slots.length < HAND_SIZE) slots.push(null);

  const [hoverIdx, setHoverIdx] = useState(null);
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
    setHoverIdx(null);
  };

  const onDeckClick = () => {
    dispatch({ type: 'DRAW_TO_HAND_SIZE', player: localPlayer });
  };

  const deckCount = z?.deck?.length || 0;
  const discardTop = z?.discard?.[z.discard.length - 1];

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

  // restY pushes the card down so only `PEEK` shows; hoverY pulls it up.
  const restY  = CARD_H - PEEK;
  const hoverY = -16;

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-40 pointer-events-none select-none"
      style={{ height: CARD_H + 40 }}
    >
      {/* Deck chip — click to draw to hand size */}
      <button
        onClick={onDeckClick}
        className="absolute pointer-events-auto rounded-md w-[56px] h-[80px] bg-slate-800/95 ring-1 ring-slate-700 hover:ring-amber-500 text-slate-200 shadow-[0_6px_14px_rgba(0,0,0,0.55)]"
        style={{
          left: '50%',
          bottom: 12,
          transform: `translateX(calc(-50% - ${SPREAD * 2 + 30}px))`,
        }}
        title="Click to draw to hand size (3)"
      >
        <div className="flex flex-col items-center justify-center h-full gap-0.5">
          <span className="text-[8px] uppercase tracking-wider text-slate-400">Deck</span>
          <span className="text-sm font-semibold">{deckCount}</span>
        </div>
      </button>

      {/* Discard chip — drop a hand card here to discard */}
      <div
        className="absolute pointer-events-auto rounded-md w-[56px] h-[80px] bg-slate-900/95 ring-1 ring-dashed ring-slate-600 flex items-center justify-center shadow-[0_6px_14px_rgba(0,0,0,0.55)]"
        style={{
          left: '50%',
          bottom: 12,
          transform: `translateX(calc(-50% + ${SPREAD * 2 + 30}px))`,
        }}
        onDragOver={allowDrop}
        onDrop={onDropDiscard}
        title="Drop a card to discard"
      >
        {discardTop ? (
          <Card card={discardTop} cardData={state.cardData} size="xs" draggable={false} showHoverZoom={false} />
        ) : (
          <span className="text-[9px] uppercase tracking-wider text-slate-500">Discard</span>
        )}
      </div>

      {/* Three hand cards, fanned and peeking */}
      {slots.map((card, i) => {
        const has = !!card;
        const isHover = hoverIdx === i && has;
        const isSelected = selected === i && has;
        const angle = isHover ? 0 : FAN[i];
        const x = (i - 1) * SPREAD;
        const y = isHover ? hoverY : restY;
        const s = isHover ? 1.45 : 1;
        return (
          <div
            key={card?.cardKey || `slot-${i}`}
            className="absolute pointer-events-auto"
            style={{
              left: '50%',
              bottom: 0,
              width: CARD_W,
              height: CARD_H,
              transform: `translate(calc(-50% + ${x}px), ${y}px) rotate(${angle}deg) scale(${s})`,
              transformOrigin: 'bottom center',
              transition: 'transform 220ms cubic-bezier(0.2,0.9,0.3,1)',
              zIndex: isHover ? 70 : 50 + i,
              filter: isHover
                ? 'drop-shadow(0 18px 30px rgba(0,0,0,0.75))'
                : 'drop-shadow(0 6px 12px rgba(0,0,0,0.55))',
              cursor: has ? 'grab' : 'default',
              willChange: 'transform',
            }}
            onMouseEnter={() => has && setHoverIdx(i)}
            onMouseLeave={() => setHoverIdx(idx => idx === i ? null : idx)}
            onClick={() => has && setSelected(i)}
          >
            <Card
              card={card}
              cardData={state.cardData}
              size="md"
              visible={has}
              draggable={has}
              selected={isSelected}
              showHoverZoom={false}
              onDragStart={handleDragStart}
              onDoubleClick={() => card && onZoom?.(card)}
            />
          </div>
        );
      })}
    </div>
  );
}
