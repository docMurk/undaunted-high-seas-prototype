// Flat-top hexes, odd-q offset coordinates. Shared by tile and ship layers.
//
// Flat-top means each hex has a horizontal flat edge on top and bottom, with
// vertices on the left and right. Hex columns are vertically stacked (sharing
// flat edges). Odd-q means odd-numbered columns are pushed DOWN by half a hex
// height, so they nest between even-column hexes — this gives the BoB tile
// shape: 3 hexes in a column + 2 hexes in adjacent column nested between them.

export const HEX_SIZE = 36;                    // center-to-vertex
export const HEX_WIDTH = 2 * HEX_SIZE;         // vertex-to-vertex (horizontal)
export const HEX_HEIGHT = Math.sqrt(3) * HEX_SIZE; // flat-to-flat (vertical)
export const HEX_HSPACE = HEX_WIDTH * 0.75;    // column pitch
export const HEX_VSPACE = HEX_HEIGHT;          // row pitch (full height)

// Tile is BoB 3+2: 5 hexes in a 2-col x 3-row bounding box.
// Board is 6 tile cols x 3 tile rows = 12 hex cols x 9 hex rows.
export const TILE_COLS = 6;
export const TILE_ROWS = 3;
export const TILE_BOX_W = 2;  // hex cols per tile
export const TILE_BOX_H = 3;  // hex rows per tile
export const GRID_COLS = TILE_COLS * TILE_BOX_W;  // 12
export const GRID_ROWS = TILE_ROWS * TILE_BOX_H;  //  9

export const BOARD_PAD = 32;
export const BOARD_WIDTH_PX  = (GRID_COLS - 1) * HEX_HSPACE + HEX_WIDTH;
export const BOARD_HEIGHT_PX = GRID_ROWS * HEX_VSPACE + HEX_VSPACE / 2;

// Pixel center of hex (col, row). Odd cols are offset DOWN by half a row.
export function hexCenter(col, row, x0 = BOARD_PAD, y0 = BOARD_PAD) {
  const x = x0 + col * HEX_HSPACE + HEX_WIDTH / 2;
  const y = y0 + row * HEX_VSPACE + (col % 2 === 1 ? HEX_VSPACE / 2 : 0) + HEX_VSPACE / 2;
  return { x, y };
}

// Flat-top vertices: 0°, 60°, 120°, 180°, 240°, 300° (math convention, 0=right, CCW).
export function hexPoints(cx, cy, size = HEX_SIZE) {
  const pts = [];
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 180) * (60 * i);
    pts.push(`${(cx + size * Math.cos(a)).toFixed(2)},${(cy + size * Math.sin(a)).toFixed(2)}`);
  }
  return pts.join(' ');
}

export function nearestHex(x, y, x0 = BOARD_PAD, y0 = BOARD_PAD,
                           cols = GRID_COLS, rows = GRID_ROWS) {
  let best = null;
  let bestD = Infinity;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const h = hexCenter(c, r, x0, y0);
      const d = Math.hypot(x - h.x, y - h.y);
      if (d < bestD) { bestD = d; best = { col: c, row: r, d }; }
    }
  }
  return best && best.d < HEX_SIZE * 0.95 ? { col: best.col, row: best.row } : null;
}

// Tile layout: maps slot index 0..4 → (boxCol, boxRow) in tile-local coords.
// Layout depends on the origin col's PARITY because in odd-q offset the
// adjacent column shifts by half a row in opposite directions for even vs
// odd cols. Both parities produce the same BoB 3+2 visual nesting; the
// box-row indices for the right column just shift accordingly.
//
// Slot semantics (consistent across parities and rotations):
//   slot 0 = top of 3-column
//   slot 1 = middle of 3-column
//   slot 2 = bottom of 3-column
//   slot 3 = top (nested) of 2-column
//   slot 4 = bottom (nested) of 2-column
// Rotation 180 mirrors the tile through the box centre, so the 3-column
// becomes the right side and the 2-column becomes the left side.
export const TILE_LAYOUT = {
  even: {
    0: {
      slots: [
        { slot: 0, boxCol: 0, boxRow: 0 },
        { slot: 1, boxCol: 0, boxRow: 1 },
        { slot: 2, boxCol: 0, boxRow: 2 },
        { slot: 3, boxCol: 1, boxRow: 0 },
        { slot: 4, boxCol: 1, boxRow: 1 },
      ],
      empty: { boxCol: 1, boxRow: 2 },
    },
    180: {
      slots: [
        { slot: 0, boxCol: 1, boxRow: 2 },
        { slot: 1, boxCol: 1, boxRow: 1 },
        { slot: 2, boxCol: 1, boxRow: 0 },
        { slot: 3, boxCol: 0, boxRow: 2 },
        { slot: 4, boxCol: 0, boxRow: 1 },
      ],
      empty: { boxCol: 0, boxRow: 0 },
    },
  },
  odd: {
    0: {
      slots: [
        { slot: 0, boxCol: 0, boxRow: 0 },
        { slot: 1, boxCol: 0, boxRow: 1 },
        { slot: 2, boxCol: 0, boxRow: 2 },
        { slot: 3, boxCol: 1, boxRow: 1 },
        { slot: 4, boxCol: 1, boxRow: 2 },
      ],
      empty: { boxCol: 1, boxRow: 0 },
    },
    180: {
      slots: [
        { slot: 0, boxCol: 1, boxRow: 2 },
        { slot: 1, boxCol: 1, boxRow: 1 },
        { slot: 2, boxCol: 1, boxRow: 0 },
        { slot: 3, boxCol: 0, boxRow: 1 },
        { slot: 4, boxCol: 0, boxRow: 0 },
      ],
      empty: { boxCol: 0, boxRow: 2 },
    },
  },
};

