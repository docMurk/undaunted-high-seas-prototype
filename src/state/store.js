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
  GRID_COLS, GRID_ROWS, tileOccupiedHexes, tileFitsInGrid,
} from '../hex/coords.js';
import {
  EMPTY_ZONES, moveCard, flipCard, drawToHandSize, reshuffle, setDeck, setPlayer,
} from './cardActions.js';
import { rollDice, clearRolls } from './rollActions.js';
import { endGame, resumeGame, setLocalPlayer, setRoomId } from './gameActions.js';

export const TERRAIN_TYPES = ['open', 'coastline', 'reef', 'island', 'fog'];
export const FORT_TYPES = new Set(['coastline', 'island']);
export const BRUSH_TYPES = [...TERRAIN_TYPES, 'fort'];

// Terrain that ships cannot occupy. Reef is navigable (some ship classes
// will be restricted later, but not modeled yet).
export const SHIP_BLOCKING_TERRAIN = new Set(['island', 'coastline']);

// Terrain that interrupts a line of sight ray. Fog blocks beyond it but is
// itself targetable — caller is responsible for the "first fog visible"
// rule by walking only intermediate hexes.
export const LOS_BLOCKING_TERRAIN = new Set(['island', 'coastline', 'fog']);

// Terrain that cannot be a target (no ship can sit on it, nothing to shoot).
export const TARGET_EXCLUDE_TERRAIN = new Set(['island', 'coastline']);

export function isShipPlaceable(terrain, col, row) {
  const t = terrain && terrain[`${col},${row}`];
  return !t || !SHIP_BLOCKING_TERRAIN.has(t.type);
}

let _instCounter = 1;
const nextInstanceId = () => `i${_instCounter++}`;

// Ship class catalog. Order here drives reserve layout.
export const SHIP_CLASSES = ['sloop', 'frigate', 'capital'];
const CLASS_PREFIX = { sloop: 'S', frigate: 'F', capital: 'C' };
const FACTION_PREFIX = { blue: 'B', red: 'R' };

// Build the canonical 18-ship reserve: 2 factions × 3 classes × 3 numbered ships.
// Internal id is faction-qualified (`B-S1`); display label is the bare code (`S1`).
export function createInitialShips() {
  const out = [];
  let slot = 0;
  for (const faction of ['blue', 'red']) {
    for (const cls of SHIP_CLASSES) {
      for (let n = 1; n <= 3; n++) {
        out.push({
          id: `${FACTION_PREFIX[faction]}-${CLASS_PREFIX[cls]}${n}`,
          label: `${CLASS_PREFIX[cls]}${n}`,
          class: cls,
          faction,
          col: null, row: null,
          facing: faction === 'blue' ? 180 : 0,
          paletteSlot: slot++,
          suppressed: false,
        });
      }
    }
  }
  return out;
}

export function initialState() {
  return {
    palette: generatePalette(),
    placed: [],         // [{ instanceId, tile, col, row, rotation }]
    ships: createInitialShips(),
    selectedTileInstanceId: null,
    selectedShipId: null,
    locked: false,
    mode: 'tile',          // 'tile' | 'paint'
    terrain: {},           // { "col,row": { type, fort? } }
    activeBrush: 'coastline',
    activeMapName: null,   // name of currently-loaded saved map (if any)
    rulesPanelOpen: true,
    // Multiplayer / cards slices (PRD §Architecture).
    players: { p1: null, p2: null },     // { clientId, faction }
    zones: { p1: EMPTY_ZONES(), p2: EMPTY_ZONES() },
    playArea: [],
    rolls: [],
    gameOver: false,
    roomId: null,
    localPlayer: null,                   // 'p1' | 'p2' | null (solo/sandbox)
    syncStatus: 'offline',               // 'offline' | 'connecting' | 'connected' | 'error'
    cardData: null,                      // public/card_data.json payload, lazy-loaded
  };
}

