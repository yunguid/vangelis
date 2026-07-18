import React from 'react';
import {
  ADSR_SLIDERS,
  DELAY_FEEDBACK_SLIDER,
  DELAY_MIX_SLIDER,
  DELAY_TIME_SLIDER,
  DISTORTION_SLIDER,
  FILTER_SLIDERS,
  FM_SLIDERS,
  LFO1_RATE_SLIDER,
  LFO2_RATE_SLIDER,
  ModMatrixEditor,
  REVERB_DECAY_SLIDER,
  REVERB_MIX_SLIDER,
  REVERB_SIZE_SLIDER,
  SliderControl,
  UNISON_SLIDERS
} from '../components/controls/audioControlPrimitives.jsx';
import { AUDIO_PARAM_DEFAULTS } from '../utils/audioParams.js';
import { HOME_HREF } from '../utils/routes.js';

const STAGES = [
  { id: 'base', label: 'Base' },
  { id: 'tone', label: 'Tone' },
  { id: 'motion', label: 'Motion' },
  { id: 'space', label: 'Space' },
  { id: 'mint', label: 'Mint' }
];

const STAGE_INDEX = Object.fromEntries(STAGES.map((stage, index) => [stage.id, index]));

const renderSlider = (slider, audioParams, onParamChange) => {
  const paramValue = typeof audioParams?.[slider.param] === 'number'
    ? audioParams[slider.param]
    : AUDIO_PARAM_DEFAULTS[slider.param];
  const paramDefault = AUDIO_PARAM_DEFAULTS[slider.param];
  return (
    <SliderControl
      key={slider.id}
      id={slider.id}
      label={slider.label}
      value={slider.toSlider(paramValue)}
      displayValue={slider.display(paramValue)}
      min={slider.min}
      max={slider.max}
      step={slider.step}
      defaultValue={typeof paramDefault === 'number' ? slider.toSlider(paramDefault) : undefined}
      onChange={(value) => onParamChange(slider.param, slider.fromSlider(value))}
      helpText={slider.helpText}
    />
  );
};

const StageFooterNav = ({ stageId, onNavigate }) => {
  const index = STAGE_INDEX[stageId];
  const prevStage = index > 0 ? STAGES[index - 1] : null;
  const nextStage = index < STAGES.length - 1 ? STAGES[index + 1] : null;
  return (
    <div className="stage-card__footer">
      {prevStage && (
        <button
          type="button"
          className="stage-card__back"
          onClick={() => onNavigate(prevStage.id)}
        >
          {`← back: ${prevStage.label}`}
        </button>
      )}
      {nextStage && (
        <button
          type="button"
          className="stage-card__next"
          onClick={() => onNavigate(nextStage.id)}
        >
          {`next: ${nextStage.label} →`}
        </button>
      )}
    </div>
  );
};

const ToneStage = ({ audioParams, onParamChange, onAdvance }) => {
  const useFilter = !!audioParams.useFilter;
  return (
    <div className="stage-card stage-card--tone">
      <div className="stage-card__body">
        <div className="stage-section">
          <label className="toggle-row" htmlFor="tone-use-filter">
            <span>Tone filter</span>
            <input
              id="tone-use-filter"
              type="checkbox"
              checked={useFilter}
              onChange={(event) => onParamChange('useFilter', event.target.checked)}
            />
          </label>
          <div className="slider-grid">
            {FILTER_SLIDERS.map((slider) => renderSlider(slider, audioParams, onParamChange))}
          </div>
        </div>
        <div className="stage-section">
          <h3 className="stage-section__title">Color</h3>
          <div className="slider-grid">
            {renderSlider(DISTORTION_SLIDER, audioParams, onParamChange)}
          </div>
        </div>
      </div>
      <StageFooterNav stageId="tone" onNavigate={onAdvance} />
    </div>
  );
};

const MotionStage = ({ audioParams, onParamChange, onAdvance }) => {
  const useFM = !!audioParams.useFM;
  return (
    <div className="stage-card stage-card--motion">
      <div className="stage-card__body">
        <div className="stage-section">
          <h3 className="stage-section__title">Amplitude envelope</h3>
          <div className="slider-grid slider-grid--four">
            {ADSR_SLIDERS.map((slider) => renderSlider(slider, audioParams, onParamChange))}
          </div>
        </div>
        <div className="stage-section">
          <label className="toggle-row" htmlFor="motion-use-fm">
            <span>Frequency modulation</span>
            <input
              id="motion-use-fm"
              type="checkbox"
              checked={useFM}
              onChange={(event) => onParamChange('useFM', event.target.checked)}
            />
          </label>
          {useFM && (
            <div className="slider-grid">
              {FM_SLIDERS.map((slider) => renderSlider(slider, audioParams, onParamChange))}
            </div>
          )}
        </div>
        <div className="stage-section">
          <h3 className="stage-section__title">LFOs</h3>
          <div className="slider-grid">
            {renderSlider(LFO1_RATE_SLIDER, audioParams, onParamChange)}
            {renderSlider(LFO2_RATE_SLIDER, audioParams, onParamChange)}
          </div>
        </div>
        <div className="stage-section">
          <h3 className="stage-section__title">Mod routes</h3>
          <ModMatrixEditor
            routes={Array.isArray(audioParams.modRoutes) ? audioParams.modRoutes : []}
            onChange={(routes) => onParamChange('modRoutes', routes)}
          />
        </div>
      </div>
      <StageFooterNav stageId="motion" onNavigate={onAdvance} />
    </div>
  );
};

