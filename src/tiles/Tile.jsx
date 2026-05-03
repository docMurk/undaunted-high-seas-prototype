// Renders a single BoB-style 5-hex tileset (3+2 cluster) in flat-top hexes.
// Layout depends on origin-col parity (odd-q offset means the right column's
// vertical alignment alternates with parity). For thumbnails (palette) the
// origin is treated as col=0 (even).
import React from 'react';
import { HEX_SIZE, getTileLayout } from '../hex/coords.js';

const TERRAIN_COLOR = {
  water: 'url(#waterGrad)',
  coast: 'url(#coastPattern)',
  sand:  'url(#sandPattern)',
  rock:  'url(#rockPattern)',
  reef:  'url(#reefPattern)',
  fog:   'url(#waterGrad)',
};

const HEX_STROKE = '#0a1f33';
const TILE_BOUNDARY = '#3a587a';

/**
 * @param tile          tile descriptor { hexes: [{slot, terrain, hasFort}], ... }
 * @param rotation      0 or 180
 * @param anchor        { x, y } pixel center for box-(0, 0) hex
 * @param size          hex radius
 * @param originCol     absolute column of the box-(0, 0) hex (for parity);
 *                      defaults to 0 (even) for palette thumbnails
 * @param showBoundary  draw thin tile-edge outline
 * @param selected      draw selection ring
 * @param thumbnail     reduce stroke widths for small previews
 */
export default function Tile({
  tile, rotation = 0, anchor, size = HEX_SIZE,
  originCol = 0,
  showBoundary = true, selected = false, faded = false,
  onPointerDown, thumbnail = false,
}) {
  if (!tile) return null;
  const sw = thumbnail ? 0.5 : 1.0;
  const boundarySw = thumbnail ? 0.7 : 1.4;
  const opacity = faded ? 0.55 : 1;

  const hsize = size;
  const hwidth = 2 * hsize;
  const hspace = hwidth * 0.75;
  const vspace = Math.sqrt(3) * hsize;

  const originParityOffset = (originCol % 2 === 1) ? vspace / 2 : 0;

  // Pixel center for a (boxCol, boxRow) relative to the box-(0,0) anchor.
  // Uses absolute col parity for the col-offset term, then subtracts the
  // origin's offset (since `anchor` already includes it).
  const boxHexPx = (boxCol, boxRow) => {
    const absParityOffset = (((originCol + boxCol) % 2 === 1) ? vspace / 2 : 0);
    return {
      x: anchor.x + boxCol * hspace,
      y: anchor.y + boxRow * vspace + (absParityOffset - originParityOffset),
    };
  };

  // Flat-top hex polygon points at given (cx, cy) and size.
  const points = (cx, cy, sz) => {
    const pts = [];
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI / 180) * (60 * i);
      pts.push(`${(cx + sz * Math.cos(a)).toFixed(2)},${(cy + sz * Math.sin(a)).toFixed(2)}`);
    }
    return pts.join(' ');
  };

  const layout = getTileLayout(originCol, rotation);

  const slotEls = layout.slots.map(({ slot, boxCol, boxRow }) => {
    const hex = tile.hexes.find(h => h.slot === slot);
    if (!hex) return null;
    const c = boxHexPx(boxCol, boxRow);
    const fill = TERRAIN_COLOR[hex.terrain] || 'url(#waterGrad)';
    const isFog = hex.terrain === 'fog';
    return (
      <g key={`s-${slot}`}>
        <polygon
          points={points(c.x, c.y, hsize - 0.4)}
          fill={fill}
          stroke={HEX_STROKE}
          strokeWidth={sw}
        />
        {isFog && (
          <polygon
            points={points(c.x, c.y, hsize - 1.2)}
            fill="#e8f0f5"
            opacity="0.55"
            filter="url(#fogNoise)"
            pointerEvents="none"
          />
        )}
        {hex.hasFort && (
          <use href="#fortGlyph"
               x={c.x - hsize * 0.42} y={c.y - hsize * 0.42}
               width={hsize * 0.84} height={hsize * 0.84}
               pointerEvents="none" />
        )}
      </g>
    );
  });

  const boundary = showBoundary && (
    <g pointerEvents="none">
      {layout.slots.map(({ slot, boxCol, boxRow }) => {
        const c = boxHexPx(boxCol, boxRow);
        return (
          <polygon
            key={`b-${slot}`}
            points={points(c.x, c.y, hsize - 0.2)}
            fill="none"
            stroke={TILE_BOUNDARY}
            strokeWidth={boundarySw}
            opacity="0.85"
          />
        );
      })}
    </g>
  );

  const ring = selected && (
    <g pointerEvents="none">
      {layout.slots.map(({ slot, boxCol, boxRow }) => {
        const c = boxHexPx(boxCol, boxRow);
        return (
          <polygon
            key={`r-${slot}`}
            points={points(c.x, c.y, hsize + 1.6)}
            fill="none"
            stroke="#fbbf24"
            strokeWidth="2.4"
            opacity="0.9"
          />
        );
      })}
    </g>
  );

  return (
    <g
      style={{ opacity, cursor: onPointerDown ? 'grab' : 'default' }}
      onPointerDown={onPointerDown}
    >
      {slotEls}
      {boundary}
      {ring}
    </g>
  );
}
