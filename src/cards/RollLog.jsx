// Scrolling roll history. Pulls from state.rolls (last 10).

import React from 'react';

function relTime(ts) {
  const d = Date.now() - ts;
  if (d < 5_000) return 'just now';
  if (d < 60_000) return `${Math.round(d / 1000)}s`;
  if (d < 3_600_000) return `${Math.round(d / 60_000)}m`;
  return `${Math.round(d / 3_600_000)}h`;
}

export default function RollLog({ state }) {
  const rolls = (state.rolls || []).slice().reverse();
  if (rolls.length === 0) {
    return <div className="text-[10px] text-slate-500 italic text-center py-3">no rolls yet</div>;
  }
  const playerLabel = (p) => {
    if (!p) return '—';
    const fac = state.players?.[p]?.faction;
    return state.cardData?.factions?.[fac]?.label || p;
  };
  return (
    <ul className="space-y-1 text-[11px] text-slate-300">
      {rolls.map((r) => (
        <li key={r.id} className="flex items-baseline gap-2 font-mono">
          <span className="text-slate-500 w-10 shrink-0">{relTime(r.timestamp)}</span>
          <span className="text-slate-400 w-12 shrink-0 truncate">{playerLabel(r.roller)}</span>
          <span className="text-slate-500">{r.dice}</span>
          <span className="ml-auto flex flex-wrap justify-end gap-1">
            {r.results.map((n, i) => (
              <span key={i} className="px-1 rounded bg-slate-800 ring-1 ring-slate-700">{n}</span>
            ))}
          </span>
          <span className="text-slate-400 w-8 text-right">Σ{r.results.reduce((a,b)=>a+b,0)}</span>
        </li>
      ))}
    </ul>
  );
}
