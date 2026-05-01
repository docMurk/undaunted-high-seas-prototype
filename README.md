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
  - **Lighter amber** hexes = port + starboard broadsides
  - **Deeper amber** hexes = fore and aft (the line of hexes directly forward / backward)
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
