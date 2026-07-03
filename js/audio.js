/* Pop Piano Atlas — audio engine.
 * A tasteful additive piano voice on Web Audio: velocity-sensitive brightness,
 * register-dependent decay, subtle hammer noise, light room reverb, gentle glue
 * compression. No samples, no network — everything is synthesized.
 */
(function () {
  'use strict';

  let ctx = null;
  let master, comp, dryGain, wetGain, reverb;
  const live = new Set(); // active source nodes for panic stop

  function ensure() {
    if (ctx) return;
    ctx = new (window.AudioContext || window.webkitAudioContext)();

    comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.knee.value = 24;
    comp.ratio.value = 3;
    comp.attack.value = 0.004;
    comp.release.value = 0.18;

    master = ctx.createGain();
    master.gain.value = 1.35;

    // generated impulse response: short warm room
    reverb = ctx.createConvolver();
    reverb.buffer = makeImpulse(1.9, 2.6);
    dryGain = ctx.createGain();
    dryGain.gain.value = 0.82;
    wetGain = ctx.createGain();
    wetGain.gain.value = 0.16;

    dryGain.connect(comp);
    reverb.connect(wetGain);
    wetGain.connect(comp);
    comp.connect(master);
    master.connect(ctx.destination);
  }

  function makeImpulse(seconds, decay) {
    const rate = ctx.sampleRate;
    const len = Math.floor(rate * seconds);
    const buf = ctx.createBuffer(2, len, rate);
    for (let ch = 0; ch < 2; ch++) {
      const data = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
      }
    }
    return buf;
  }

  function midiToFreq(m) {
    return 440 * Math.pow(2, (m - 69) / 12);
  }

  // partial gains for a piano-ish spectrum; upper partials fade with velocity handled below
  const PARTIALS = [
    { mult: 1, gain: 1.0, type: 'triangle' },
    { mult: 2.001, gain: 0.32, type: 'sine' },
    { mult: 3.004, gain: 0.14, type: 'sine' },
    { mult: 4.02, gain: 0.055, type: 'sine' },
    { mult: 5.05, gain: 0.022, type: 'sine' },
  ];

  /** Schedule one piano note. t in AudioContext time. dur = held length in seconds. */
  function playNote(t, midi, vel, dur, hand) {
    ensure();
    const f = midiToFreq(midi);
    const v = Math.max(0.05, Math.min(1, vel));

    // per-note filter: velocity opens brightness, low notes kept darker
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = Math.min(9000, 500 + v * v * 5200 + f * 1.6);
    lp.Q.value = 0.4;

    const amp = ctx.createGain();
    amp.gain.value = 0;
    lp.connect(amp);
    amp.connect(dryGain);
    amp.connect(reverb);

    // register-dependent natural decay (long bass, short treble), bounded by held dur
    const natural = Math.max(0.8, 6.5 - (midi - 21) * 0.055);
    const hold = Math.min(dur, natural);
    const peak = 0.16 * Math.pow(v, 1.4) * (midi < 48 ? 1.25 : 1.0);

    const t0 = Math.max(t, ctx.currentTime);
    amp.gain.setValueAtTime(0, t0);
    amp.gain.linearRampToValueAtTime(peak, t0 + 0.006);
    // two-stage decay: fast initial settle, then slow singing tail
    amp.gain.setTargetAtTime(peak * 0.35, t0 + 0.006, 0.09);
    amp.gain.setTargetAtTime(peak * 0.12, t0 + 0.35, hold * 0.55 + 0.2);
    // release at note end
    const tEnd = t0 + hold;
    amp.gain.setTargetAtTime(0.0001, tEnd, 0.09);

    const stopAt = tEnd + 0.6;
    const detune = (Math.random() - 0.5) * 3;
    for (const p of PARTIALS) {
      const osc = ctx.createOscillator();
      osc.type = p.type;
      osc.frequency.value = f * p.mult;
      osc.detune.value = detune;
      const g = ctx.createGain();
      // higher partials die faster and are weaker at low velocity
      g.gain.value = p.gain * (p.mult === 1 ? 1 : Math.pow(v, 0.8));
      if (p.mult > 1) g.gain.setTargetAtTime(g.gain.value * 0.25, t0 + 0.05, 0.4 / p.mult);
      osc.connect(g);
      g.connect(lp);
      osc.start(t0);
      osc.stop(stopAt);
      live.add(osc);
      osc.onended = () => live.delete(osc);
    }

    // hammer thump: a filtered noise tick that sells the attack
    const nLen = 0.02;
    const nBuf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * nLen), ctx.sampleRate);
    const nd = nBuf.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = (Math.random() * 2 - 1) * (1 - i / nd.length);
    const noise = ctx.createBufferSource();
    noise.buffer = nBuf;
    const nf = ctx.createBiquadFilter();
    nf.type = 'bandpass';
    nf.frequency.value = Math.min(4000, f * 3);
    nf.Q.value = 0.8;
    const ng = ctx.createGain();
    ng.gain.value = 0.05 * v;
    noise.connect(nf);
    nf.connect(ng);
    ng.connect(dryGain);
    noise.start(t0);
    live.add(noise);
    noise.onended = () => live.delete(noise);
  }

  function click(t, accent) {
    ensure();
    const osc = ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.value = accent ? 1800 : 1200;
    const g = ctx.createGain();
    const t0 = Math.max(t, ctx.currentTime);
    g.gain.setValueAtTime(accent ? 0.1 : 0.055, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.05);
    osc.connect(g);
    g.connect(comp);
    osc.start(t0);
    osc.stop(t0 + 0.06);
    live.add(osc);
    osc.onended = () => live.delete(osc);
  }

  function allOff() {
    if (!ctx) return;
    const t = ctx.currentTime;
    for (const node of live) {
      try {
        node.stop(t + 0.05);
      } catch (e) {
        /* already stopped */
      }
    }
    live.clear();
  }

  const AudioOut = {
    ensure,
    resume() {
      ensure();
      if (ctx.state === 'suspended') ctx.resume();
    },
    now() {
      ensure();
      return ctx.currentTime;
    },
    playNote,
    click,
    allOff,
    // test/debug hooks
    getContext() {
      ensure();
      return ctx;
    },
    getMaster() {
      ensure();
      return master;
    },
  };

  window.AudioOut = AudioOut;
})();
