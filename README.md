# Undaunted: High Seas — Prototype Sandbox

An interactive prototyping platform for a Napoleonic naval board game (an Undaunted-series hack). Not a game — a physical-feel sandbox for testing board geometry, token manipulation, and firing-arc readability.

**Live demo:** https://docmurk.github.io/undaunted-high-seas-prototype/

## What it tests

- Whether a 6×6 hex board at this scale supports the engagement size the design wants.
- Whether square tokens read clearly against hex terrain.
- Whether the bow-triangle convention communicates facing intuitively.
- Whether four ships can share a hex without becoming illegible.
- Whether the hex-based firing-arc visualization makes broadside / fore / aft instantly readable on selection.

## Controls

- **Click** a ship to select it. Selected ship gets an amber outline, and its firing arcs paint the rest of the board:
  - **Deeper amber** hexes = fore and aft — a single hex-wide line directly along the bow / stern direction.
  - **Lighter amber** hexes = port and starboard broadsides — a 60° cone on each side, bounded by the fore-port / aft-port hex directions on the port side and fore-stbd / aft-stbd on the starboard side.
  - **Un-tinted** hexes are in *no* arc. The dead zones are the wedges between the fore line and each broadside cone (and between aft and each cone) — those hexes can't be targeted from any of the ship's batteries.
- **Click empty board** to deselect.
- **Drag** any ship to any hex (including the two reserve ships in the right-side palette). Green highlight = valid drop, red = the target hex already holds 4 ships.
- **`Q` / `E`** rotate the selected ship 60° counter-clockwise / clockwise. Six possible facings, all aligned so the ship's flat sides parallel the hex's flat sides.
- **Show coords** checkbox in the header toggles `col,row` debug labels.
- **Reset** restores the initial setup.

## Run locally

```bash
git clone https://github.com/docMurk/undaunted-high-seas-prototype.git
cd undaunted-high-seas-prototype
npm install
npm run dev
```

Then open the URL Vite prints (usually http://localhost:5173).

## Stack

- React (single-component prototype, all state local)
- Vite + Tailwind v4
- SVG for the entire board, tokens, and arc overlay — no canvas, no images

The whole prototype lives in [`src/App.jsx`](./src/App.jsx).
