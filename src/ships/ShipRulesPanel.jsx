// Right-side rules reference for ship classes + a dice-pool roller.
// Collapsible like the tile palette. Open/closed state lives in store.rulesPanelOpen.
import React, { useState } from 'react';

const CLASS_INFO = [
  {
    code: 'S', label: 'Sloop',
    stats: [
      ['Maneuver', 3], ['Defense', 3], ['Broadside', 1], ['Chasers (fore/aft)', '1 / 1'],
    ],
    actions: ['Signal — remove one Discord card'],
    traits: [
      'Quick-handed — may Maneuver before 1st movement',
      'Shallow draft — may navigate reefs',
    ],
  },
  {
    code: 'F', label: 'Frigate',
    stats: [
      ['Maneuver', 2], ['Defense', 4], ['Broadside', 2], ['Chasers (fore/aft)', '2 / 1'],
    ],
    actions: [
      'Fire chain shot — Suppress X+1',
      'Board',
    ],
    traits: [],
  },
  {
    code: 'C', label: 'Capital Ship',
    stats: [
      ['Maneuver', 1], ['Defense', 5], ['Broadside', 4], ['Chasers (fore/aft)', '4 / 2'],
    ],
    actions: [
      'Fire chain shot — Suppress X+1',
      'Order — one ship within signal range moves 1 + maneuvers 1',
    ],
    traits: ['Flagship — enables Inspire actions within 4 hexes'],
  },
];

const GENERAL = {
  toHit: [
    'Cannons: roll X dice ≥ Range + Defense + defender speed',
    'Boarding: roll 2 dice ≥ 7 + attacker speed (suppresses both ships, sets speeds to 0)',
    'Raking fire: +1 die',
  ],
  general: [
    'Fire (X) — attack one firing arc',
    'Haul sails — alter speed +/-1',
    'Maneuver (X) — turn 60° (once per hex, only after 1 movement)',
  ],
};

