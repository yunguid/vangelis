import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { inlineRuns, parseJourney } from '../utils/journeyMarkdown.js';
import '../styles/journey-dialog.css';

// How each replica was rebuilt, as written up beside it (docs/replicas/<piece>/JOURNEY.md).
// Each loads only when its pop-up opens.
const JOURNEYS = {
  pernambuco: () => import('../../docs/replicas/pernambuco/JOURNEY.md?raw'),
  'shade-of-the-mango-tree': () => import('../../docs/replicas/shade-of-the-mango-tree/JOURNEY.md?raw'),
  'blade-runner-blues': () => import('../../docs/replicas/blade-runner-blues/JOURNEY.md?raw'),
  'memories-of-green': () => import('../../docs/replicas/memories-of-green/JOURNEY.md?raw')
};

const CLOSE_ICON = (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);

const Inline = ({ text }) => inlineRuns(text).map((run, index) => {
  if (run.type === 'strong') return <strong key={index}>{run.text}</strong>;
  if (run.type === 'em') return <em key={index}>{run.text}</em>;
  if (run.type === 'code') return <code key={index}>{run.text}</code>;
  return <React.Fragment key={index}>{run.text}</React.Fragment>;
});

const Block = ({ block }) => {
  if (block.type === 'heading') return <h3><Inline text={block.text} /></h3>;
  if (block.type === 'list') {
    return <ul>{block.items.map((item, index) => <li key={index}><Inline text={item} /></li>)}</ul>;
  }
  if (block.type === 'table') {
    return (
      <div className="journey-dialog__table">
        <table>
          <thead><tr>{block.header.map((cell, index) => <th key={index} scope="col"><Inline text={cell} /></th>)}</tr></thead>
          <tbody>
            {block.rows.map((row, index) => (
              <tr key={index}>{row.map((cell, column) => <td key={column}><Inline text={cell} /></td>)}</tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
  return <p><Inline text={block.text} /></p>;
};

/** The journey of one replica, read in a pop-up over the page. */
const JourneyDialog = ({ journey, onClose }) => {
  const [blocks, setBlocks] = useState(null);
  const [failed, setFailed] = useState(false);
  const closeButton = useRef(null);

  useEffect(() => {
    let current = true;
    JOURNEYS[journey]()
      .then((module) => { if (current) setBlocks(parseJourney(module.default)); })
      .catch((error) => {
        console.error(`The ${journey} journey could not be loaded:`, error);
        if (current) setFailed(true);
      });
    return () => { current = false; };
  }, [journey]);

  // Preact ignores autoFocus, so the close button takes focus here.
  useEffect(() => { closeButton.current?.focus(); }, []);

  useEffect(() => {
    const handleKey = (event) => {
      if (event.key !== 'Escape') return;
      event.stopPropagation();
      onClose();
    };
    window.addEventListener('keydown', handleKey, true);
    return () => window.removeEventListener('keydown', handleKey, true);
  }, [onClose]);

  // The document's own title heads the pop-up; the rest is its body.
  const [first, ...rest] = blocks || [];
  const titled = first?.type === 'heading' && first.level === 1;
  const title = titled ? first.text : 'How it was made';
  const body = titled ? rest : blocks || [];

  // At the page's root, so it covers the sound dial and the dock whatever opened it.
  return createPortal(
    <div className="journey-overlay" onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="journey-dialog" role="dialog" aria-modal="true" aria-labelledby="journey-dialog-title">
        <div className="journey-dialog__header">
          <h2 id="journey-dialog-title">{title}</h2>
          <button ref={closeButton} type="button" className="btn btn--icon" aria-label="Close" title="Close" onClick={onClose}>
            {CLOSE_ICON}
          </button>
        </div>
        <div className="journey-dialog__body">
          {failed && <p>This journey could not be loaded.</p>}
          {body.map((block, index) => <Block key={index} block={block} />)}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default JourneyDialog;
