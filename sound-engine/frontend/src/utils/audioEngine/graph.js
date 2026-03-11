function makeFilter(ctx, type, frequency, gain = 0, q = 0.707) {
  const node = ctx.createBiquadFilter();
  node.type = type;
  node.frequency.value = frequency;
  node.gain.value = gain;
  node.Q.value = q;
  return node;
}

export function createAudioGraph(ctx, distortionCache) {
  const inputBus = ctx.createGain();
  inputBus.gain.value = 1;

  const headroom = ctx.createGain();
  headroom.gain.value = 0.92;

  const rumbleFilter = makeFilter(ctx, 'highpass', 28, 0, 0.72);
  const warmthFilter = makeFilter(ctx, 'lowshelf', 168, 1.6, 0.72);
  const presenceFilter = makeFilter(ctx, 'peaking', 2400, 1.4, 0.85);
  const airFilter = makeFilter(ctx, 'highshelf', 8400, 2.2, 0.66);

  const glueCompressor = ctx.createDynamicsCompressor();
  glueCompressor.threshold.value = -15;
  glueCompressor.knee.value = 18;
  glueCompressor.ratio.value = 2.5;
  glueCompressor.attack.value = 0.004;
  glueCompressor.release.value = 0.22;

  const distortion = ctx.createWaveShaper();
  distortion.curve = distortionCache.get(0);
  distortion.oversample = '4x';

  const postTone = makeFilter(ctx, 'peaking', 540, 0.4, 0.6);

  const delaySend = ctx.createGain();
  delaySend.gain.value = 0;
  const delayWet = ctx.createGain();
  delayWet.gain.value = 0;

  const reverbSend = ctx.createGain();
  reverbSend.gain.value = 0;
  const reverbWet = ctx.createGain();
  reverbWet.gain.value = 0;

  const masterGain = ctx.createGain();
  masterGain.gain.value = 0.68;

  const stereoPanner = ctx.createStereoPanner();

  const masterLimiter = ctx.createDynamicsCompressor();
  masterLimiter.threshold.value = -2.5;
  masterLimiter.knee.value = 0;
  masterLimiter.ratio.value = 14;
  masterLimiter.attack.value = 0.002;
  masterLimiter.release.value = 0.08;

  const analyser = ctx.createAnalyser();
  analyser.fftSize = 1024;
  analyser.smoothingTimeConstant = 0.84;

  const stereoSplitter = ctx.createChannelSplitter(2);
  const leftAnalyser = ctx.createAnalyser();
  const rightAnalyser = ctx.createAnalyser();
  leftAnalyser.fftSize = 2048;
  rightAnalyser.fftSize = 2048;
  leftAnalyser.smoothingTimeConstant = 0.78;
  rightAnalyser.smoothingTimeConstant = 0.78;
  const silentGain = ctx.createGain();
  silentGain.gain.value = 0;

  const recordingDest = ctx.createMediaStreamDestination();

  inputBus.connect(headroom);
  headroom.connect(rumbleFilter);
  rumbleFilter.connect(warmthFilter);
  warmthFilter.connect(presenceFilter);
  presenceFilter.connect(glueCompressor);
  glueCompressor.connect(distortion);
  distortion.connect(postTone);
  postTone.connect(airFilter);
  airFilter.connect(masterGain);

  airFilter.connect(delaySend);

  airFilter.connect(reverbSend);

  delayWet.connect(masterGain);
  reverbWet.connect(masterGain);

  masterGain.connect(stereoPanner);
  stereoPanner.connect(masterLimiter);
  masterLimiter.connect(analyser);
  analyser.connect(ctx.destination);
  analyser.connect(recordingDest);

  analyser.connect(stereoSplitter);
  stereoSplitter.connect(leftAnalyser, 0);
  stereoSplitter.connect(rightAnalyser, 1);
  leftAnalyser.connect(silentGain);
  rightAnalyser.connect(silentGain);
  silentGain.connect(ctx.destination);

  return {
    inputBus,
    headroom,
    rumbleFilter,
    warmthFilter,
    presenceFilter,
    glueCompressor,
    distortion,
    postTone,
    airFilter,
    delaySend,
    delayWet,
    reverbSend,
    reverbWet,
    masterGain,
    stereoPanner,
    masterLimiter,
    analyser,
    stereoSplitter,
    leftAnalyser,
    rightAnalyser,
    silentGain,
    recordingDest
  };
}
