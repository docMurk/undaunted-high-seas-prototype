// Synced dice-roll log. Reducer parses the 'XdY' shorthand and appends to
// state.rolls (capped at last 10).

const ROLL_LOG_MAX = 10;

export function parseDice(spec) {
  if (typeof spec !== 'string') return null;
  const m = spec.trim().toLowerCase().match(/^(\d+)d(\d+)$/);
  if (!m) return null;
  const count = +m[1];
  const sides = +m[2];
  if (!count || !sides || count > 50 || sides > 100) return null;
  return { count, sides };
}

export function rollDice(state, action) {
  const { roller, dice, results, timestamp } = action;
  const parsed = parseDice(dice);
  if (!parsed) return state;
  // Caller may pre-roll to ensure both clients see identical results in the
  // sync flow; if not provided, roll locally.
  const out = Array.isArray(results) && results.length === parsed.count
    ? results
    : Array.from({ length: parsed.count }, () => 1 + Math.floor(Math.random() * parsed.sides));
  const entry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    roller: roller || null,
    dice,
    results: out,
    timestamp: typeof timestamp === 'number' ? timestamp : Date.now(),
  };
  const rolls = [...(state.rolls || []), entry].slice(-ROLL_LOG_MAX);
  return { ...state, rolls };
}

export function clearRolls(state) {
  return { ...state, rolls: [] };
}
