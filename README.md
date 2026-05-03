# Undaunted: High Seas — Prototype Sandbox

Interactive prototyping platform for *Undaunted: High Seas*, a fan adaptation of [Undaunted: Battle of Britain](https://boardgamegeek.com/boardgame/353545/undaunted-battle-of-britain) for age-of-sail naval combat. Not a playable game — a sandbox for testing board geometry, terrain authoring, ship placement, and firing-arc readability while the rules are still in flux.

**Live demo:** https://docmurk.github.io/undaunted-high-seas-prototype/

## Two editing modes

The app has two modes you can flip between via the toolbar pill at the top.

### Tile mode (faithful to BoB)

Build the playing surface from procedurally-generated 5-hex tiles, BoB-style. Drag tiles from the left palette onto the board; rotate with `Q`/`E`; drag placed tiles to move them, `Delete` to remove. Once you've laid out a board, click **🔒 Lock tiles** to switch into ship-placement mode, where the same drag/rotate vocabulary applies to ships and firing arcs render on selection.

### Hex paint mode (custom maps)

Skip tile placement entirely and paint terrain directly onto the 90 playable hexes. Pick a brush from the left palette (Open / Coastline / Reef / Island / Fog / Fort), then click + drag on the board to paint. The Fort brush toggles a fort marker on coastline or island hexes only.

Maps save by name to your browser's localStorage and reload from the side panel — useful for keeping a library of scenario boards (blockade, fleet engagement, island chain, etc.) you can return to without rebuilding.

## Firing arcs

When a ship is selected (in tile mode, after locking), the rest of the board paints to show targetable hexes:

- **Deeper amber**: fore and aft — single hex line in the bow / stern direction.
- **Lighter amber**: port and starboard broadsides — 60° cones bounded by the fore-port / aft-port hex directions on each side.
- **Untinted**: out of arc, or beyond the 4-hex range cap.
- **Range** is capped at 4 hexes in every direction. Hexes farther than 4 away are never highlighted, no matter the angle.

The dead zones — the wedges between the fore line and each broadside cone, and between aft and each cone — can't be targeted from any battery.

## Run locally

```bash
git clone https://github.com/docMurk/undaunted-high-seas-prototype.git
cd undaunted-high-seas-prototype
npm install
npm run dev
```

Vite prints a local URL (typically `http://localhost:5173/undaunted-high-seas-prototype/`).

## Stack

- React 19 with `useReducer` for board state
- Vite + Tailwind v4
- SVG for the board, tokens, terrain layer, and arc overlay — no canvas, no images
- localStorage for saved terrain maps; JSON Export/Import for full board snapshots

## Project layout

```
src/
  Editor.jsx           top-level layout, branches on mode
  hex/coords.js        odd-q offset hex math, tile geometry, hex distance
  state/store.js       reducer + action types
  state/serialize.js   JSON export / import
  state/maps.js        named terrain maps in localStorage
  board/Board.jsx          tile-mode board (placement + ship layer)
  board/TerrainBoard.jsx   paint-mode board
  tiles/TilePalette.jsx    tile-mode palette + thumbnails
  tiles/TerrainPalette.jsx paint-mode palette + saved-maps panel
  ships/ShipLayer.jsx      ship rendering, drag, rotate, firing arcs
  ships/ShipReserve.jsx    off-board ship reserve
  ui/Toolbar.jsx           mode toggle, lock, export/import
```

## Status

Pre-prototype phase. The app is a tooling layer; the actual rules are still being designed. See [`../project-brief.md`](../project-brief.md) (in the parent design folder, not this repo) for the current locked design decisions and open questions.
