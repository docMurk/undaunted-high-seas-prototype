// Sidebar of generated tile thumbnails. Paginated 12 tiles per page.
import React, { useState, useEffect } from 'react';
import Tile from './Tile.jsx';
import TileDefs from './TileDefs.jsx';
import { HEX_SIZE } from '../hex/coords.js';

const PAGE_SIZE = 12;
const THUMB_HEX = 11; // visual hex radius in palette thumbnails

function ThumbSvg({ tile, rotation = 0 }) {
  // Flat-top tile bbox: 2 cols * 0.75*HEX_WIDTH + extra width = 1.75*HEX_WIDTH
  // Height: 3 rows * HEX_VSPACE + 0.5*HEX_VSPACE (col-1 offset)
  const hsize = THUMB_HEX;
  const hwidth = 2 * hsize;
  const hspace = hwidth * 0.75;
  const vspace = Math.sqrt(3) * hsize;
  const pad = 3;
  const w = hwidth + hspace + pad * 2;
  const h = 3 * vspace + vspace / 2 + pad * 2;
  // Anchor = center of (boxCol=0, boxRow=0) hex.
  const anchor = { x: pad + hwidth / 2, y: pad + vspace / 2 };
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: 'block' }}>
      <Tile
        tile={tile}
        rotation={rotation}
        anchor={anchor}
        size={hsize}
        showBoundary={false}
        thumbnail
      />
    </svg>
  );
}

export default function TilePalette({
  palette, onStartDrag, onRegenerateTile, onRotatePreview, rotations,
}) {
  const [page, setPage] = useState(0);
  const totalPages = Math.max(1, Math.ceil(palette.length / PAGE_SIZE));

  // Clamp page if palette shrinks (regenerate-palette can yield same length;
  // this is just defensive).
  useEffect(() => {
    if (page >= totalPages) setPage(totalPages - 1);
  }, [page, totalPages]);

  const start = page * PAGE_SIZE;
  const visible = palette.slice(start, start + PAGE_SIZE);

  return (
    <div className="flex flex-col h-full bg-slate-900/90 ring-1 ring-slate-800 rounded-lg overflow-hidden">
      <div className="px-3 py-2 border-b border-slate-800 text-xs uppercase tracking-wider text-slate-400 flex items-center justify-between">
        <span>Tiles ({palette.length})</span>
        <span className="text-slate-500 text-[10px] normal-case tracking-normal">drag to board</span>
      </div>

      <div className="overflow-y-auto p-2 flex-1">
        <div className="grid grid-cols-3 gap-2">
          {visible.map((tile, vi) => {
            const idx = start + vi;
            const rot = rotations[tile.id] || 0;
            return (
              <div
                key={tile.id}
                className="relative bg-slate-800/60 rounded-md p-1 hover:bg-slate-800 transition group"
                style={{ touchAction: 'none' }}
              >
                <div
                  onPointerDown={(e) => onStartDrag(e, idx, rot)}
                  className="cursor-grab active:cursor-grabbing flex justify-center"
                  title={`${tile.category}${tile.fortVariant ? ' · ' + tile.fortVariant : ''}`}
                >
                  <ThumbSvg tile={tile} rotation={rot} />
                </div>
                <div className="absolute top-0 right-0 flex flex-col gap-0.5 p-0.5 opacity-0 group-hover:opacity-100 transition">
                  <button
                    title="Rotate 180°"
                    onClick={() => onRotatePreview(tile.id)}
                    className="px-1 py-0.5 text-[9px] rounded bg-slate-700 hover:bg-slate-600 text-slate-100"
                  >↻</button>
                  <button
                    title="Regenerate"
                    onClick={() => onRegenerateTile(idx)}
                    className="px-1 py-0.5 text-[9px] rounded bg-slate-700 hover:bg-slate-600 text-slate-100"
                  >↺</button>
                </div>
                <div className="text-[9px] text-slate-500 text-center mt-0.5 leading-tight">
                  {tile.category}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="px-2 py-2 border-t border-slate-800 flex items-center justify-between gap-2">
        <button
          onClick={() => setPage(p => Math.max(0, p - 1))}
          disabled={page === 0}
          className="px-2 py-1 text-xs rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-slate-200"
        >‹ Prev</button>
        <div className="text-[11px] text-slate-400 tabular-nums">
          Page {page + 1} / {totalPages}
        </div>
        <button
          onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
          disabled={page >= totalPages - 1}
          className="px-2 py-1 text-xs rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-slate-200"
        >Next ›</button>
      </div>
    </div>
  );
}

export function PaletteDefsSvg() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }}>
      <TileDefs />
    </svg>
  );
}
