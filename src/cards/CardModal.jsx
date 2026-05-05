// Z-modal: large view-only overlay for inspecting a single card.

import React, { useEffect } from 'react';
import Card from './Card.jsx';

export default function CardModal({ card, cardData, onClose }) {
  useEffect(() => {
    if (!card) return;
    const onKey = (e) => {
      if (e.key === 'Escape' || e.key === 'z' || e.key === 'Z') onClose?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [card, onClose]);

  if (!card) return null;
  return (
    <div
      className="fixed inset-0 z-[100] bg-black/70 flex items-center justify-center"
      onClick={onClose}
    >
      <div onClick={(e) => e.stopPropagation()}>
        <Card card={card} cardData={cardData} size="xl" draggable={false} showHoverZoom={false} />
      </div>
    </div>
  );
}
