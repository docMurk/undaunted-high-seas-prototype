// Card data loader + deck construction.
// Loads public/card_data.json (Medieval-hack schema, instance-based) and
// builds a faction-filtered deck with stable cardKey uuids per instance.

const BASE = import.meta.env.BASE_URL || '/';

let _cache = null;

export async function loadCardData() {
  if (_cache) return _cache;
  const url = `${BASE}card_data.json`.replace(/\/+/g, '/');
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to load card_data.json (${res.status})`);
  const data = await res.json();
  _cache = data;
  return data;
}

// uuid v4 (browser crypto when available, fallback otherwise)
export function uuid() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  // RFC4122-ish fallback
  const r = (n) => Math.floor(Math.random() * n);
  const hex = (n) => r(n).toString(16);
  return `${hex(0x100000000)}-${hex(0x10000)}-4${hex(0x1000).toString(16).padStart(3,'0').slice(0,3)}-${(8 + r(4)).toString(16)}${hex(0x100).toString(16).padStart(2,'0').slice(0,2)}-${hex(0x1000000000000)}`;
}

function shuffle(arr, randomFn = Math.random) {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(randomFn() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// Filter card_data by faction (incl neutrals), assign cardKeys, shuffle.
// Returns { cards, cardMap } where:
//   cards: [{ cardKey, cardId, owner, faceUp:false }] in deck order (top = index 0)
//   cardMap: { [cardKey]: cardId } — owner-private; written to localStorage.
export function buildDeck(cardData, faction, owner, randomFn = Math.random) {
  const expanded = cardData.cards
    .filter(c => c.faction === faction || c.faction === 'neutral')
    .map(c => ({
      cardKey: uuid(),
      cardId: c.id,
      owner,
      faceUp: false,
    }));
  const shuffled = shuffle(expanded, randomFn);
  const cardMap = {};
  for (const c of shuffled) cardMap[c.cardKey] = c.cardId;
  return { cards: shuffled, cardMap };
}

// Lookup a card definition by id from card_data.json.
export function findCard(cardData, cardId) {
  if (!cardData || !cardId) return null;
  return cardData.cards.find(c => c.id === cardId) || null;
}

export function factionInfo(cardData, faction) {
  if (!cardData || !faction) return null;
  return (cardData.factions && cardData.factions[faction]) || null;
}
