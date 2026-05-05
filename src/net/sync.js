// Privacy stripping + localStorage rehydration for the patch-write sync layer.
//
// PRD §Sync protocol:
//   serializeForShared(localState, owner) — strips owner-private cardIds and
//     replaces deck with { length: N }.
//   hydrateFromLocal(sharedState, owner)  — joins shared state against the
//     local cardMap (localStorage) to restore owner-private identities.

const PRIVATE_ZONES = ['hand', 'removed', 'setAside'];

function cardMapKey(roomId) {
  return `highSeas:${roomId}:cardMap`;
}
function deckOrderKey(roomId, owner) {
  return `highSeas:${roomId}:deckOrder:${owner}`;
}

export function loadCardMap(roomId) {
  if (!roomId) return {};
  try {
    const raw = localStorage.getItem(cardMapKey(roomId));
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveCardMap(roomId, cardMap) {
  if (!roomId) return;
  try {
    localStorage.setItem(cardMapKey(roomId), JSON.stringify(cardMap));
  } catch {}
}

export function mergeCardMap(roomId, additions) {
  if (!roomId) return;
  const cur = loadCardMap(roomId);
  saveCardMap(roomId, { ...cur, ...additions });
}

export function loadDeckOrder(roomId, owner) {
  if (!roomId || !owner) return null;
  try {
    const raw = localStorage.getItem(deckOrderKey(roomId, owner));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveDeckOrder(roomId, owner, deck) {
  if (!roomId || !owner) return;
  try {
    localStorage.setItem(deckOrderKey(roomId, owner), JSON.stringify(deck));
  } catch {}
}

// Strip owner-private cardIds + drop deck arrays. Used before publishing.
export function serializeForShared(localState, owner) {
  if (!localState || !owner) return localState;
  const out = { ...localState };

  // Zones — strip owner-private cardIds, replace deck with length.
  if (out.zones) {
    const zones = { ...out.zones };
    const ownZones = { ...zones[owner] };
    if (ownZones.deck) {
      ownZones.deck = { length: ownZones.deck.length };
    }
    for (const zoneName of PRIVATE_ZONES) {
      if (Array.isArray(ownZones[zoneName])) {
        ownZones[zoneName] = ownZones[zoneName].map(c => ({ ...c, cardId: null }));
      }
    }
    zones[owner] = ownZones;
    out.zones = zones;
  }

  // PlayArea — strip cardId on owned face-down cards.
  if (Array.isArray(out.playArea)) {
    out.playArea = out.playArea.map(c =>
      c.owner === owner && !c.faceUp ? { ...c, cardId: null } : c
    );
  }

  return out;
}

// Reverse: take a shared snapshot and join against localStorage cardMap to
// restore owner-private cardIds. Also rehydrates the local deck order.
export function hydrateFromShared(sharedState, owner, roomId) {
  if (!sharedState) return null;
  const cardMap = loadCardMap(roomId);
  const out = { ...sharedState };

  if (out.zones) {
    const zones = { ...out.zones };
    const ownZones = zones[owner] ? { ...zones[owner] } : null;
    if (ownZones) {
      // Restore deck array from local order (if available).
      if (ownZones.deck && !Array.isArray(ownZones.deck)) {
        const order = loadDeckOrder(roomId, owner);
        if (order && order.length === ownZones.deck.length) {
          ownZones.deck = order;
        } else {
          // Length mismatch: fall back to length-only render.
          ownZones.deck = Array.from({ length: ownZones.deck.length || 0 }, (_, i) => ({
            cardKey: `__local_unknown_${i}`,
            cardId: null,
            owner,
            faceUp: false,
          }));
        }
      }
      // Restore owner-private zone cardIds.
      for (const zoneName of PRIVATE_ZONES) {
        if (Array.isArray(ownZones[zoneName])) {
          ownZones[zoneName] = ownZones[zoneName].map(c =>
            c.cardId == null && cardMap[c.cardKey]
              ? { ...c, cardId: cardMap[c.cardKey] }
              : c
          );
        }
      }
      zones[owner] = ownZones;
    }
    // Opponent deck arrives as { length: N } — leave as-is for OpponentStrip.
    out.zones = zones;
  }

  if (Array.isArray(out.playArea)) {
    out.playArea = out.playArea.map(c =>
      c.owner === owner && !c.faceUp && c.cardId == null && cardMap[c.cardKey]
        ? { ...c, cardId: cardMap[c.cardKey] }
        : c
    );
  }

  return out;
}

// Build a flat patch object suitable for firebase update(). The slices
// listed here are the ones we sync. Excludes editor-only state (palette,
// rulesPanelOpen, selected*, dragState, mode, etc).
export function buildSharedPatch(localState, owner) {
  const stripped = serializeForShared(localState, owner);
  return {
    // Shared / mirrored slices
    placed:    stripped.placed,
    terrain:   stripped.terrain,
    ships:     stripped.ships,
    locked:    stripped.locked,
    playArea:  stripped.playArea,
    rolls:     stripped.rolls,
    gameOver:  stripped.gameOver,
    players:   stripped.players,
    [`zones/${owner}`]: stripped.zones?.[owner],
  };
}
