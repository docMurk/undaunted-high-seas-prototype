// Tiny shared drag-and-drop payload helpers. Keep cardKey + source location
// on the dataTransfer so any zone can resolve a drop without prop drilling.

export const CARD_MIME = 'application/x-highseas-card';

export function setDragPayload(e, payload) {
  try {
    e.dataTransfer.setData(CARD_MIME, JSON.stringify(payload));
    e.dataTransfer.setData('text/plain', payload.cardKey || '');
    e.dataTransfer.effectAllowed = 'move';
  } catch {
    // some environments restrict custom mime types — fall back silently
  }
}

export function getDragPayload(e) {
  try {
    const raw = e.dataTransfer.getData(CARD_MIME);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function isCardDrag(e) {
  return Array.from(e.dataTransfer?.types || []).includes(CARD_MIME);
}
