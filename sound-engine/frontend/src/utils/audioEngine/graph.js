export function createAudioGraph(ctx, distortionCache) {
  const inputBus = ctx.createGain();
  inputBus.gain.value = 1;

  const compressor = ctx.createDynamicsCompressor();
  compressor.threshold.value = -8;
  compressor.knee.value = 24;
  compressor.ratio.value = 2.2;
  compressor.attack.value = 0.003;
  compressor.release.value = 0.25;

  const distortion = ctx.createWaveShaper();
  distortion.curve = distortionCache.get(0);
  distortion.oversample = '4x';

  const delayNode = ctx.createDelay(5);
  delayNode.delayTime.value = 0;
  const delayFeedback = ctx.createGain();
  delayFeedback.gain.value = 0;
  const delayWet = ctx.createGain();
  delayWet.gain.value = 0;

  const reverbNode = ctx.createConvolver();
  const reverbGain = ctx.createGain();
  reverbGain.gain.value = 0;
  ensureImpulse(ctx, reverbNode);

  const masterGain = ctx.createGain();
  masterGain.gain.value = 0.7;

  const stereoPanner = ctx.createStereoPanner();

  const analyser = ctx.createAnalyser();
  analyser.fftSize = 1024;
  analyser.smoothingTimeConstant = 0.8;

  const stereoSplitter = ctx.createChannelSplitter(2);
  const leftAnalyser = ctx.createAnalyser();
  const rightAnalyser = ctx.createAnalyser();
  leftAnalyser.fftSize = 2048;
  rightAnalyser.fftSize = 2048;
  leftAnalyser.smoothingTimeConstant = 0.75;
  rightAnalyser.smoothingTimeConstant = 0.75;
  const silentGain = ctx.createGain();
  silentGain.gain.value = 0;

  const recordingDest = ctx.createMediaStreamDestination();

  inputBus.connect(compressor);
  compressor.connect(distortion);
  distortion.connect(masterGain);

  distortion.connect(delayNode);
  delayNode.connect(delayFeedback);
  delayFeedback.connect(delayNode);
  delayNode.connect(delayWet);
  delayWet.connect(masterGain);

  inputBus.connect(reverbNode);
  reverbNode.connect(reverbGain);
  reverbGain.connect(masterGain);

  masterGain.connect(stereoPanner);
  stereoPanner.connect(analyser);
  stereoPanner.connect(stereoSplitter);
  stereoSplitter.connect(leftAnalyser, 0);
  stereoSplitter.connect(rightAnalyser, 1);
  leftAnalyser.connect(silentGain);
  rightAnalyser.connect(silentGain);
  silentGain.connect(ctx.destination);
  analyser.connect(ctx.destination);
  analyser.connect(recordingDest);

  return {
    inputBus,
    compressor,
    distortion,
    delayNode,
    delayFeedback,
    delayWet,
    reverbNode,
    reverbGain,
    masterGain,
    stereoPanner,
    analyser,
    stereoSplitter,
    leftAnalyser,
    rightAnalyser,
    silentGain,
    recordingDest
  };
}

function ensureImpulse(ctx, reverbNode) {
  const seconds = 1.4;
  const channels = 2;
  const length = ctx.sampleRate * seconds;
  const impulse = ctx.createBuffer(channels, length, ctx.sampleRate);

  for (let channel = 0; channel < channels; channel++) {
    const data = impulse.getChannelData(channel);
    for (let i = 0; i < length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 2);
    }
  }

  reverbNode.buffer = impulse;
}
