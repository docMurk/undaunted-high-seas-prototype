// Top-pinned strip showing opponent's deck count, discard top, supply (face-up
// titles), removed/setAside back-counts. View-only.

import React from 'react';
import Card from './Card.jsx';

function Stack({ label, count, top, cardData, faceDown }) {
  return (
    <div className="flex flex-col items-center gap-1 min-w-[64px]">
      <div className="text-[9px] uppercase tracking-wider text-slate-500">
        {label} {count != null ? `(${count})` : ''}
      </div>
      <div className="w-[60px] h-[84px] flex items-center justify-center">
        {top ? (
          <Card
            card={faceDown ? { ...top, faceUp: false, faction: 'neutral' } : top}
            cardData={cardData}
            size="xs"
            draggable={false}
            showHoverZoom={false}
          />
        ) : (
          <div className="rounded-md w-full h-full ring-1 ring-dashed ring-slate-700" />
        )}
      </div>
    </div>
  );
}

export default function OpponentStrip({ state }) {
  const localPlayer = state.localPlayer || 'p1';
  const opp = localPlayer === 'p1' ? 'p2' : 'p1';
  const z = state.zones?.[opp];
  if (!z) return null;
  const oppFaction = state.players?.[opp]?.faction;
  const oppFactionLabel = oppFaction
    ? state.cardData?.factions?.[oppFaction]?.label || oppFaction
    : 'Opponent';
  const supplyTop = z.supply.length > 0 ? z.supply[z.supply.length - 1] : null;

  return (
    <div className="flex items-center gap-3 p-2 bg-slate-900/70 ring-1 ring-slate-800 rounded-lg">
      <div className="text-[10px] uppercase tracking-wider text-slate-400 mr-1">
        {oppFactionLabel} <span className="text-slate-500">· hand {z.hand.length}</span>
      </div>
      <Stack
        label="Deck"
        count={z.deck.length}
        top={z.deck.length > 0 ? { cardKey: 'opp-deck', faction: oppFaction, faceUp: false } : null}
        cardData={state.cardData}
        faceDown
      />
      <Stack
        label="Discard"
        count={z.discard.length}
        top={z.discard.length > 0 ? z.discard[z.discard.length - 1] : null}
        cardData={state.cardData}
      />
      <div className="flex flex-col gap-1">
        <div className="text-[9px] uppercase tracking-wider text-slate-500">Supply ({z.supply.length})</div>
        <div className="flex gap-1 max-w-[280px] overflow-x-auto">
          {z.supply.length === 0 && <div className="text-[10px] text-slate-500">—</div>}
          {z.supply.map(c => (
            <Card key={c.cardKey} card={c} cardData={state.cardData} size="xs" draggable={false} showHoverZoom={false} />
          ))}
        </div>
      </div>
      <Stack
        label="Removed"
        count={z.removed.length}
        top={z.removed.length > 0 ? { cardKey: 'opp-rem', faction: oppFaction, faceUp: false } : null}
        cardData={state.cardData}
        faceDown
      />
      <Stack
        label="Set aside"
        count={z.setAside.length}
        top={z.setAside.length > 0 ? { cardKey: 'opp-sa', faction: oppFaction, faceUp: false } : null}
        cardData={state.cardData}
        faceDown
      />
    </div>
  );
}
