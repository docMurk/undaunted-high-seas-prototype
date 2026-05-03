// Tile-slot snap logic. Wraps nearestTileSlot for the editor's drag flow.
// Threshold is generous: any cursor inside the board snaps to nearest slot
// (no dead zones between adjacent slot centers).
import { nearestTileSlot, BOARD_PAD, HEX_VSPACE } from '../hex/coords.js';

export function snapToTileSlot(boardX, boardY) {
  // Vertical slot pitch is 3 * HEX_VSPACE; use 2x that as threshold so the
  // entire board area is covered by some slot's snap zone.
  return nearestTileSlot(boardX, boardY, BOARD_PAD, BOARD_PAD, HEX_VSPACE * 6);
}