// Switch which side the local client is acting as. Useful for solo
// sandboxing (Phase 1 'switch player' debug toggle) and for the faction
// picker before any networking comes online.
export function withLocalPlayer(state, player) {
  return setLocalPlayer(state, { player });
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
               selectedShipId: null,
               ships: createInitialShips() };
    }

    case 'PLACE_SHIP': {
      const { id, col, row } = action;
      if (!isShipPlaceable(state.terrain, col, row)) return state;
      return { ...state, ships: state.ships.map(s =>
        s.id === id ? { ...s, col, row } : s) };
    }

    case 'MOVE_SHIP': {
      return reducer(state, { type: 'PLACE_SHIP', ...action });
    }

    case 'RETURN_SHIP_TO_RESERVE': {
      // paletteSlot is stable across the ship's lifetime — see createInitialShips.
      // Returning a ship clears suppression too (reserve = fresh state).
      return { ...state, ships: state.ships.map(s =>
        s.id === action.id ? { ...s, col: null, row: null, suppressed: false } : s) };
    }

    case 'ROTATE_SHIP': {
      const { id, delta } = action;
      return { ...state, ships: state.ships.map(s =>
        s.id === id ? { ...s, facing: (s.facing + delta + 360) % 360 } : s) };
    }

    case 'SELECT_SHIP': {
      return { ...state, selectedShipId: action.id, selectedTileInstanceId: null };
    }

    case 'TOGGLE_SUPPRESSED': {
      return { ...state, ships: state.ships.map(s =>
        s.id === action.id ? { ...s, suppressed: !s.suppressed } : s) };
    }

    case 'TOGGLE_RULES_PANEL': {
      return { ...state, rulesPanelOpen: !state.rulesPanelOpen };
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
      if (col < 0 || col >= GRID_COLS || row < 0 || row >= GRID_ROWS) return state;
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
      // Older saves with mismatched ship rosters are dropped in favor of the
      // canonical 18-ship reserve.
      const incoming = action.state;
      const placed = Array.isArray(incoming.placed)
        ? incoming.placed
        : []; // older saves are silently dropped
      const validShips = Array.isArray(incoming.ships)
        && incoming.ships.length > 0
        && incoming.ships.every(s => s.class && s.label);
      return {
        ...incoming,
        placed,
        ships: validShips ? incoming.ships : createInitialShips(),
        terrain: incoming.terrain || {},
        mode: incoming.mode === 'paint' ? 'paint' : 'tile',
        activeBrush: incoming.activeBrush || 'coastline',
        activeMapName: incoming.activeMapName || null,
        selectedTileInstanceId: null,
        selectedShipId: null,
        rulesPanelOpen: incoming.rulesPanelOpen !== false,
      };
    }

    // ───── Card / multiplayer actions (PRD §Action protocol) ─────
    case 'MOVE_CARD':         return moveCard(state, action);
    case 'FLIP_CARD':         return flipCard(state, action);
    case 'DRAW_TO_HAND_SIZE': return drawToHandSize(state, action);
    case 'RESHUFFLE':         return reshuffle(state, action);
    case 'SET_DECK':          return setDeck(state, action);
    case 'SET_PLAYER':        return setPlayer(state, action);
    case 'ROLL_DICE':         return rollDice(state, action);
    case 'CLEAR_ROLLS':       return clearRolls(state);
    case 'END_GAME':          return endGame(state);
    case 'RESUME_GAME':       return resumeGame(state);
    case 'SET_LOCAL_PLAYER':  return setLocalPlayer(state, action);
    case 'SET_ROOM_ID':       return setRoomId(state, action);
    case 'SET_SYNC_STATUS':   return { ...state, syncStatus: action.status || 'offline' };
    case 'SET_CARD_DATA':     return { ...state, cardData: action.data };
    case 'APPLY_REMOTE_PATCH': {
      // Merge inbound shared subtrees from Firebase. Caller is responsible
      // for filtering to disjoint paths.
      const patch = action.patch || {};
      return { ...state, ...patch };
    }

    default:
      return state;
  }
}