const SpaceStage = ({ audioParams, onParamChange, onAdvance }) => {
  const delayEnabled = !!audioParams.delayEnabled;
  const reverbEnabled = !!audioParams.reverbEnabled;
  return (
    <div className="stage-card stage-card--space">
      <div className="stage-card__body">
        <div className="stage-section">
          <label className="toggle-row" htmlFor="space-use-delay">
            <span>Delay</span>
            <input
              id="space-use-delay"
              type="checkbox"
              checked={delayEnabled}
              onChange={(event) => onParamChange('delayEnabled', event.target.checked)}
            />
          </label>
          <div className="slider-grid">
            {renderSlider(DELAY_MIX_SLIDER, audioParams, onParamChange)}
            {renderSlider(DELAY_FEEDBACK_SLIDER, audioParams, onParamChange)}
            {renderSlider(DELAY_TIME_SLIDER, audioParams, onParamChange)}
          </div>
        </div>
        <div className="stage-section">
          <label className="toggle-row" htmlFor="space-use-reverb">
            <span>Reverb</span>
            <input
              id="space-use-reverb"
              type="checkbox"
              checked={reverbEnabled}
              onChange={(event) => onParamChange('reverbEnabled', event.target.checked)}
            />
          </label>
          <div className="slider-grid">
            {renderSlider(REVERB_MIX_SLIDER, audioParams, onParamChange)}
            {renderSlider(REVERB_SIZE_SLIDER, audioParams, onParamChange)}
            {renderSlider(REVERB_DECAY_SLIDER, audioParams, onParamChange)}
          </div>
        </div>
        <div className="stage-section">
          <h3 className="stage-section__title">Unison</h3>
          <div className="slider-grid">
            {UNISON_SLIDERS.map((slider) => renderSlider(slider, audioParams, onParamChange))}
          </div>
        </div>
      </div>
      <StageFooterNav stageId="space" onNavigate={onAdvance} />
    </div>
  );
};

const MintStage = ({ waveformType, audioParams, onMint, mintedName, onAdvance }) => {
  const [name, setName] = React.useState('');
  const filterSummary = audioParams.useFilter ? 'filter on' : 'filter off';
  const delaySummary = audioParams.delayEnabled ? 'delay on' : 'delay off';
  const reverbSummary = audioParams.reverbEnabled ? 'reverb on' : 'reverb off';
  const summaryLine = `${waveformType} base, ${filterSummary}, ${delaySummary}, ${reverbSummary}`;

  return (
    <div className="stage-card stage-card--mint">
      <div className="stage-card__body stage-card__body--centered">
        {mintedName ? (
          <div className="mint-confirmation" role="status">
            <p className="mint-confirmation__title">{`"${mintedName}" minted.`}</p>
            <a className="mint-confirmation__link" href={HOME_HREF}>
              use it on the main page &rarr;
            </a>
          </div>
        ) : (
          <>
            <p className="stage-section__summary">{summaryLine}</p>
            <label className="mint-name-label" htmlFor="mint-name">
              Name this sound
            </label>
            <input
              id="mint-name"
              type="text"
              className="mint-name-input"
              placeholder="Sound name"
              maxLength={48}
              value={name}
              onChange={(event) => setName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') onMint(name);
              }}
            />
            <button type="button" className="mint-button" onClick={() => onMint(name)}>
              Mint sound
            </button>
          </>
        )}
      </div>
      <StageFooterNav stageId="mint" onNavigate={onAdvance} />
    </div>
  );
};

const SoundDesignerAdvancedStages = ({
  stageId,
  waveformType,
  audioParams,
  onParamChange,
  onMint,
  mintedName,
  onAdvance
}) => {
  if (stageId === 'tone') {
    return <ToneStage audioParams={audioParams} onParamChange={onParamChange} onAdvance={onAdvance} />;
  }
  if (stageId === 'motion') {
    return <MotionStage audioParams={audioParams} onParamChange={onParamChange} onAdvance={onAdvance} />;
  }
  if (stageId === 'space') {
    return <SpaceStage audioParams={audioParams} onParamChange={onParamChange} onAdvance={onAdvance} />;
  }
  if (stageId === 'mint') {
    return (
      <MintStage
        waveformType={waveformType}
        audioParams={audioParams}
        onMint={onMint}
        mintedName={mintedName}
        onAdvance={onAdvance}
      />
    );
  }
  return null;
};

export default SoundDesignerAdvancedStages;
