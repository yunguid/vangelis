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

  const delayLeft = ctx.createDelay(3);
  delayLeft.delayTime.value = 0.12;
  const delayRight = ctx.createDelay(3);
  delayRight.delayTime.value = 0.17;

  const delayFeedbackLeft = ctx.createGain();
  delayFeedbackLeft.gain.value = 0;
  const delayFeedbackRight = ctx.createGain();
  delayFeedbackRight.gain.value = 0;

  const delayToneLeft = makeFilter(ctx, 'lowpass', 4600, 0, 0.75);
  const delayToneRight = makeFilter(ctx, 'lowpass', 4200, 0, 0.75);
  const delayPannerLeft = ctx.createStereoPanner();
  delayPannerLeft.pan.value = -0.45;
  const delayPannerRight = ctx.createStereoPanner();
  delayPannerRight.pan.value = 0.45;

  const reverbSend = ctx.createGain();
  reverbSend.gain.value = 0.18;
  const reverbPreDelay = ctx.createDelay(0.25);
  reverbPreDelay.delayTime.value = 0.018;
  const reverbNode = ctx.createConvolver();
  const reverbHighpass = makeFilter(ctx, 'highpass', 180, 0, 0.72);
  const reverbLowpass = makeFilter(ctx, 'lowpass', 9200, 0, 0.72);
  const reverbGain = ctx.createGain();
  reverbGain.gain.value = 0;
  ensureImpulse(ctx, reverbNode);

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
  delaySend.connect(delayLeft);
  delaySend.connect(delayRight);

  delayLeft.connect(delayToneLeft);
  delayToneLeft.connect(delayPannerLeft);
  delayPannerLeft.connect(delayWet);
  delayToneLeft.connect(delayFeedbackLeft);
  delayFeedbackLeft.connect(delayLeft);

  delayRight.connect(delayToneRight);
  delayToneRight.connect(delayPannerRight);
  delayPannerRight.connect(delayWet);
  delayToneRight.connect(delayFeedbackRight);
  delayFeedbackRight.connect(delayRight);

  airFilter.connect(reverbSend);
  reverbSend.connect(reverbPreDelay);
  reverbPreDelay.connect(reverbNode);
  reverbNode.connect(reverbHighpass);
  reverbHighpass.connect(reverbLowpass);
  reverbLowpass.connect(reverbGain);

  delayWet.connect(masterGain);
  reverbGain.connect(masterGain);

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
    delayLeft,
    delayRight,
    delayFeedbackLeft,
    delayFeedbackRight,
    delayToneLeft,
    delayToneRight,
    delayPannerLeft,
    delayPannerRight,
    reverbSend,
    reverbPreDelay,
    reverbNode,
    reverbHighpass,
    reverbLowpass,
    reverbGain,
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

function ensureImpulse(ctx, reverbNode) {
  const seconds = 2.9;
  const channels = 2;
  const length = Math.floor(ctx.sampleRate * seconds);
  const impulse = ctx.createBuffer(channels, length, ctx.sampleRate);

  for (let channel = 0; channel < channels; channel += 1) {
    const data = impulse.getChannelData(channel);
    const drift = channel === 0 ? 0.00021 : -0.00018;

    for (let i = 0; i < length; i += 1) {
      const t = i / length;
      const decay = Math.pow(1 - t, 2.4);
      const noise = Math.random() * 2 - 1;
      const shimmer = Math.sin((340 + drift * i * ctx.sampleRate) * t * Math.PI * 2) * 0.05;
      let sample = (noise * 0.78 + shimmer) * decay;

      if (i < length * 0.09) {
        const reflection = Math.sin((12 + channel * 3) * t * Math.PI * 2) * 0.12;
        sample += reflection * Math.pow(1 - t * 10, 2);
      }

      data[i] = sample * (channel === 0 ? 0.96 : 0.9);
    }
  }

  reverbNode.buffer = impulse;
}
