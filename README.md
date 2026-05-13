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

Once the map is locked **and** a faction is claimed, the editor reshapes itself into a "table" view:

- **Split table** — the board takes the left half of the central row and the **play area** takes the right half, each as a peer surface. The board still zooms / pans inside its half (wheel zoom, right-drag pan, `0` reset); the play area is a free-form card surface.
- **Floating hand** — three cards anchored to the bottom edge of the viewport, fanned and peeking. Hover lifts a card fully into view at ~1.45×; drag it onto the play area or a zone. The container is `pointer-events: none` so the board still receives wheel and right-drag between the cards. Hotkeys `1` / `2` / `3` select; `Z` opens a full-screen modal on the selected card.
- **Deck & discard chips** — sit on either side of the floating hand. Click the deck chip to draw to hand size (3); auto-reshuffles the discard back into the deck when empty. Drop a hand card on the discard chip to discard.
- **Play area** — drop cards anywhere by normalized `(fx, fy)` in `0..1` so positions survive window / split resize. Hover enlarges a played card to ~1.8× for at-the-table reading. Double-click flips your own cards face-up / face-down; double-click an opponent's card to open the modal preview. Hold **Shift** on drop to place face-down.
- **Right drawer** — zones (Supply / Discard / Removed / Set aside) and ship rules / dice roller, collapsed by default once the map is locked. Click the edge tab to reopen.

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

### Current state

The **client** is fully wired for multiplayer — room creation, faction-slot claim transaction, patch-write on every state mutation, hidden-information handling, reconnect-friendly. The piece that's missing is **build-time Firebase configuration on the deployed site**. Locally, dropping a `.env.local` file in and running `npm run dev` is enough to play multiplayer. The GitHub Pages bundle, in contrast, is built without any `VITE_FIREBASE_*` env vars, so the published site falls back to offline mode and a second player can open the URL but never syncs.

### Plan to make the deployed site multiplayer

Self-contained punch list — no client code changes needed.

1. **Create a Firebase project + RTDB instance.**
   - Firebase console → "Add project" (Google Analytics off is fine). Pick a project ID.
   - Inside the project: Build → **Realtime Database** → Create database → pick a region (`us-central1` is fine) → start in **locked mode**, we'll write rules in step 4.
   - Add a Web app (`</>` icon on the project overview) → register without Firebase Hosting. Copy the config object that appears (`apiKey`, `authDomain`, `databaseURL`, `projectId`, `appId`, …).

2. **Add the config as GitHub Actions secrets.**
   In the repo → Settings → Secrets and variables → **Actions** → New repository secret, one per line. Names must match the `VITE_FIREBASE_*` reads in `src/net/firebase.js:17-21`:

   | Secret name | Source field |
   | --- | --- |
   | `VITE_FIREBASE_API_KEY` | `apiKey` |
   | `VITE_FIREBASE_AUTH_DOMAIN` | `authDomain` |
   | `VITE_FIREBASE_DATABASE_URL` | `databaseURL` (full `https://…firebaseio.com`) |
   | `VITE_FIREBASE_PROJECT_ID` | `projectId` |
   | `VITE_FIREBASE_APP_ID` | `appId` |

   The API key is safe to expose in a public bundle — Firebase web keys are public; security is enforced by RTDB rules in step 4.

3. **Inject the secrets into the build step.** Patch `.github/workflows/deploy.yml` so the `npm run build` step gets the env vars:

   ```yaml
   - run: npm ci
   - run: npm run build
     env:
       VITE_FIREBASE_API_KEY:      ${{ secrets.VITE_FIREBASE_API_KEY }}
       VITE_FIREBASE_AUTH_DOMAIN:  ${{ secrets.VITE_FIREBASE_AUTH_DOMAIN }}
       VITE_FIREBASE_DATABASE_URL: ${{ secrets.VITE_FIREBASE_DATABASE_URL }}
       VITE_FIREBASE_PROJECT_ID:   ${{ secrets.VITE_FIREBASE_PROJECT_ID }}
       VITE_FIREBASE_APP_ID:       ${{ secrets.VITE_FIREBASE_APP_ID }}
   ```

   Vite reads `import.meta.env.VITE_*` at build time and inlines the values into the bundle. After the next push to `master`, the deployed bundle ships with the config baked in.

4. **Write RTDB rules** so the database is safe to publish without auth. Replace the default locked rules with something like:

   ```json
   {
     "rules": {
       "rooms": {
         "$roomId": {
           ".read":  "$roomId.matches(/^[a-z0-9]{4,12}$/)",
           ".write": "$roomId.matches(/^[a-z0-9]{4,12}$/)",
           "players": {
             "$slot": {
               ".validate": "$slot.matches(/^p[12]$/) && newData.hasChildren(['clientId','faction'])"
             }
           }
         }
       }
     }
   }
   ```

   This restricts writes to rooms whose ID matches the generator (`makeRoomId` produces 6 lowercase alnum, the regex allows 4–12) and forbids reads / writes at the database root. Without auth, anyone with a valid-looking room ID can read or write that room — that's exactly the trusted-clients model the rest of the engine assumes. Tighten further (auth, rate limits) only when the prototype graduates.

5. **Push to `master`.** The GH Pages workflow rebuilds with the env vars; the sync LED in the toolbar should flip from "offline" to "connected" once two clients open the same `?room=` URL.

6. **Smoke test.** Open the live URL in two browsers (or a private window). Click **+ Room** on one; copy the link; paste in the other. Pick factions on each side. Confirm: tile placement on side A appears on side B; cards drawn on A stay hidden on B; cards dropped on the play area appear on both screens; rolls appear in the shared log on both.

**Free-tier note.** Firebase RTDB's free Spark plan covers 100 simultaneous connections, 1 GB stored, and 10 GB/month downloaded — orders of magnitude more than two players need. No billing setup required.

### Configuring Firebase locally

For local multiplayer dev (or solo testing of the network path), drop the same five `VITE_FIREBASE_*` keys into a gitignored `.env.local` at the repo root:

```bash
# .env.local
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_DATABASE_URL=https://<your-project>-default-rtdb.firebaseio.com
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_APP_ID=...
```

Or inject at runtime via `window.__firebaseConfig = {...}` before the app boots (handy for embedding in another page without rebuilding).

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
  cards/Hand.jsx                 floating 3-card hand overlay + deck/discard chips (fan + peek + hover-lift)
  cards/PlayArea.jsx             free-form play surface, normalized 0..1 coords (Shift+drop = face-down)
  cards/ZonePanel.jsx            right-drawer zone tabs + synced roll log
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
