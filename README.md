# Undaunted: High Seas — Prototype Sandbox

Interactive prototyping platform for *Undaunted: High Seas*, a fan adaptation of [Undaunted: Battle of Britain](https://boardgamegeek.com/boardgame/353545/undaunted-battle-of-britain) for age-of-sail naval combat. Two-player remotely-playable browser game once a card set is dropped in — board, ship, terrain, and card systems are all wired; rule resolution is socially managed (engine never enforces phase, turn, or initiative).

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
- A **dice roller**: pick pool size (1–20) and die size (d4 / d6 / d8 / d10 / d12 / d20), click **Roll**. Results show the individual dice, sum, max, and min, with a small history of recent rolls. Rolls are dispatched through the reducer and synced to both players via the shared roll log (last 10).

## Cards, hands, zones — the digital build

Once the map is locked **and** a faction is claimed, the editor surfaces the full card UI:

- **Hand** — bottom-pinned 3-card strip. Hotkeys `1` / `2` / `3` select; `Z` opens a large view-only modal on the selected card. Click the **Deck** mini to draw to hand size (3); auto-reshuffles the discard back into the deck when empty.
- **Play area** — free-form 2D overlay above the board. Drop any card anywhere by `(x, y)` to indicate ship assignment. Hold **Shift** on drop to place face-down (initiative bid, set-aside, etc.); double-click to flip.
- **Zone panel (right)** — tabs for own **Supply / Discard / Removed / Set aside** + the synced roll log. Drop targets accept cards from any zone. The Removed tab surfaces the BoB p.20 casualty-priority hint (hand → discard → deck) — guidance only, not enforcement.
- **Opponent strip (top)** — opponent's deck count, discard top, supply (face-up titles), removed/set-aside back-counts. View-only; face-down cards arrive without their `cardId`.

Card data lives in `public/card_data.json` (Medieval-hack schema, instance-based: three copies = three entries). A placeholder set ships with the repo so the engine is testable without finalized card design. Drop in a real `card_data.json` and nothing else needs to change.

Hidden information is one mechanism: every card has `faceUp: bool`. Face-down cards in shared state carry `cardId: null`; the owner client keeps the real id in `localStorage["highSeas:<roomId>:cardMap"]`. Refresh mid-game rejoins cleanly.

## Multiplayer — Firebase sync + room flow

Two players each open the same `?room=<id>` link and play. No auth, no matchmaking — the room ID is the secret.

1. Click **+ Room** in the toolbar. The URL gets a `?room=<id>` query param; copy the link (📋) and send it.
2. Each side opens the link, picks a faction (British or French), and the client builds its own deck on claim — filtered by faction (plus neutrals), shuffled locally, written to `localStorage`. Only `deck.length` is published.
3. The toolbar shows: room badge, sync LED (offline / connecting / connected / error), and faction LED (filled with `factions.<faction>.primary` from `card_data.json`).
4. Solo / sandbox use: clicking **switch** flips which side you're acting as — useful for testing both hands locally.
5. **End game** freezes the room (a Resume button is provided to recover). Recovery from disconnect is out of scope by design — manage it socially.

**Trusted-clients model**: clients trust each other; cheating is a social problem. The engine never enforces phase, turn order, draw timing, casualty selection, or round structure — players manage flow. Last-writer-wins on shared paths (`playArea`, `rolls`, `placed`, `terrain`, `ships`); concurrent writes to disjoint paths merge cleanly via Firebase RTDB's per-key merge.

### Configuring Firebase

The sync layer is lazy-loaded — without config, the app runs fully solo (no networking, no errors). To enable multiplayer, supply Firebase Realtime Database credentials at build/dev time:

```bash
# .env.local (gitignored)
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_DATABASE_URL=https://<your-project>-default-rtdb.firebaseio.com
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_APP_ID=...
```

Or inject at runtime via `window.__firebaseConfig = {...}` before the app boots. The free tier covers two players forever.

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

- React 19 with `useReducer` for board, ship, and card state
- Vite + Tailwind v4
- SVG for the board, tokens, terrain layer, and arc overlay — no canvas, no images
- HTML5 drag-and-drop for cards (one `<Card>` component reused across hand, zones, play area, opponent strip)
- Firebase Realtime Database for two-player sync via patch-writes (`update()`); lazy-loaded so the app runs solo without config
- localStorage for saved terrain maps, owner-private deck order, and the face-down `cardKey → cardId` map; JSON Export/Import for full board + zones snapshots (format v2)

## Project layout

```
src/
  Editor.jsx                 top-level layout, mode + lock branching, multiplayer plumbing
  hex/coords.js              odd-q offset hex math, tile geometry, distance, hex-line walker
  state/store.js             reducer + action types, terrain & LoS rules, isShipPlaceable
  state/serialize.js         JSON export / import (v2 includes card slices)
  state/cardActions.js       MOVE_CARD, FLIP_CARD, DRAW_TO_HAND_SIZE, RESHUFFLE, SET_DECK, SET_PLAYER
  state/rollActions.js       ROLL_DICE (synced log, capped at 10)
  state/gameActions.js       END_GAME, room/player metadata
  state/maps.js              named terrain maps in localStorage
  board/Board.jsx                tile-mode board (placement + ship layer)
  board/TerrainBoard.jsx         paint-mode board (paints unlocked, hosts ships locked)
  board/useZoomPan.js            cursor-anchored wheel zoom + right-drag pan, active when locked
  tiles/TilePalette.jsx          tile-mode palette + thumbnails
  tiles/TerrainPalette.jsx       paint-mode palette + saved-maps panel
  ships/ShipLayer.jsx            ship rendering, drag, rotate, suppressed flip, LoS-aware firing arcs
  ships/ShipReserve.jsx          off-board ship reserve (18 fixed ships, faction-grouped)
  ships/ShipRulesPanel.jsx       collapsible right panel: class stats + dice roller (dispatches ROLL_DICE)
  cards/data.js                  load card_data.json, buildDeck (filter + shuffle), uuid keys
  cards/Card.jsx                 shared card display + drag/drop component
  cards/Hand.jsx                 bottom-pinned 3-card hand strip + deck/discard minis
  cards/PlayArea.jsx             free-form 2D play space (Shift+drop = face-down)
  cards/OpponentStrip.jsx        top-pinned opponent zones strip (view-only)
  cards/ZonePanel.jsx            right-panel zone tabs + synced roll log
  cards/RollLog.jsx              dice roll history renderer
  cards/CardModal.jsx            Z-modal card zoom
  cards/FactionPicker.jsx        faction picker on first arrival (transaction()-claimed)
  cards/dragdrop.js              shared dataTransfer payload helpers
  net/firebase.js                lazy-loaded RTDB connector + transaction-claim
  net/sync.js                    serializeForShared, hydrateFromShared, write-paths registry
  net/room.js                    ?room= URL parsing, clientId, share-link
  ui/Toolbar.jsx                 mode toggle, lock, room/sync/faction LEDs, end-game, export/import
public/
  card_data.json                 placeholder card set (Medieval-hack schema, faction-keyed)
```

## Status

The digital build is feature-complete against [`../prd.md`](../prd.md): board / ship / terrain / card / hand / zone / play-area / dice systems and Firebase room flow all wired. Card content is the long pole — the placeholder `card_data.json` is enough to test phases 1–4 of the build, and dropping in a finalized set requires no engine change.

See [`../project-brief.md`](../project-brief.md) (in the parent design folder, not this repo) for game-design decisions and [`../prd.md`](../prd.md) for the digital build specification.
