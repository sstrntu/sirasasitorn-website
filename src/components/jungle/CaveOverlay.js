import React, { useEffect } from 'react';
import { CAVE_ITEMS } from '../../data/caveItems';

/**
 * The page's overlay while in the hidden cave (Cave.js): a way back to camp,
 * the cave's name with how to look around, and the card for the item the
 * visitor tapped. Escape closes the card, then leaves the cave.
 */
const CaveOverlay = ({ exhibit, onClose, onLeave }) => {
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      if (exhibit !== null) onClose();
      else onLeave();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [exhibit, onClose, onLeave]);

  const item = exhibit !== null ? CAVE_ITEMS[exhibit] : null;
  return (
    <>
      <button type="button" className="jungle-button jungle-cave-back" onClick={onLeave}>
        <span aria-hidden="true">←</span> Back to camp
      </button>
      <div className="jungle-cave-title" role="status">
        <div className="jungle-cave-name">Sira’s hidden lab</div>
        <div className="jungle-cave-sub">Tap an item · drag to look around</div>
      </div>
      {item && (
        <div className="jungle-exhibit" role="dialog" aria-labelledby="jungle-exhibit-title">
          <button type="button" className="jungle-exhibit-close" aria-label="Close" onClick={onClose}>
            ×
          </button>
          <h2 id="jungle-exhibit-title">{item.name}</h2>
          <p>{item.description}</p>
          {item.url && (
            <a className="jungle-button" href={item.url} target="_blank" rel="noopener noreferrer">
              Visit <span aria-hidden="true">↗</span>
            </a>
          )}
        </div>
      )}
    </>
  );
};

export default CaveOverlay;
