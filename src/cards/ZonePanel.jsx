// Right-side tabbed panel showing the local player's zones (supply / discard
// / removed / setAside) plus the roll log. Modeled on ShipRulesPanel.

import React, { useState } from 'react';
import Card from './Card.jsx';
import RollLog from './RollLog.jsx';
import { setDragPayload, getDragPayload } from './dragdrop.js';

const TABS = [
  { id: 'supply',   label: 'Supply' },
  { id: 'discard',  label: 'Discard' },
  { id: 'removed',  label: 'Removed' },
  { id: 'setAside', label: 'Set aside' },
  { id: 'rolls',    label: 'Rolls' },
];

export default function ZonePanel({ state, dispatch }) {
  const [tab, setTab] = useState('supply');
  const localPlayer = state.localPlayer || 'p1';
  const z = state.zones?.[localPlayer];

  if (!z) return null;

  const cards = tab === 'rolls' ? null : z[tab];

  const onDragStart = (e, card) => {
    setDragPayload(e, {
      cardKey: card.cardKey,
      from: { player: localPlayer, zone: tab },
    });
  };

  const onDrop = (e) => {
    e.preventDefault();
    const payload = getDragPayload(e);
    if (!payload || tab === 'rolls') return;
    dispatch({
      type: 'MOVE_CARD',
      cardKey: payload.cardKey,
      from: payload.from,
      to: { player: localPlayer, zone: tab, position: 'top' },
      faceUp: tab === 'discard' || tab === 'supply' ? true : !e.shiftKey,
    });
  };

  const allowDrop = (e) => { e.preventDefault(); };

  return (
    <div className="bg-slate-900/80 ring-1 ring-slate-800 rounded-lg p-2 flex flex-col gap-2 max-h-[60vh]">
      <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-2 py-1 rounded ${
              tab === t.id ? 'bg-slate-700 text-slate-100' : 'bg-slate-800/60 text-slate-400 hover:bg-slate-800'
            }`}
          >
            {t.label}{t.id !== 'rolls' && z[t.id] ? ` ${z[t.id].length}` : ''}
          </button>
        ))}
      </div>
      <div
        className="flex-1 min-h-0 overflow-y-auto rounded ring-1 ring-dashed ring-slate-700/40 p-2"
        onDragOver={allowDrop}
        onDrop={onDrop}
      >
        {tab === 'rolls' ? (
          <RollLog state={state} />
        ) : cards.length === 0 ? (
          <div className="text-[10px] text-slate-500 italic text-center py-3">
            empty — drop cards here
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {cards.map(c => (
              <Card
                key={c.cardKey}
                card={c}
                cardData={state.cardData}
                size="sm"
                onDragStart={onDragStart}
                onDoubleClick={() => dispatch({ type: 'FLIP_CARD', cardKey: c.cardKey })}
              />
            ))}
          </div>
        )}
      </div>
      {tab === 'removed' && (
        <div className="text-[9px] text-amber-400/80 leading-snug">
          Casualty priority (BoB p.20): hand → discard → deck.
        </div>
      )}
    </div>
  );
}
