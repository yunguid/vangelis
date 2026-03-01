import React, { useEffect, useMemo, useRef, useState } from 'react';

const normalize = (value) => value.toLowerCase().trim();

const matchesQuery = (action, query) => {
  if (!query) return true;
  const haystack = [
    action.label,
    action.description || '',
    ...(Array.isArray(action.keywords) ? action.keywords : [])
  ]
    .join(' ')
    .toLowerCase();
  return haystack.includes(query);
};

const CommandPalette = ({ open, onClose, actions, onSelect }) => {
  const inputRef = useRef(null);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);

  const filteredActions = useMemo(() => {
    const normalized = normalize(query);
    return actions.filter((action) => matchesQuery(action, normalized));
  }, [actions, query]);

  useEffect(() => {
    if (!open) {
      setQuery('');
      setActiveIndex(0);
      return;
    }
    const id = window.requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
    return () => window.cancelAnimationFrame(id);
  }, [open]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  useEffect(() => {
    if (!open) return undefined;

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setActiveIndex((prev) => {
          if (filteredActions.length === 0) return 0;
          return (prev + 1) % filteredActions.length;
        });
        return;
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setActiveIndex((prev) => {
          if (filteredActions.length === 0) return 0;
          return (prev - 1 + filteredActions.length) % filteredActions.length;
        });
        return;
      }
      if (event.key === 'Enter') {
        event.preventDefault();
        const active = filteredActions[activeIndex];
        if (!active) return;
        onSelect(active);
        onClose();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeIndex, filteredActions, onClose, onSelect, open]);

  if (!open) return null;

  return (
    <div className="command-palette-overlay" role="dialog" aria-modal="true" aria-label="Command palette">
      <div className="command-palette panel tier-support">
        <label className="sr-only" htmlFor="command-palette-search">Find command</label>
        <input
          id="command-palette-search"
          ref={inputRef}
          type="search"
          className="command-palette__input"
          placeholder="Type a command"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        {filteredActions.length > 0 ? (
          <ul className="command-palette__list" role="listbox" aria-label="Command results">
            {filteredActions.map((action, index) => (
              <li key={action.id} className="command-palette__item">
                <button
                  type="button"
                  className={`command-palette__action ${index === activeIndex ? 'command-palette__action--active' : ''}`}
                  onClick={() => {
                    onSelect(action);
                    onClose();
                  }}
                >
                  <span className="command-palette__label">{action.label}</span>
                  {action.shortcut && (
                    <kbd className="command-palette__shortcut">{action.shortcut}</kbd>
                  )}
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="command-palette__empty">No command found.</p>
        )}
      </div>
    </div>
  );
};

export default CommandPalette;
