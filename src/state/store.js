// Single reducer for board state. All actions are JSON-serializable so a
// future LAN-sync layer can stream them to a peer without changes.
//
// Free-placement model: state.placed is an ARRAY. Each placed tile has its
// own (col, row) hex anchor (top-left of its 2x3 bounding box) and rotation.
// PLACE_TILE / MOVE_TILE / ROTATE_TILE all check the resulting position
// against grid bounds and overlap with other placed tiles, and silently
// reject if invalid (the UI shows green/red preview during drag).
import { generatePalette, generateTile, nextTileId } from '../tiles/generator.js';
import {
  GRID_COLS, GRID_ROWS, tileOccupiedHexes, tileFitsInGrid, isPaintable,
} from '../hex/coords.js';

export const TERRAIN_TYPES = ['open', 'coastline', 'reef', 'island', 'fog'];
export const FORT_TYPES = new Set(['coastline', 'island']);
export const BRUSH_TYPES = [...TERRAIN_TYPES, 'fort'];

let _instCounter = 1;
const nextInstanceId = () => `i${_instCounter++}`;
let _shipCounter = 1;
const nextShipId = () => `s${_shipCounter++}`;

export function initialState() {
  return {
    palette: generatePalette(),
    placed: [],         // [{ instanceId, tile, col, row, rotation }]
    ships: [
      { id: 'HMS-1', faction: 'blue', col: null, row: null, facing: 180, paletteSlot: 0 },
      { id: 'HMS-2', faction: 'blue', col: null, row: null, facing: 180, paletteSlot: 1 },
      { id: 'FR-1',  faction: 'red',  col: null, row: null, facing:   0, paletteSlot: 2 },
      { id: 'FR-2',  faction: 'red',  col: null, row: null, facing:   0, paletteSlot: 3 },
    ],
    selectedTileInstanceId: null,
    selectedShipId: null,
    locked: false,
    mode: 'tile',          // 'tile' | 'paint'
    terrain: {},           // { "col,row": { type, fort? } }
    activeBrush: 'coastline',
    activeMapName: null,   // name of currently-loaded saved map (if any)
  };
}

// True if a tile with given (col, row, rotation) overlaps any placed tile
// (excluding the optional excludeInstanceId).
export function tileOverlapsAny(placed, col, row, rotation, excludeInstanceId = null) {
  const occupied = new Set();
  for (const p of placed) {
    if (p.instanceId === excludeInstanceId) continue;
    for (const h of tileOccupiedHexes(p.col, p.row, p.rotation)) {
      occupied.add(`${h.col},${h.row}`);
    }
  }
  for (const h of tileOccupiedHexes(col, row, rotation)) {
    if (occupied.has(`${h.col},${h.row}`)) return true;
  }
  return false;
}

// Validity = fits in grid AND no overlap.
export function isPlacementValid(placed, col, row, rotation, excludeInstanceId = null) {
  if (!tileFitsInGrid(col, row, rotation)) return false;
  if (tileOverlapsAny(placed, col, row, rotation, excludeInstanceId)) return false;
  return true;
}

// Find the first (scanning top-left → bottom-right) (col, row) where a tile
// of given rotation fits without overlap. Returns null if none found.
function findEmptyAnchor(placed, rotation = 0) {
  for (let r = 0; r < GRID_ROWS; r++) {
    for (let c = 0; c < GRID_COLS; c++) {
      if (isPlacementValid(placed, c, r, rotation)) return { col: c, row: r };
    }
  }
  return null;
}