// Pick the right layout for a given origin col + rotation.
export function getTileLayout(originCol, rotation = 0) {
  const parity = originCol % 2 === 0 ? 'even' : 'odd';
  return TILE_LAYOUT[parity][rotation] || TILE_LAYOUT[parity][0];
}

// Hex positions occupied by a tile placed at (col, row) with given rotation.
// (col, row) is the absolute hex of the tile's box-(0,0) corner = its anchor.
export function tileOccupiedHexes(col, row, rotation = 0) {
  const layout = getTileLayout(col, rotation);
  return layout.slots.map(s => ({
    col: col + s.boxCol,
    row: row + s.boxRow,
    slot: s.slot,
  }));
}

// True if all 5 occupied hexes are within the board's hex grid.
export function tileFitsInGrid(col, row, rotation = 0,
                               cols = GRID_COLS, rows = GRID_ROWS) {
  const hexes = tileOccupiedHexes(col, row, rotation);
  return hexes.every(h => h.col >= 0 && h.col < cols && h.row >= 0 && h.row < rows);
}

// Pixel-space centroid offset (relative to the box-(0,0) hex center) of the
// tile's 5 occupied hex centers, for a given origin parity & rotation.
export function tileCentroidOffset(originCol = 0, rotation = 0) {
  const layout = getTileLayout(originCol, rotation);
  const originParityOffset = (originCol % 2 === 1) ? HEX_VSPACE / 2 : 0;
  let sx = 0, sy = 0;
  for (const s of layout.slots) {
    const absColParityOffset = ((originCol + s.boxCol) % 2 === 1) ? HEX_VSPACE / 2 : 0;
    const x = s.boxCol * HEX_HSPACE;
    // Each hex center y relative to the origin hex center:
    //   absRow * VS + absColOffset + VS/2 - (originRow * VS + originParityOffset + VS/2)
    // = boxRow * VS + (absColOffset - originParityOffset)
    const y = s.boxRow * HEX_VSPACE + (absColParityOffset - originParityOffset);
    sx += x; sy += y;
  }
  return { dx: sx / layout.slots.length, dy: sy / layout.slots.length };
}

// Find nearest hex to a pixel point, ALWAYS returning a result (no threshold).
// Caller is responsible for any bounds clamping.
export function nearestHexUnbounded(x, y, x0 = BOARD_PAD, y0 = BOARD_PAD,
                                    cols = GRID_COLS, rows = GRID_ROWS) {
  let best = { col: 0, row: 0 };
  let bestD = Infinity;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const h = hexCenter(c, r, x0, y0);
      const d = Math.hypot(x - h.x, y - h.y);
      if (d < bestD) { bestD = d; best = { col: c, row: r }; }
    }
  }
  return best;
}

// Like nearestHexUnbounded but constrained to even columns. Tiles MUST anchor
// at even cols so the BoB 3+2 shape renders consistently — at odd-col anchors
// the right-column hexes flip their vertical offset (odd-q parity) and the
// tile shape distorts. Vertical granularity is unaffected (any row OK).
export function nearestEvenColHex(x, y, x0 = BOARD_PAD, y0 = BOARD_PAD,
                                  cols = GRID_COLS, rows = GRID_ROWS) {
  let best = { col: 0, row: 0 };
  let bestD = Infinity;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c += 2) {
      const h = hexCenter(c, r, x0, y0);
      const d = Math.hypot(x - h.x, y - h.y);
      if (d < bestD) { bestD = d; best = { col: c, row: r }; }
    }
  }
  return best;
}

// Hex distance in odd-q offset coordinates. Returns the number of hex steps
// between two hexes (cube-coord distance).
export function hexDistance(c1, r1, c2, r2) {
  const ax = c1;
  const az = r1 - (c1 - (c1 & 1)) / 2;
  const ay = -ax - az;
  const bx = c2;
  const bz = r2 - (c2 - (c2 & 1)) / 2;
  const by = -bx - bz;
  return (Math.abs(ax - bx) + Math.abs(ay - by) + Math.abs(az - bz)) / 2;
}

// True if (col,row) lies inside one of the 18 standard tile slots in the
// 6x3 layout — i.e. one of the 90 "playable" hexes. The other 18 hexes in
// the 12x9 grid are the empty corners between tiles.
export function isPaintable(col, row) {
  if (col < 0 || col >= GRID_COLS || row < 0 || row >= GRID_ROWS) return false;
  const tc = Math.floor(col / TILE_BOX_W);
  const tr = Math.floor(row / TILE_BOX_H);
  if (tc < 0 || tc >= TILE_COLS || tr < 0 || tr >= TILE_ROWS) return false;
  const anchorCol = tc * TILE_BOX_W;
  const anchorRow = tr * TILE_BOX_H;
  const layout = getTileLayout(anchorCol, 0);
  const empty = layout.empty;
  return !(col - anchorCol === empty.boxCol && row - anchorRow === empty.boxRow);
}

// Returns the 90 paintable hexes in the standard tile layout.
export function paintableHexList() {
  const out = [];
  for (let r = 0; r < GRID_ROWS; r++) {
    for (let c = 0; c < GRID_COLS; c++) {
      if (isPaintable(c, r)) out.push({ col: c, row: r });
    }
  }
  return out;
}

// Flat-top hex facings: bow points toward a vertex (or equivalently, an edge
// midpoint). We use the 6 edge-midpoint directions for movement convention,
// matching neighbor directions. Compass: 0°=N, increases CW.
// Flat-top neighbors are at compass 0, 60, 120, 180, 240, 300.
export const FACINGS = [0, 60, 120, 180, 240, 300];
