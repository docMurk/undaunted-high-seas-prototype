// Cursor-anchored wheel zoom + right/middle-click drag pan for the board SVG.
// Active only when `enabled` (i.e. state.locked → play mode). Resets viewBox
// on every enable/disable transition. All existing hit-testing keeps working
// because it goes through getScreenCTM, which already accounts for viewBox.
import { useEffect, useRef, useState } from 'react';

const ZOOM_STEP = 1.15;
const MAX_ZOOM = 6;     // 6× zoom-in cap
const MIN_ZOOM = 1;     // never zoom out past 1× (no negative space)

export function useZoomPan({ svgRef, enabled, viewW, viewH }) {
  const [vb, setVb] = useState({ x: 0, y: 0, w: viewW, h: viewH });
  const vbRef = useRef(vb);
  useEffect(() => { vbRef.current = vb; }, [vb]);

  // Reset to full view whenever enable state or board dimensions change.
  useEffect(() => {
    setVb({ x: 0, y: 0, w: viewW, h: viewH });
  }, [enabled, viewW, viewH]);

  // Wheel zoom (cursor-anchored). React's onWheel is passive in modern
  // versions and won't allow preventDefault, so attach natively.
  useEffect(() => {
    if (!enabled) return;
    const svg = svgRef.current;
    if (!svg) return;
    const onWheel = (e) => {
      e.preventDefault();
      const pt = svg.createSVGPoint();
      pt.x = e.clientX; pt.y = e.clientY;
      const ctm = svg.getScreenCTM();
      if (!ctm) return;
      const p = pt.matrixTransform(ctm.inverse());
      const factor = e.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP;
      const cur = vbRef.current;
      const minW = viewW / MAX_ZOOM, minH = viewH / MAX_ZOOM;
      const maxW = viewW / MIN_ZOOM, maxH = viewH / MIN_ZOOM;
      const newW = Math.max(minW, Math.min(maxW, cur.w / factor));
      const newH = Math.max(minH, Math.min(maxH, cur.h / factor));
      // Keep cursor over the same SVG point after the zoom.
      const newX = p.x - (p.x - cur.x) * (newW / cur.w);
      const newY = p.y - (p.y - cur.y) * (newH / cur.h);
      const cx = Math.max(0, Math.min(viewW - newW, newX));
      const cy = Math.max(0, Math.min(viewH - newH, newY));
      setVb({ x: cx, y: cy, w: newW, h: newH });
    };
    svg.addEventListener('wheel', onWheel, { passive: false });
    return () => svg.removeEventListener('wheel', onWheel);
  }, [enabled, svgRef, viewW, viewH]);

  // Right- or middle-button drag → pan. Left button is reserved for ship
  // interaction. Suppress contextmenu over the board so right-drag is clean.
  useEffect(() => {
    if (!enabled) return;
    const svg = svgRef.current;
    if (!svg) return;
    let pan = null;
    const onDown = (e) => {
      if (e.button !== 1 && e.button !== 2) return;
      e.preventDefault();
      e.stopPropagation();
      const rect = svg.getBoundingClientRect();
      pan = {
        startClient: { x: e.clientX, y: e.clientY },
        startVb: vbRef.current,
        // Fixed conversion factor for the duration of the drag.
        unitsPerPxX: vbRef.current.w / rect.width,
        unitsPerPxY: vbRef.current.h / rect.height,
        pointerId: e.pointerId,
      };
      svg.setPointerCapture?.(e.pointerId);
    };
    const onMove = (e) => {
      if (!pan) return;
      const dx = (e.clientX - pan.startClient.x) * pan.unitsPerPxX;
      const dy = (e.clientY - pan.startClient.y) * pan.unitsPerPxY;
      const sv = pan.startVb;
      const nx = Math.max(0, Math.min(viewW - sv.w, sv.x - dx));
      const ny = Math.max(0, Math.min(viewH - sv.h, sv.y - dy));
      setVb({ x: nx, y: ny, w: sv.w, h: sv.h });
    };
    const onUp = (e) => {
      if (pan) {
        svg.releasePointerCapture?.(pan.pointerId);
        pan = null;
      }
    };
    const onCtx = (e) => e.preventDefault();
    svg.addEventListener('pointerdown', onDown);
    svg.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    svg.addEventListener('contextmenu', onCtx);
    return () => {
      svg.removeEventListener('pointerdown', onDown);
      svg.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      svg.removeEventListener('contextmenu', onCtx);
    };
  }, [enabled, svgRef, viewW, viewH]);

  // '0' resets zoom.
  useEffect(() => {
    if (!enabled) return;
    const onKey = (e) => {
      const tag = e.target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.key === '0') setVb({ x: 0, y: 0, w: viewW, h: viewH });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [enabled, viewW, viewH]);

  return {
    viewBox: `${vb.x} ${vb.y} ${vb.w} ${vb.h}`,
    isZoomed: vb.w < viewW - 0.01,
  };
}
