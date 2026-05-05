// Faction picker shown on first arrival to a room. In single-tab solo play
// it doubles as a faction selector for sandbox mode.

import React from 'react';

export default function FactionPicker({ cardData, claimedFactions = [], onPick, onCancel, title = 'Choose a faction' }) {
  if (!cardData) return null;
  const factions = Object.entries(cardData.factions)
    .filter(([id]) => id !== 'neutral')
    .map(([id, fac]) => ({ id, ...fac }));

  return (
    <div className="fixed inset-0 z-[120] bg-slate-950/80 flex items-center justify-center">
      <div className="bg-slate-900 ring-1 ring-slate-700 rounded-xl p-6 max-w-md w-full">
        <div className="text-base font-semibold text-slate-100 mb-1">{title}</div>
        <div className="text-[11px] text-slate-400 mb-4">
          Each player builds their own deck on claim.
        </div>
        <div className="grid grid-cols-2 gap-3">
          {factions.map(f => {
            const taken = claimedFactions.includes(f.id);
            return (
              <button
                key={f.id}
                disabled={taken}
                onClick={() => !taken && onPick?.(f.id)}
                className={`rounded-lg p-4 ring-1 text-left transition ${
                  taken
                    ? 'bg-slate-800/50 ring-slate-700 text-slate-500 cursor-not-allowed'
                    : 'ring-slate-700 hover:ring-amber-500 cursor-pointer'
                }`}
                style={{
                  background: taken ? undefined : f.primary,
                  color: taken ? undefined : f.accent,
                }}
              >
                <div className="text-lg font-bold mb-1">{f.label}</div>
                <div className="text-[10px] uppercase tracking-wider opacity-70">
                  {taken ? 'taken' : 'available'}
                </div>
              </button>
            );
          })}
        </div>
        {onCancel && (
          <div className="mt-4 text-right">
            <button
              onClick={onCancel}
              className="text-[11px] text-slate-400 hover:text-slate-200"
            >cancel</button>
          </div>
        )}
      </div>
    </div>
  );
}
