// Shared card display + drag/drop component. One component reused everywhere:
// hand, zones, play area, opponent strip. Plain-text fallback when art isn't
// available. Hover-zoom and Z-modal are view-only — drag initiates moves.

import React, { useState } from 'react';
import { findCard, factionInfo } from './data.js';

const SIZE_PRESETS = {
  sm:  { w: 84,  h: 118 },
  md:  { w: 120, h: 168 },
  lg:  { w: 160, h: 224 },
  xl:  { w: 240, h: 336 },
  // Opponent strip / micro-thumb
  xs:  { w: 60,  h: 84  },
};

function CardArt({ def, faction, faceUp }) {
  if (!faceUp) {
    return (
      <div className="absolute inset-0 rounded-md"
           style={{
             background: `repeating-linear-gradient(45deg, ${faction?.primary || '#444'} 0 6px, ${faction?.secondary || '#222'} 6px 12px)`,
           }}>
        <div className="absolute inset-2 rounded ring-1 ring-white/20 flex items-center justify-center">
          <div className="text-[10px] uppercase tracking-widest text-white/70 select-none">
            {faction?.label || 'Card'}
          </div>
        </div>
      </div>
    );
  }
  if (!def) {
    return (
      <div className="absolute inset-0 rounded-md bg-slate-900 flex items-center justify-center">
        <div className="text-[10px] text-slate-400">unknown</div>
      </div>
    );
  }
  const fac = faction;
  return (
    <div className="absolute inset-0 rounded-md overflow-hidden flex flex-col"
         style={{ background: fac?.accent || '#eee', color: '#111' }}>
      <div className="px-1.5 py-1 flex items-center justify-between"
           style={{ background: fac?.primary || '#333', color: fac?.accent || '#fff' }}>
        <div className="text-[9px] font-bold uppercase tracking-wider truncate">{def.name}</div>
        <div className="text-[9px] opacity-80 ml-1">{def.type?.[0]?.toUpperCase()}</div>
      </div>
      <div className="flex-1 px-1.5 py-1 flex flex-col gap-0.5 overflow-hidden">
        {def.init != null && (
          <div className="text-[9px] uppercase tracking-wide opacity-60">init {def.init}{def.def != null ? ` · def ${def.def}` : ''}{def.squad ? ` · ${def.squad}` : ''}</div>
        )}
        <div className="flex-1 min-h-0 overflow-hidden">
          {(def.actions || []).map((a, i) => (
            <div key={i} className="text-[9px] leading-tight mb-0.5">
              <span className="font-semibold">{a.name}</span>
              {a.value != null && a.value !== '' && <span> · {a.value}</span>}
              {a.range && <span className="opacity-70"> r{a.range}</span>}
              {a.dice && <span className="opacity-70"> {a.dice}</span>}
            </div>
          ))}
        </div>
        {def.flavor_name && (
          <div className="text-[8px] italic opacity-60 truncate">{def.flavor_name}</div>
        )}
      </div>
    </div>
  );
}

export default function Card({
  card,
  cardData,
  size = 'md',
  draggable = true,
  onDragStart,
  onDragEnd,
  onClick,
  onDoubleClick,
  selected = false,
  visible = true,        // false = render placeholder only (e.g. dummy slot)
  showHoverZoom = true,
}) {
  const [hover, setHover] = useState(false);
  const dim = SIZE_PRESETS[size] || SIZE_PRESETS.md;

  if (!visible || !card) {
    return (
      <div
        className="rounded-md ring-1 ring-dashed ring-slate-700 bg-slate-900/40"
        style={{ width: dim.w, height: dim.h }}
      />
    );
  }

  const def = card.faceUp ? findCard(cardData, card.cardId) : null;
  const fac = factionInfo(cardData, def?.faction || null) ||
              factionInfo(cardData, card.faction || null) ||
              factionInfo(cardData, 'neutral');

  const handleDragStart = (e) => {
    if (!draggable || !onDragStart) {
      e.preventDefault();
      return;
    }
    onDragStart(e, card);
  };

  return (
    <div
      className={`relative rounded-md select-none transition-shadow ${
        selected ? 'ring-2 ring-amber-400' : 'ring-1 ring-slate-700/70'
      } ${draggable ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'}`}
      style={{
        width: dim.w,
        height: dim.h,
        boxShadow: hover && showHoverZoom ? '0 8px 24px rgba(0,0,0,0.5)' : undefined,
        transform: hover && showHoverZoom ? 'translateY(-4px) scale(1.04)' : undefined,
        transition: 'transform 120ms ease, box-shadow 120ms ease',
        zIndex: hover ? 50 : undefined,
      }}
      draggable={draggable}
      onDragStart={handleDragStart}
      onDragEnd={onDragEnd}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <CardArt def={def} faction={fac} faceUp={!!card.faceUp} />
      {/* Squad badge */}
      {def?.squad && card.faceUp && (
        <div className="absolute top-1 right-1 w-4 h-4 rounded-full bg-black/70 text-white text-[9px] font-bold flex items-center justify-center">
          {def.squad}
        </div>
      )}
    </div>
  );
}

export { SIZE_PRESETS };