export function reducer(state, action) {
  switch (action.type) {

    case 'PLACE_TILE': {
      const { paletteIdx, col, row, rotation = 0 } = action;
      const tile = state.palette[paletteIdx];
      if (!tile) return state;
      if (!isPlacementValid(state.placed, col, row, rotation)) return state;
      const entry = {
        instanceId: nextInstanceId(),
        tile: JSON.parse(JSON.stringify(tile)),
        col, row, rotation,
      };
      return { ...state, placed: [...state.placed, entry],
               selectedTileInstanceId: entry.instanceId };
    }

    case 'MOVE_TILE': {
      const { instanceId, col, row } = action;
      const entry = state.placed.find(p => p.instanceId === instanceId);
      if (!entry) return state;
      if (col === entry.col && row === entry.row) return state;
      if (!isPlacementValid(state.placed, col, row, entry.rotation, instanceId)) return state;
      return { ...state, placed: state.placed.map(p =>
        p.instanceId === instanceId ? { ...p, col, row } : p) };
    }

    case 'REMOVE_TILE': {
      const { instanceId } = action;
      return {
        ...state,
        placed: state.placed.filter(p => p.instanceId !== instanceId),
        selectedTileInstanceId: state.selectedTileInstanceId === instanceId
          ? null : state.selectedTileInstanceId,
      };
    }

    case 'CLONE_TILE': {
      const { instanceId } = action;
      const src = state.placed.find(p => p.instanceId === instanceId);
      if (!src) return state;
      const anchor = findEmptyAnchor(state.placed, src.rotation);
      if (!anchor) return state;
      const clonedTile = JSON.parse(JSON.stringify(src.tile));
      clonedTile.id = nextTileId();
      const entry = {
        instanceId: nextInstanceId(),
        tile: clonedTile,
        col: anchor.col, row: anchor.row,
        rotation: src.rotation,
      };
      return { ...state, placed: [...state.placed, entry],
               selectedTileInstanceId: entry.instanceId };
    }

    case 'ROTATE_TILE': {
      const { instanceId } = action;
      const entry = state.placed.find(p => p.instanceId === instanceId);
      if (!entry) return state;
      const newRotation = entry.rotation === 0 ? 180 : 0;
      // Rotation could overlap something else (the empty position moves).
      if (!isPlacementValid(state.placed, entry.col, entry.row, newRotation, instanceId)) return state;
      return { ...state, placed: state.placed.map(p =>
        p.instanceId === instanceId ? { ...p, rotation: newRotation } : p) };
    }

    case 'SELECT_TILE': {
      return { ...state, selectedTileInstanceId: action.instanceId,
               selectedShipId: null };
    }

    case 'LOCK_TILES':   return { ...state, locked: true,  selectedTileInstanceId: null };
    case 'UNLOCK_TILES': return { ...state, locked: false, selectedShipId: null };

    case 'REGENERATE_PALETTE': {
      return { ...state, palette: generatePalette() };
    }

    case 'REGENERATE_TILE': {
      const { paletteIdx } = action;
      const old = state.palette[paletteIdx];
      if (!old) return state;
      const fresh = generateTile(old.category, paletteIdx);
      const newPalette = state.palette.slice();
      newPalette[paletteIdx] = fresh;
      return { ...state, palette: newPalette };
    }

    case 'CLEAR_BOARD': {
      return { ...state, placed: [], selectedTileInstanceId: null,
               ships: state.ships.map((s, i) => ({
                 ...s, col: null, row: null, paletteSlot: i,
               })) };
    }

    case 'PLACE_SHIP': {
      const { id, col, row } = action;
      return { ...state, ships: state.ships.map(s =>
        s.id === id ? { ...s, col, row, paletteSlot: undefined } : s) };
    }

    case 'MOVE_SHIP': {
      return reducer(state, { type: 'PLACE_SHIP', ...action });
    }

    case 'RETURN_SHIP_TO_RESERVE': {
      const { id } = action;
      const used = new Set(state.ships
        .filter(s => s.col === null && s.id !== id)
        .map(s => s.paletteSlot));
      let slot = 0;
      while (used.has(slot)) slot++;
      return { ...state, ships: state.ships.map(s =>
        s.id === id ? { ...s, col: null, row: null, paletteSlot: slot } : s) };
    }

    case 'ROTATE_SHIP': {
      const { id, delta } = action;
      return { ...state, ships: state.ships.map(s =>
        s.id === id ? { ...s, facing: (s.facing + delta + 360) % 360 } : s) };
    }

    case 'SELECT_SHIP': {
      return { ...state, selectedShipId: action.id, selectedTileInstanceId: null };
    }

    case 'ADD_SHIP': {
      const { faction } = action;
      const used = new Set(state.ships
        .filter(s => s.col === null)
        .map(s => s.paletteSlot));
      let slot = 0;
      while (used.has(slot)) slot++;
      const id = `${faction === 'blue' ? 'HMS' : 'FR'}-${nextShipId()}`;
      return { ...state, ships: [...state.ships, {
        id, faction, col: null, row: null,
        facing: faction === 'blue' ? 180 : 0,
        paletteSlot: slot,
      }] };
    }

    case 'REMOVE_SHIP': {
      return { ...state, ships: state.ships.filter(s => s.id !== action.id),
               selectedShipId: state.selectedShipId === action.id ? null : state.selectedShipId };
    }

    case 'SET_MODE': {
      return {
        ...state,
        mode: action.mode === 'paint' ? 'paint' : 'tile',
        selectedTileInstanceId: null,
        selectedShipId: null,
      };
    }

    case 'SET_BRUSH': {
      return { ...state, activeBrush: action.brush };
    }

    case 'PAINT_HEX': {
      const { col, row } = action;
      if (!isPaintable(col, row)) return state;
      const brush = state.activeBrush;
      const key = `${col},${row}`;
      const cur = state.terrain[key] || { type: 'open' };
      let next;
      if (brush === 'fort') {
        if (!FORT_TYPES.has(cur.type)) return state;
        next = { ...cur, fort: !cur.fort };
      } else {
        next = { type: brush };
        if (cur.fort && FORT_TYPES.has(brush)) next.fort = true;
      }
      const terrain = { ...state.terrain };
      // Open water with no fort = remove the entry to keep map sparse.
      if (next.type === 'open' && !next.fort) {
        delete terrain[key];
      } else {
        terrain[key] = next;
      }
      return { ...state, terrain };
    }

    case 'LOAD_TERRAIN': {
      return {
        ...state,
        terrain: action.terrain || {},
        activeMapName: action.name || null,
      };
    }

    case 'CLEAR_TERRAIN': {
      return { ...state, terrain: {}, activeMapName: null };
    }

    case 'SET_ACTIVE_MAP_NAME': {
      return { ...state, activeMapName: action.name || null };
    }

    case 'IMPORT_BOARD': {
      // Defensive: support both old (object map) and new (array) placed shape.
      const incoming = action.state;
      const placed = Array.isArray(incoming.placed)
        ? incoming.placed
        : []; // older saves are silently dropped
      return {
        ...incoming,
        placed,
        terrain: incoming.terrain || {},
        mode: incoming.mode === 'paint' ? 'paint' : 'tile',
        activeBrush: incoming.activeBrush || 'coastline',
        activeMapName: incoming.activeMapName || null,
        selectedTileInstanceId: null,
        selectedShipId: null,
      };
    }

    default:
      return state;
  }
}
