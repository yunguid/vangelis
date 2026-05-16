import React, { useState } from 'react';
import { VOICE_PRESETS } from '../../utils/voicePhrase.js';

const stopKeyboardPropagation = (event) => {
  event.stopPropagation();
};

const deleteSelection = (value, selectionStart, selectionEnd, key) => {
  let start = selectionStart;
  let end = selectionEnd;

  if (start === end && key === 'Backspace') {
    start = Math.max(0, start - 1);
  } else if (start === end && key === 'Delete') {
    end = Math.min(value.length, end + 1);
  }

  return {
    caret: start,
    value: `${value.slice(0, start)}${value.slice(end)}`
  };
};

const VoiceTab = ({
  text = '',
  previewChunks = [],
  voiceStatus = {},
  isPreparing,
  isGenerating,
  error,
  onTextChange = () => {},
  onPresetSelect = () => {},
  onRandomize = () => {},
  onToggle = () => {},
  onClear = () => {}
}) => {
  const [isTyping, setIsTyping] = useState(false);
  const isArmed = !!voiceStatus?.enabled;
  const hasRenderedPhrase = (voiceStatus?.chunkCount || 0) > 0;
  const activeChunkId = voiceStatus?.lastChunk?.id || null;
  const nextChunkId = isArmed ? previewChunks[voiceStatus?.nextIndex || 0]?.id : null;
  const stateLabel = isPreparing
    ? 'Rendering'
    : isArmed
      ? 'Voice on'
      : hasRenderedPhrase
        ? 'Voice off'
        : 'Empty';
  const toggleLabel = isArmed ? 'Turn voice off' : 'Turn voice on';

  const handlePhraseKeyDown = (event) => {
    event.stopPropagation();

    if (
      (event.key !== 'Backspace' && event.key !== 'Delete')
      || event.metaKey
      || event.ctrlKey
      || event.altKey
    ) {
      return;
    }

    const target = event.currentTarget;
    const nextText = deleteSelection(target.value, target.selectionStart, target.selectionEnd, event.key);

    event.preventDefault();
    onTextChange(nextText.value);
    window.requestAnimationFrame(() => {
      target.setSelectionRange(nextText.caret, nextText.caret);
    });
  };

  return (
    <div className="voice-tab">
      <section className="voice-tab__section">
        <div className="voice-tab__label-row">
          <label className="voice-tab__label" htmlFor="voice-phrase-input">
            Phrase
          </label>
          <div className="voice-tab__label-actions">
            <button
              type="button"
              className="voice-tab__dice"
              onClick={onRandomize}
              disabled={isGenerating}
              aria-label="Generate random voice phrase"
              title="Generate random voice phrase"
            >
              <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
                <rect x="4.5" y="4.5" width="15" height="15" rx="3" fill="none" stroke="currentColor" strokeWidth="1.8" />
                <circle cx="9" cy="9" r="1.25" fill="currentColor" />
                <circle cx="15" cy="9" r="1.25" fill="currentColor" />
                <circle cx="12" cy="12" r="1.25" fill="currentColor" />
                <circle cx="9" cy="15" r="1.25" fill="currentColor" />
                <circle cx="15" cy="15" r="1.25" fill="currentColor" />
              </svg>
            </button>
            <span className={`voice-tab__typing ${isTyping ? 'voice-tab__typing--on' : ''}`}>
              {isGenerating ? 'Rolling' : isTyping ? 'Typing' : 'Keys play'}
            </span>
          </div>
        </div>
        <textarea
          id="voice-phrase-input"
          className="voice-tab__input"
          value={text}
          onChange={(event) => onTextChange(event.target.value)}
          onKeyDown={handlePhraseKeyDown}
          onKeyUp={stopKeyboardPropagation}
          onFocus={() => setIsTyping(true)}
          onBlur={() => setIsTyping(false)}
          rows={4}
          spellCheck={false}
          placeholder="I am alive"
        />
      </section>

      <section className="voice-tab__section">
        <h3 className="voice-tab__heading">Presets</h3>
        <div className="voice-tab__preset-row">
          {VOICE_PRESETS.map((preset) => (
            <button
              key={preset}
              type="button"
              className="voice-tab__preset"
              onClick={() => onPresetSelect(preset)}
            >
              {preset}
            </button>
          ))}
        </div>
      </section>

      <section className="voice-tab__section">
        <div className="voice-tab__statebar">
          <span className={`voice-tab__state-dot ${isArmed ? 'voice-tab__state-dot--on' : ''}`} aria-hidden="true" />
          <span>{stateLabel}</span>
          <span className="voice-tab__state-count">{previewChunks.length} chunks</span>
        </div>
        <div className="voice-tab__toolbar">
          <button
            type="button"
            className={`voice-tab__toggle ${isArmed ? 'voice-tab__toggle--on' : ''}`}
            onClick={() => onToggle(!isArmed)}
            disabled={!hasRenderedPhrase || isPreparing}
            aria-pressed={isArmed}
          >
            {toggleLabel}
          </button>
          <button
            type="button"
            className="voice-tab__ghost"
            onClick={onClear}
            disabled={!hasRenderedPhrase && (text || '').length === 0}
          >
            Clear
          </button>
        </div>
        {error && (
          <p className="voice-tab__error" role="alert">{error}</p>
        )}
      </section>

      <section className="voice-tab__section">
        <h3 className="voice-tab__heading">Chunks</h3>
        {previewChunks.length > 0 ? (
          <div className="voice-tab__chunks" aria-live="polite">
            {previewChunks.map((chunk, index) => (
              <span
                key={`${chunk.id}-${index}`}
                className={[
                  'voice-tab__chunk',
                  activeChunkId === chunk.id ? 'voice-tab__chunk--active' : '',
                  nextChunkId === chunk.id ? 'voice-tab__chunk--next' : ''
                ].filter(Boolean).join(' ')}
                title={chunk.phonemes}
              >
                <span className="voice-tab__chunk-index">{index + 1}</span>
                {chunk.label}
              </span>
            ))}
          </div>
        ) : (
          <p className="voice-tab__empty">No chunks yet.</p>
        )}
      </section>
    </div>
  );
};

export default VoiceTab;
