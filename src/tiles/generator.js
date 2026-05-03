// Procedural tile generator. Each tile is 5 slots (0..4) in a vertical zigzag
// column. Categories: water, coastline, island, reef, fog, fort.
import { RECIPE } from './recipe.js';

let _idCounter = 1;
export function nextTileId() { return `t${_idCounter++}`; }

const rand = () => Math.random();
const choice = (arr) => arr[Math.floor(rand() * arr.length)];
const range = (a, b) => a + Math.floor(rand() * (b - a + 1));

function emptyHexes() {
  return [0, 1, 2, 3, 4].map(slot => ({
    slot, terrain: 'water', hasFort: false,
  }));
}

function makeWater() {
  return { id: nextTileId(), category: 'water', seed: range(1, 9999), hexes: emptyHexes() };
}

// Coastline: pick a contiguous run of N slots starting from one end (top or bottom).
// Coast hexes get terrain alternating sand/rock to look natural.
function makeCoastline() {
  const n = choice([1, 1, 2, 2, 2, 3]);
  const fromTop = rand() < 0.5;
  const slots = fromTop
    ? Array.from({ length: n }, (_, i) => i)
    : Array.from({ length: n }, (_, i) => 4 - i);
  const hexes = emptyHexes();
  slots.forEach((s, i) => {
    hexes[s].terrain = (i === 0 && rand() < 0.4) ? 'rock' : 'sand';
  });
  return { id: nextTileId(), category: 'coastline', seed: range(1, 9999), hexes,
           extendsTop: fromTop, extendsBottom: !fromTop };
}

// Island: 1-, 2-, or 3-hex. Adjacent slots only. Optionally flagged as
// extending to top or bottom edge so it connects across tilesets.
function makeIsland() {
  const n = choice([1, 1, 2, 2, 3, 3, 3]);
  const start = range(0, 5 - n);
  const slots = Array.from({ length: n }, (_, i) => start + i);
  const hexes = emptyHexes();
  slots.forEach((s, i) => {
    // Mostly sand, occasional rock for visual variety.
    hexes[s].terrain = rand() < 0.25 ? 'rock' : 'sand';
  });
  const extendsTop = slots.includes(0) && n >= 2;
  const extendsBottom = slots.includes(4) && n >= 2;
  return { id: nextTileId(), category: 'island', seed: range(1, 9999), hexes,
           extendsTop, extendsBottom };
}

// Reef: 1-2 hexes; lower visual prominence than islands.
function makeReef() {
  const n = choice([1, 1, 2]);
  const start = range(0, 5 - n);
  const slots = Array.from({ length: n }, (_, i) => start + i);
  const hexes = emptyHexes();
  slots.forEach(s => { hexes[s].terrain = 'reef'; });
  return { id: nextTileId(), category: 'reef', seed: range(1, 9999), hexes };
}

// Fog bank: 2-3 contiguous hexes, semi-transparent overlay on water.
function makeFog() {
  const n = choice([2, 3, 3]);
  const start = range(0, 5 - n);
  const slots = Array.from({ length: n }, (_, i) => start + i);
  const hexes = emptyHexes();
  slots.forEach(s => { hexes[s].terrain = 'fog'; });
  return { id: nextTileId(), category: 'fog', seed: range(1, 9999), hexes };
}

// Fort variants: one of each {small island + fort, large island + fort,
// coastline + fort, reef + fort}. Fort always sits on exactly one hex.
const FORT_VARIANTS = ['small-island', 'large-island', 'coastline', 'reef'];

function makeFort(variantIdx) {
  const variant = FORT_VARIANTS[variantIdx % FORT_VARIANTS.length];
  let tile;
  if (variant === 'small-island') {
    tile = makeIsland();
    // Force 1-hex island.
    const hexes = emptyHexes();
    const s = range(1, 3);
    hexes[s].terrain = 'sand';
    hexes[s].hasFort = true;
    tile = { ...tile, hexes };
  } else if (variant === 'large-island') {
    // Force 3-hex island.
    const hexes = emptyHexes();
    const start = range(0, 2);
    [0, 1, 2].forEach(i => { hexes[start + i].terrain = rand() < 0.3 ? 'rock' : 'sand'; });
    hexes[start + 1].hasFort = true;
    tile = { id: nextTileId(), category: 'fort', seed: range(1, 9999), hexes,
             extendsTop: start === 0, extendsBottom: start === 2 };
  } else if (variant === 'coastline') {
    tile = makeCoastline();
    // Find a coast hex and put a fort on it.
    const coastSlot = tile.hexes.find(h => h.terrain === 'sand' || h.terrain === 'rock');
    if (coastSlot) coastSlot.hasFort = true;
    tile = { ...tile, category: 'fort' };
  } else if (variant === 'reef') {
    tile = makeReef();
    // Add a 1-hex sand-with-fort somewhere not adjacent to reefs.
    const hexes = tile.hexes.map(h => ({ ...h }));
    const reefSlots = hexes.filter(h => h.terrain === 'reef').map(h => h.slot);
    const candidates = [0, 1, 2, 3, 4].filter(s => !reefSlots.includes(s));
    const fortSlot = candidates[Math.floor(rand() * candidates.length)];
    hexes[fortSlot].terrain = 'sand';
    hexes[fortSlot].hasFort = true;
    tile = { ...tile, hexes, category: 'fort' };
  }
  tile.fortVariant = variant;
  return tile;
}

const MAKERS = {
  water: () => makeWater(),
  coastline: () => makeCoastline(),
  island: () => makeIsland(),
  reef: () => makeReef(),
  fog: () => makeFog(),
};

export function generateTile(category, fortIdx = 0) {
  if (category === 'fort') return makeFort(fortIdx);
  const maker = MAKERS[category];
  if (!maker) throw new Error(`Unknown tile category: ${category}`);
  return maker();
}

export function generatePalette() {
  const out = [];
  let fortIdx = 0;
  for (const { category, count } of RECIPE) {
    for (let i = 0; i < count; i++) {
      if (category === 'fort') {
        out.push(makeFort(fortIdx));
        fortIdx++;
      } else {
        out.push(MAKERS[category]());
      }
    }
  }
  return out;
}