function ClassCard({ info }) {
  return (
    <div className="bg-slate-800/70 rounded p-2 ring-1 ring-slate-700/60">
      <div className="flex items-baseline justify-between mb-1.5">
        <div className="text-sm font-semibold text-slate-100">{info.label}</div>
        <div className="text-[10px] uppercase tracking-wider text-slate-500">
          token: {info.code}1–{info.code}3
        </div>
      </div>
      <table className="w-full text-[11px] text-slate-300 mb-1.5">
        <tbody>
          {info.stats.map(([k, v]) => (
            <tr key={k}>
              <td className="text-slate-500 pr-2">{k}</td>
              <td className="text-right font-mono text-slate-100">{v}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {info.actions.length > 0 && (
        <div className="mb-1">
          <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-0.5">Class actions</div>
          <ul className="text-[11px] text-slate-300 space-y-0.5 ml-1">
            {info.actions.map((a, i) => <li key={i}>· {a}</li>)}
          </ul>
        </div>
      )}
      {info.traits.length > 0 && (
        <div>
          <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-0.5">Traits</div>
          <ul className="text-[11px] text-slate-300 space-y-0.5 ml-1">
            {info.traits.map((t, i) => <li key={i}>· {t}</li>)}
          </ul>
        </div>
      )}
    </div>
  );
}

function DiceRoller() {
  const [count, setCount] = useState(3);
  const [sides, setSides] = useState(10);
  const [results, setResults] = useState(null);
  const [history, setHistory] = useState([]);

  const roll = () => {
    const out = [];
    for (let i = 0; i < count; i++) {
      out.push(1 + Math.floor(Math.random() * sides));
    }
    setResults(out);
    setHistory(h => [{ count, sides, out, ts: Date.now() }, ...h].slice(0, 5));
  };

  const sum = results ? results.reduce((a, b) => a + b, 0) : 0;

  return (
    <div className="bg-slate-800/70 rounded p-2 ring-1 ring-slate-700/60">
      <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1.5">Dice roller</div>
      <div className="flex items-center gap-1.5 mb-2">
        <input
          type="number" min={1} max={20} value={count}
          onChange={(e) => setCount(Math.max(1, Math.min(20, +e.target.value || 1)))}
          className="w-12 bg-slate-900 ring-1 ring-slate-700 rounded px-1.5 py-1 text-sm text-slate-100"
        />
        <span className="text-slate-400 text-sm">d</span>
        <select
          value={sides}
          onChange={(e) => setSides(+e.target.value)}
          className="bg-slate-900 ring-1 ring-slate-700 rounded px-1.5 py-1 text-sm text-slate-100"
        >
          {[4, 6, 8, 10, 12, 20].map(n => <option key={n} value={n}>{n}</option>)}
        </select>
        <button
          onClick={roll}
          className="ml-auto px-2.5 py-1 rounded bg-emerald-700 hover:bg-emerald-600 text-emerald-50 text-sm font-medium"
        >Roll</button>
      </div>
      {results && (
        <div className="text-sm">
          <div className="flex flex-wrap gap-1 mb-1">
            {results.map((r, i) => (
              <span key={i}
                    className="inline-flex items-center justify-center min-w-[1.6rem] h-6 px-1 rounded bg-slate-900 ring-1 ring-slate-600 font-mono text-slate-100">
                {r}
              </span>
            ))}
          </div>
          <div className="text-[11px] text-slate-400">
            sum {sum} · max {Math.max(...results)} · min {Math.min(...results)}
          </div>
        </div>
      )}
      {history.length > 1 && (
        <details className="mt-1.5 text-[10px] text-slate-500">
          <summary className="cursor-pointer hover:text-slate-300">previous</summary>
          <ul className="mt-0.5 space-y-0.5 font-mono">
            {history.slice(1).map((h, i) => (
              <li key={i}>{h.count}d{h.sides}: {h.out.join(' ')} (Σ{h.out.reduce((a,b)=>a+b,0)})</li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

export default function ShipRulesPanel({ state, dispatch }) {
  const open = state.rulesPanelOpen !== false;
  return (
    <div
      className={`flex-shrink-0 flex flex-col overflow-hidden transition-all duration-300 ease-in-out ${
        open ? 'w-72 opacity-100' : 'w-0 opacity-0 translate-x-2'
      }`}
      aria-hidden={!open}
    >
      <div className="w-72 flex-1 min-h-0 flex flex-col gap-2 bg-slate-900/80 ring-1 ring-slate-800 rounded-lg p-2 overflow-y-auto">
        <div className="flex items-center justify-between">
          <div className="text-xs uppercase tracking-wider text-slate-400">Ship rules</div>
          <button
            onClick={() => dispatch({ type: 'TOGGLE_RULES_PANEL' })}
            className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300"
            title="Collapse panel"
          >×</button>
        </div>

        {CLASS_INFO.map(info => <ClassCard key={info.code} info={info} />)}

        <div className="bg-slate-800/70 rounded p-2 ring-1 ring-slate-700/60">
          <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">To hit</div>
          <ul className="text-[11px] text-slate-300 space-y-0.5 ml-1 mb-2">
            {GENERAL.toHit.map((t, i) => <li key={i}>· {t}</li>)}
          </ul>
          <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">General actions</div>
          <ul className="text-[11px] text-slate-300 space-y-0.5 ml-1">
            {GENERAL.general.map((t, i) => <li key={i}>· {t}</li>)}
          </ul>
        </div>

        <DiceRoller />

        <div className="text-[10px] text-slate-500 leading-snug px-1 mt-1">
          Hotkeys (locked map):
          <span className="block">· Q / E — turn 60°</span>
          <span className="block">· F — flip suppressed</span>
          <span className="block">· Del — return to reserve</span>
        </div>
      </div>
    </div>
  );
}
