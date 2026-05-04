# Undaunted: High Seas — Prototype Sandbox

Interactive prototyping platform for *Undaunted: High Seas*, a fan adaptation of [Undaunted: Battle of Britain](https://boardgamegeek.com/boardgame/353545/undaunted-battle-of-britain) for age-of-sail naval combat. Not a playable game — a sandbox for testing board geometry, terrain authoring, ship placement, and firing-arc readability while the rules are still in flux.

**Live demo:** https://docmurk.github.io/undaunted-high-seas-prototype/

## Two editing modes

The app has two modes you can flip between via the toolbar pill at the top.

### Tile mode (faithful to BoB)

Build the playing surface from procedurally-generated 5-hex tiles, BoB-style. Drag tiles from the left palette onto the board; rotate with `Q`/`E`; drag placed tiles to move them, `Delete` to remove. Once you've laid out a board, click **🔒 Lock tiles** to switch into ship-placement mode, where the same drag/rotate vocabulary applies to ships and firing arcs render on selection.

### Hex paint mode (custom maps)

Skip tile placement entirely and paint terrain directly onto every hex of the 12×9 grid. Pick a brush from the left palette (Open / Coastline / Reef / Island / Fog / Fort), then click + drag on the board to paint. The Fort brush toggles a fort marker on coastline or island hexes only.

Click **🔒 Lock map** to switch into ship-placement mode — the brush sidebar slides away and the same drag/rotate/firing-arc vocabulary as tile mode applies. Unlocking brings the brushes back so you can keep editing.

Maps save by name to your browser's localStorage and reload from the side panel — useful for keeping a library of scenario boards (blockade, fleet engagement, island chain, etc.) you can return to without rebuilding.

## Ship roster

The reserve is a fixed 18 ships: 2 factions × 3 classes × 3 numbered ships.

- **British** (blue) and **French** (red) — same roster, no faction-specific ships yet.
- **Sloop** (`S1`–`S3`), **Frigate** (`F1`–`F3`), **Capital** (`C1`–`C3`) per faction.

Tokens are square. The corner-to-corner **X** divides the token into four firing-arc quadrants (top = fore, bottom = aft, sides = broadsides). The **chevron** in the top quadrant marks the bow. The **large label** (`S1`/`F2`/`C3`) reads upright at any facing. Faction is shown by token color — there is no faction text on the token. **Press `F`** on a selected ship to flip it to its **shaded (suppressed)** side; press again to flip back.

## Ship placement & terrain

Ships cannot be deployed onto **island** or **coastline** hexes — the drop preview turns red and the drop is rejected. Reefs are navigable for now (a future ship-class restriction will tighten this). Tile mode is unaffected since it carries no terrain layer.

## Rules panel & dice roller

A collapsible right-side panel (toolbar **📖 Rules** button, or `×` in the panel header) holds:

- Per-class stat block (Maneuver, Defense, Broadside, Chasers) plus class actions and traits — Sloop/Frigate/Capital.
- General to-hit rules (cannons, boarding, raking) and general actions (Fire, Haul sails, Maneuver).
- A **dice roller**: pick pool size (1–20) and die size (d4 / d6 / d8 / d10 / d12 / d20), click **Roll**. Results show the individual dice, sum, max, and min, with a small history of recent rolls. Use it to resolve attacks manually — the app does not model damage.

## Firing arcs & line of sight

When a ship is selected (after locking, in either mode), the rest of the board paints to show targetable hexes:

- **Deeper amber**: fore and aft — single hex line in the bow / stern direction.
- **Lighter amber**: port and starboard broadsides — 60° cones bounded by the fore-port / aft-port hex directions on each side.
- **Untinted**: out of arc, beyond the 4-hex range cap, or blocked by line of sight.

The dead zones — the wedges between the fore line and each broadside cone, and between aft and each cone — can't be targeted from any battery.

**LoS rules** (re-projected on every rotation):

- **Island, coastline**: block the ray and are themselves not targetable (terrain, not ships).
- **Fog**: blocks the ray *beyond* it, but a ship in the first fog hex along a line is still targetable — that hex stays highlighted.
- **Open, reef**: pass-through.

Hex lines that pass exactly between two adjacent hexes use a conservative tiebreak: the ray is blocked if *either* neighbor blocks.

## Zoom & pan (locked only)

When the map is locked (play underway), the board accepts:

- **Mouse wheel** — zoom in/out anchored on the cursor (1× to 6×).
- **Right- or middle-click drag** — pan when zoomed in. Left button stays reserved for ship interaction; the context menu is suppressed over the board.
- **`0`** — reset to full view.

Unlocking returns the view to 1× automatically.

## Hotkeys (locked, ship selected)

- `Q` / `E` — turn the selected ship 60° counter-clockwise / clockwise.
- `F` — flip suppressed (shaded side) on / off.
- `Delete` / `Backspace` — return ship to reserve.

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
  Editor.jsx           top-level layout, branches on mode, sidebar collapse
  hex/coords.js        odd-q offset hex math, tile geometry, distance, hex-line walker
  state/store.js       reducer + action types, terrain & LoS rules, isShipPlaceable
  state/serialize.js   JSON export / import
  state/maps.js        named terrain maps in localStorage
  board/Board.jsx          tile-mode board (placement + ship layer)
  board/TerrainBoard.jsx   paint-mode board (paints when unlocked, hosts ships when locked)
  board/useZoomPan.js      cursor-anchored wheel zoom + right-drag pan, active when locked
  tiles/TilePalette.jsx    tile-mode palette + thumbnails
  tiles/TerrainPalette.jsx paint-mode palette + saved-maps panel
  ships/ShipLayer.jsx      ship rendering, drag, rotate, suppressed flip, LoS-aware firing arcs
  ships/ShipReserve.jsx    off-board ship reserve (18 fixed ships, faction-grouped)
  ships/ShipRulesPanel.jsx collapsible right panel: class stats + dice roller
  ui/Toolbar.jsx           mode toggle, lock, export/import, rules-panel toggle
```

## Status

Pre-prototype phase. The app is a tooling layer; the actual rules are still being designed. See [`../project-brief.md`](../project-brief.md) (in the parent design folder, not this repo) for the current locked design decisions and open questions.
