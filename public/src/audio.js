/**
 * GravitySynth Web Audio Engine
 * Polyphonic 5-voice synthesizer with spatial panning, stereo ping-pong delay,
 * procedural convolution reverb, glue limiter, FFT analyser, and 1-click recording.
 */

import { midiToFreq } from './harmony.js';

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.dryGain = null;
    this.reverbGain = null;
    this.delayGain = null;
    this.limiter = null;
    this.analyser = null;
    this.noiseBuffer = null;
    this.recordDest = null;
    this.recorder = null;
    this.recordedChunks = [];
    this.isRecording = false;
    this.muted = false;
    this.volume = 0.78;
    this.reverbMix = 0.35;
    this.delayMix = 0.28;
    this.activeVoices = 0;
    this.maxVoices = 36;
  }

  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
      return true;
    }

    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return false;

    this.ctx = new AudioCtx();

    // Master bus -> Limiter -> MasterGain -> Analyser -> Destination + Recorder
    this.dryGain = this.ctx.createGain();
    this.dryGain.gain.value = 0.85;

    this.limiter = this.ctx.createDynamicsCompressor();
    this.limiter.threshold.value = -10;
    this.limiter.knee.value = 14;
    this.limiter.ratio.value = 8;
    this.limiter.attack.value = 0.004;
    this.limiter.release.value = 0.16;

    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = this.muted ? 0 : this.volume;

    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 256;
    this.analyser.smoothingTimeConstant = 0.82;

    // Algorithmic Stereo Convolution Reverb
    const convolver = this.ctx.createConvolver();
    convolver.buffer = this._createReverbImpulse(2.4, 2.8);
    this.reverbGain = this.ctx.createGain();
    this.reverbGain.gain.value = this.reverbMix;

    // Lush Stereo Echo / Delay
    const delayL = this.ctx.createDelay(1.5);
    const delayR = this.ctx.createDelay(1.5);
    delayL.delayTime.value = 0.265;
    delayR.delayTime.value = 0.395;

    const fbL = this.ctx.createGain();
    const fbR = this.ctx.createGain();
    fbL.gain.value = 0.34;
    fbR.gain.value = 0.34;

    const delayFilter = this.ctx.createBiquadFilter();
    delayFilter.type = 'lowpass';
    delayFilter.frequency.value = 3400;

    const merger = this.ctx.createChannelMerger(2);
    this.delayGain = this.ctx.createGain();
    this.delayGain.gain.value = this.delayMix;

    // Wire ping-pong feedback
    this.dryGain.connect(delayFilter);
    delayFilter.connect(delayL);
    delayL.connect(fbL);
    fbL.connect(delayR);
    delayR.connect(fbR);
    fbR.connect(delayL);
    delayL.connect(merger, 0, 0);
    delayR.connect(merger, 0, 1);
    merger.connect(this.delayGain);

    // Wire reverb
    this.dryGain.connect(convolver);
    convolver.connect(this.reverbGain);

    // Sum to limiter
    this.dryGain.connect(this.limiter);
    this.reverbGain.connect(this.limiter);
    this.delayGain.connect(this.limiter);

    this.limiter.connect(this.masterGain);
    this.masterGain.connect(this.analyser);
    this.analyser.connect(this.ctx.destination);

    // Stream destination for recording
    if (this.ctx.createMediaStreamDestination) {
      this.recordDest = this.ctx.createMediaStreamDestination();
      this.masterGain.connect(this.recordDest);
    }

    // Shared white noise buffer for drums/percussion
    this.noiseBuffer = this._createNoiseBuffer(0.6);
    return true;
  }

  _createReverbImpulse(durationSec, decay) {
    const rate = this.ctx.sampleRate;
    const length = Math.floor(rate * durationSec);
    const impulse = this.ctx.createBuffer(2, length, rate);
    for (let ch = 0; ch < 2; ch++) {
      const data = impulse.getChannelData(ch);
      for (let i = 0; i < length; i++) {
        const env = Math.pow(1 - i / length, decay);
        data[i] = (Math.random() * 2 - 1) * env * 0.55;
      }
    }
    return impulse;
  }

  _createNoiseBuffer(durationSec) {
    const rate = this.ctx.sampleRate;
    const length = Math.floor(rate * durationSec);
    const buf = this.ctx.createBuffer(1, length, rate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buf;
  }

  setVolume(vol) {
    this.volume = Math.max(0, Math.min(1, vol));
    if (this.masterGain && !this.muted) {
      this.masterGain.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.02);
    }
  }

  setMuted(muted) {
    this.muted = !!muted;
    if (this.masterGain) {
      this.masterGain.gain.setTargetAtTime(this.muted ? 0 : this.volume, this.ctx.currentTime, 0.02);
    }
  }

  setReverbMix(mix) {
    this.reverbMix = Math.max(0, Math.min(0.9, mix));
    if (this.reverbGain) {
      this.reverbGain.gain.setTargetAtTime(this.reverbMix, this.ctx.currentTime, 0.04);
    }
  }

  setDelayMix(mix) {
    this.delayMix = Math.max(0, Math.min(0.85, mix));
    if (this.delayGain) {
      this.delayGain.gain.setTargetAtTime(this.delayMix, this.ctx.currentTime, 0.04);
    }
  }

  getFrequencyData(targetArray) {
    if (!this.analyser) return false;
    this.analyser.getByteFrequencyData(targetArray);
    return true;
  }

  /**
   * Trigger a synthesized note with stereo panning and velocity dynamics.
   */
  triggerNote({ midi, instrument = 'crystal', velocity = 0.7, pan = 0 }) {
    if (!this.ctx || this.ctx.state !== 'running' || this.muted) return;
    if (this.activeVoices >= this.maxVoices) return;

    const now = this.ctx.currentTime;
    const freq = midiToFreq(midi);
    const vel = Math.max(0.12, Math.min(1, velocity));

    const panner = this.ctx.createStereoPanner
      ? this.ctx.createStereoPanner()
      : this.ctx.createGain();
    if (panner.pan) {
      panner.pan.setValueAtTime(Math.max(-0.9, Math.min(0.9, pan)), now);
    }
    panner.connect(this.dryGain);

    this.activeVoices += 1;
    const releaseVoice = (durSec) => {
      setTimeout(() => {
        this.activeVoices = Math.max(0, this.activeVoices - 1);
        try {
          panner.disconnect();
        } catch {
          // ignore
        }
      }, Math.ceil(durSec * 1000) + 60);
    };

    if (instrument === 'drum') {
      const dur = this._playDrum(now, midi, vel, panner);
      releaseVoice(dur);
      return;
    }

    if (instrument === 'crystal') {
      const dur = this._playCrystal(now, freq, vel, panner);
      releaseVoice(dur);
    } else if (instrument === 'pluck') {
      const dur = this._playPluck(now, freq, vel, panner);
      releaseVoice(dur);
    } else if (instrument === 'synth') {
      const dur = this._playSynth(now, freq, vel, panner);
      releaseVoice(dur);
    } else if (instrument === 'kalimba') {
      const dur = this._playKalimba(now, freq, vel, panner);
      releaseVoice(dur);
    } else {
      const dur = this._playCrystal(now, freq, vel, panner);
      releaseVoice(dur);
    }
  }

  _playCrystal(now, freq, vel, dest) {
    const dur = 1.45;
    const carrier = this.ctx.createOscillator();
    const mod = this.ctx.createOscillator();
    const modGain = this.ctx.createGain();
    const env = this.ctx.createGain();

    carrier.type = 'sine';
    carrier.frequency.setValueAtTime(freq, now);

    mod.type = 'sine';
    mod.frequency.setValueAtTime(freq * 2.0, now);
    modGain.gain.setValueAtTime(freq * 0.9 * vel, now);
    modGain.gain.exponentialRampToValueAtTime(0.01, now + 0.35);

    env.gain.setValueAtTime(0.0001, now);
    env.gain.linearRampToValueAtTime(0.24 * vel, now + 0.008);
    env.gain.exponentialRampToValueAtTime(0.0008, now + dur);

    mod.connect(modGain);
    modGain.connect(carrier.frequency);
    carrier.connect(env);
    env.connect(dest);

    carrier.start(now);
    mod.start(now);
    carrier.stop(now + dur + 0.02);
    mod.stop(now + dur + 0.02);
    return dur;
  }

  _playPluck(now, freq, vel, dest) {
    const dur = 1.15;
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const env = this.ctx.createGain();

    osc1.type = 'triangle';
    osc2.type = 'sawtooth';
    osc1.frequency.setValueAtTime(freq, now);
    osc2.frequency.setValueAtTime(freq * 1.003, now);

    filter.type = 'lowpass';
    filter.Q.value = 2.4;
    filter.frequency.setValueAtTime(Math.min(7200, freq * (3.5 + vel * 4.5)), now);
    filter.frequency.exponentialRampToValueAtTime(Math.max(260, freq * 1.3), now + 0.45);

    const mix2 = this.ctx.createGain();
    mix2.gain.value = 0.32;

    env.gain.setValueAtTime(0.0001, now);
    env.gain.linearRampToValueAtTime(0.26 * vel, now + 0.006);
    env.gain.exponentialRampToValueAtTime(0.0008, now + dur);

    osc1.connect(filter);
    osc2.connect(mix2);
    mix2.connect(filter);
    filter.connect(env);
    env.connect(dest);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + dur + 0.02);
    osc2.stop(now + dur + 0.02);
    return dur;
  }

  _playSynth(now, freq, vel, dest) {
    const dur = 1.35;
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const env = this.ctx.createGain();

    osc1.type = 'sawtooth';
    osc2.type = 'sawtooth';
    osc1.frequency.setValueAtTime(freq * 0.996, now);
    osc2.frequency.setValueAtTime(freq * 1.005, now);

    filter.type = 'lowpass';
    filter.Q.value = 4.2;
    filter.frequency.setValueAtTime(280, now);
    filter.frequency.exponentialRampToValueAtTime(Math.min(6200, freq * 5.2), now + 0.05);
    filter.frequency.exponentialRampToValueAtTime(Math.max(240, freq * 1.15), now + dur * 0.85);

    env.gain.setValueAtTime(0.0001, now);
    env.gain.linearRampToValueAtTime(0.18 * vel, now + 0.018);
    env.gain.exponentialRampToValueAtTime(0.0008, now + dur);

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(env);
    env.connect(dest);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + dur + 0.02);
    osc2.stop(now + dur + 0.02);
    return dur;
  }

  _playKalimba(now, freq, vel, dest) {
    const dur = 0.85;
    const fundamental = this.ctx.createOscillator();
    const overtone = this.ctx.createOscillator();
    const overGain = this.ctx.createGain();
    const env = this.ctx.createGain();

    fundamental.type = 'sine';
    fundamental.frequency.setValueAtTime(freq, now);

    overtone.type = 'triangle';
    overtone.frequency.setValueAtTime(freq * 2.98, now);
    overGain.gain.setValueAtTime(0.14 * vel, now);
    overGain.gain.exponentialRampToValueAtTime(0.0005, now + 0.075);

    env.gain.setValueAtTime(0.0001, now);
    env.gain.linearRampToValueAtTime(0.32 * vel, now + 0.005);
    env.gain.exponentialRampToValueAtTime(0.0008, now + dur);

    fundamental.connect(env);
    overtone.connect(overGain);
    overGain.connect(dest);
    env.connect(dest);

    fundamental.start(now);
    overtone.start(now);
    fundamental.stop(now + dur + 0.02);
    overtone.stop(now + 0.12);
    return dur;
  }

  _playDrum(now, midi, vel, dest) {
    if (midi < 56) {
      // Deep punchy 808 Kick
      const dur = 0.36;
      const osc = this.ctx.createOscillator();
      const env = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(145, now);
      osc.frequency.exponentialRampToValueAtTime(42, now + 0.11);

      env.gain.setValueAtTime(0.45 * vel, now);
      env.gain.exponentialRampToValueAtTime(0.001, now + dur);

      osc.connect(env);
      env.connect(dest);
      osc.start(now);
      osc.stop(now + dur + 0.02);
      return dur;
    } else if (midi < 68) {
      // Electronic Snare / Rim
      const dur = 0.22;
      const noise = this.ctx.createBufferSource();
      noise.buffer = this.noiseBuffer;
      const hp = this.ctx.createBiquadFilter();
      hp.type = 'bandpass';
      hp.frequency.value = 1850;
      hp.Q.value = 1.1;

      const nEnv = this.ctx.createGain();
      nEnv.gain.setValueAtTime(0.28 * vel, now);
      nEnv.gain.exponentialRampToValueAtTime(0.001, now + dur);

      const body = this.ctx.createOscillator();
      body.type = 'triangle';
      body.frequency.setValueAtTime(210, now);
      body.frequency.exponentialRampToValueAtTime(110, now + 0.07);
      const bEnv = this.ctx.createGain();
      bEnv.gain.setValueAtTime(0.24 * vel, now);
      bEnv.gain.exponentialRampToValueAtTime(0.001, now + 0.11);

      noise.connect(hp);
      hp.connect(nEnv);
      nEnv.connect(dest);
      body.connect(bEnv);
      bEnv.connect(dest);

      noise.start(now);
      body.start(now);
      noise.stop(now + dur + 0.02);
      body.stop(now + 0.13);
      return dur;
    } else {
      // Crisp Hi-Hat
      const dur = 0.11;
      const noise = this.ctx.createBufferSource();
      noise.buffer = this.noiseBuffer;
      const hp = this.ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 6800;

      const env = this.ctx.createGain();
      env.gain.setValueAtTime(0.18 * vel, now);
      env.gain.exponentialRampToValueAtTime(0.001, now + dur);

      noise.connect(hp);
      hp.connect(env);
      env.connect(dest);
      noise.start(now);
      noise.stop(now + dur + 0.02);
      return dur;
    }
  }

  startRecording(onStopCallback) {
    if (!this.init() || !this.recordDest || typeof MediaRecorder === 'undefined') {
      return false;
    }
    if (this.isRecording) return false;

    this.recordedChunks = [];
    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : 'audio/webm';
    this.recorder = new MediaRecorder(this.recordDest.stream, { mimeType });
    this.recorder.ondataavailable = (ev) => {
      if (ev.data && ev.data.size > 0) this.recordedChunks.push(ev.data);
    };
    this.recorder.onstop = () => {
      const blob = new Blob(this.recordedChunks, { type: mimeType });
      this.isRecording = false;
      if (onStopCallback) onStopCallback(blob);
    };
    this.recorder.start();
    this.isRecording = true;
    return true;
  }

  stopRecording() {
    if (this.recorder && this.isRecording) {
      this.recorder.stop();
    }
  }
}
