import React from 'react';
import './ProjectBrowser.css';

/**
 * Every project the editor knows: the ones on this device, and, when signed
 * in, the ones in the account that this device has not opened yet. Loaded
 * lazily; it only receives plain entries and callbacks.
 */

// Its own icons: importing the editor's icon module would pull the editor's
// chunk into this lazy one and break the build's route guard (see CLAUDE.md).
const icon = (paths) => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {paths}
  </svg>
);
const ICON_PLUS = icon(<path d="M12 5.5v13M5.5 12h13" />);
const ICON_CLOSE = icon(<path d="m6.5 6.5 11 11M17.5 6.5l-11 11" />);
const ICON_DUPLICATE = icon(
  <>
    <rect x="8.5" y="8.5" width="11" height="11" />
    <path d="M15.5 8.5v-4h-11v11h4" />
  </>
);
const ICON_TRASH = icon(<path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l.9 12.5h9.2L17.5 7" />);

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const whenLabel = (time, now) => {
  if (!time) return '';
  const age = now - time;
  if (age < MINUTE) return 'just now';
  if (age < HOUR) return `${Math.floor(age / MINUTE)} min ago`;
  if (age < DAY) return `${Math.floor(age / HOUR)} h ago`;
  if (age < 7 * DAY) return `${Math.floor(age / DAY)} d ago`;
  return new Date(time).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
};

// Written out whole: the build's CSS reachability guard cannot see composed names.
const WHERE = {
  device: { label: 'This device', className: 'project-browser__where' },
  account: { label: 'Account', className: 'project-browser__where project-browser__where--account' },
  pending: { label: 'Not synced', className: 'project-browser__where project-browser__where--pending' }
};

const ProjectBrowser = ({
  entries,
  currentId,
  footnote,
  onOpen,
  onDuplicate,
  onDelete,
  onNew,
  onClose
}) => {
  const [query, setQuery] = React.useState('');
  const [confirmKey, setConfirmKey] = React.useState(null);
  const searchRef = React.useRef(null);
  const now = Date.now();

  // Focus by hand: Preact leaves an inserted autoFocus input unfocused.
  React.useEffect(() => {
    searchRef.current?.focus();
  }, []);

  const needle = query.trim().toLowerCase();
  const shown = needle
    ? entries.filter((entry) => entry.name.toLowerCase().includes(needle))
    : entries;

  return (
    <section className="project-browser" role="dialog" aria-label="Projects">
      <header className="project-browser__head">
        <h2 className="project-browser__title">Projects</h2>
        <span className="project-browser__count">{entries.length}</span>
        <button type="button" className="project-browser__new" onClick={onNew}>
          {ICON_PLUS}
          <span>New project</span>
        </button>
        <button
          type="button"
          className="project-browser__icon"
          onClick={onClose}
          aria-label="Close projects"
          title="Close (Esc)"
        >
          {ICON_CLOSE}
        </button>
      </header>
      {entries.length > 6 && (
        <input
          ref={searchRef}
          type="search"
          className="project-browser__search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Find a project"
          aria-label="Find a project"
        />
      )}
      {shown.length === 0 ? (
        <p className="project-browser__empty">
          {entries.length === 0 ? 'Nothing saved yet. Notes you draw save themselves.' : 'No project by that name.'}
        </p>
      ) : (
        <ul className="project-browser__list">
          {shown.map((entry) => {
            const isCurrent = entry.key === currentId;
            const confirming = confirmKey === entry.key;
            return (
              <li key={entry.key} className={`project-browser__row${isCurrent ? ' is-current' : ''}`}>
                <button
                  type="button"
                  className="project-browser__open"
                  onClick={() => onOpen(entry)}
                  aria-current={isCurrent ? 'true' : undefined}
                  title={isCurrent ? 'Open now' : `Open ${entry.name}`}
                >
                  <span className="project-browser__name">{entry.name}</span>
                  <span className="project-browser__meta">
                    {entry.bars} bars · {entry.bpm} BPM · {entry.noteCount} notes · {whenLabel(entry.updatedAt, now)}
                  </span>
                  <span className={WHERE[entry.where].className}>{WHERE[entry.where].label}</span>
                </button>
                {confirming ? (
                  <span className="project-browser__confirm" role="group" aria-label={`Delete ${entry.name}?`}>
                    <button
                      type="button"
                      className="project-browser__danger"
                      onClick={() => {
                        setConfirmKey(null);
                        onDelete(entry);
                      }}
                    >
                      Delete
                    </button>
                    <button type="button" className="project-browser__keep" onClick={() => setConfirmKey(null)}>
                      Keep
                    </button>
                  </span>
                ) : (
                  <span className="project-browser__actions">
                    <button
                      type="button"
                      className="project-browser__icon"
                      onClick={() => onDuplicate(entry)}
                      aria-label={`Duplicate ${entry.name}`}
                      title="Duplicate"
                    >
                      {ICON_DUPLICATE}
                    </button>
                    <button
                      type="button"
                      className="project-browser__icon"
                      onClick={() => setConfirmKey(entry.key)}
                      aria-label={`Delete ${entry.name}`}
                      title="Delete"
                    >
                      {ICON_TRASH}
                    </button>
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {footnote && <p className="project-browser__foot">{footnote}</p>}
    </section>
  );
};

export default ProjectBrowser;
