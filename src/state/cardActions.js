// Card-zone reducer fragments. The store dispatcher delegates the relevant
// action types here. Keeps store.js readable.
//
// Zones model (per-player):
//   deck      Card[]   (owner-private; opponent only sees length)
//   hand      Card[]   (owner-private; faceUp=false in shared mirror)
//   discard   Card[]   (face-up to all)
//   supply    Card[]   (face-up to all, sorted by name)
//   removed   Card[]   (owner-private)
//   setAside  Card[]   (owner-private)
// playArea: shared Card[] with optional {x,y}; faceUp varies.

export const EMPTY_ZONES = () => ({
  deck: [],
  hand: [],
  discard: [],
  supply: [],
  removed: [],
  setAside: [],
});

const HAND_SIZE = 3;

function findCardLocation(state, cardKey) {
  // Returns { zone: 'playArea' | { player, zone }, index }
  for (let i = 0; i < (state.playArea?.length || 0); i++) {
    if (state.playArea[i].cardKey === cardKey) return { kind: 'playArea', index: i };
  }
  for (const player of ['p1', 'p2']) {
    const z = state.zones?.[player];
    if (!z) continue;
    for (const zone of Object.keys(z)) {
      const idx = z[zone].findIndex(c => c.cardKey === cardKey);
      if (idx >= 0) return { kind: 'zone', player, zone, index: idx };
    }
  }
  return null;
}

function removeFromLocation(state, loc) {
  if (loc.kind === 'playArea') {
    const playArea = state.playArea.slice();
    const [card] = playArea.splice(loc.index, 1);
    return [{ ...state, playArea }, card];
  }
  const z = state.zones[loc.player];
  const arr = z[loc.zone].slice();
  const [card] = arr.splice(loc.index, 1);
  return [{
    ...state,
    zones: {
      ...state.zones,
      [loc.player]: { ...z, [loc.zone]: arr },
    },
  }, card];
}

function insertCard(state, dest, card) {
  // dest = { kind: 'playArea', position?: {x,y} } | { kind: 'zone', player, zone, position?:'top'|'bottom' }
  if (dest.kind === 'playArea') {
    const placed = { ...card };
    if (dest.position) {
      placed.x = dest.position.x;
      placed.y = dest.position.y;
    }
    return { ...state, playArea: [...(state.playArea || []), placed] };
  }
  const z = state.zones[dest.player];
  const target = z[dest.zone];
  const placed = { ...card };
  delete placed.x;
  delete placed.y;
  const next =
    dest.position === 'top' ? [placed, ...target] : [...target, placed];
  // Supply zone is sorted by name for stability.
  const final = dest.zone === 'supply'
    ? [...next].sort((a, b) => (a.cardId || '').localeCompare(b.cardId || ''))
    : next;
  return {
    ...state,
    zones: {
      ...state.zones,
      [dest.player]: { ...z, [dest.zone]: final },
    },
  };
}

export function moveCard(state, action) {
  const { cardKey, to, faceUp } = action;
  const loc = findCardLocation(state, cardKey);
  if (!loc) return state;

  let [next, card] = removeFromLocation(state, loc);

  if (typeof faceUp === 'boolean') {
    card = { ...card, faceUp };
    // If becoming face-down, drop position/x/y stays applicable for playArea drop.
  }

  // dest interpretation
  let dest;
  if (to.zone === 'playArea') {
    dest = { kind: 'playArea', position: to.position };
  } else {
    // hand/discard/supply/removed/setAside/deck
    const placement = to.position === 'top' ? 'top' : 'bottom';
    dest = { kind: 'zone', player: to.player, zone: to.zone, position: placement };
  }

  next = insertCard(next, dest, card);
  return next;
}

export function flipCard(state, action) {
  const { cardKey } = action;
  // Flip in playArea
  const paIdx = (state.playArea || []).findIndex(c => c.cardKey === cardKey);
  if (paIdx >= 0) {
    const playArea = state.playArea.slice();
    playArea[paIdx] = { ...playArea[paIdx], faceUp: !playArea[paIdx].faceUp };
    return { ...state, playArea };
  }
  // Otherwise search owned zones (only owner can flip)
  for (const player of ['p1', 'p2']) {
    const z = state.zones[player];
    for (const zone of Object.keys(z)) {
      const idx = z[zone].findIndex(c => c.cardKey === cardKey);
      if (idx >= 0) {
        const arr = z[zone].slice();
        arr[idx] = { ...arr[idx], faceUp: !arr[idx].faceUp };
        return {
          ...state,
          zones: { ...state.zones, [player]: { ...z, [zone]: arr } },
        };
      }
    }
  }
  return state;
}

// Top of deck = index 0. DRAW_TO_HAND_SIZE pulls top cards into hand
// (face-down to opponent — owner sees identity from cardMap) until
// hand.length === HAND_SIZE. Auto-reshuffles discard into deck if empty.
export function drawToHandSize(state, action) {
  const { player } = action;
  let z = state.zones[player];
  if (!z) return state;
  let next = state;
  let guard = 0;
  while (z.hand.length < HAND_SIZE && guard++ < 100) {
    if (z.deck.length === 0) {
      if (z.discard.length === 0) break;
      next = reshuffle(next, { player });
      z = next.zones[player];
      continue;
    }
    const deck = z.deck.slice();
    const top = deck.shift();
    const drawn = { ...top, faceUp: false };
    const hand = [...z.hand, drawn];
    next = {
      ...next,
      zones: {
        ...next.zones,
        [player]: { ...z, deck, hand },
      },
    };
    z = next.zones[player];
  }
  return next;
}

export function reshuffle(state, action) {
  const { player } = action;
  const z = state.zones[player];
  if (!z) return state;
  // Pull discard into deck, shuffle.
  const combined = [...z.deck, ...z.discard].map(c => ({ ...c, faceUp: false }));
  for (let i = combined.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [combined[i], combined[j]] = [combined[j], combined[i]];
  }
  return {
    ...state,
    zones: {
      ...state.zones,
      [player]: { ...z, deck: combined, discard: [] },
    },
  };
}

// Replace the entire deck array (used after faction-claim deck-build).
export function setDeck(state, action) {
  const { player, deck } = action;
  const z = state.zones[player] || EMPTY_ZONES();
  return {
    ...state,
    zones: {
      ...state.zones,
      [player]: { ...z, deck: deck.slice() },
    },
  };
}

// Set faction/clientId for a player slot.
export function setPlayer(state, action) {
  const { player, clientId, faction } = action;
  return {
    ...state,
    players: {
      ...state.players,
      [player]: { clientId, faction },
    },
  };
}
