/* Pop Piano Atlas — rendering + playback engine.
 * Pure render functions (node-testable) + a lookahead scheduler that drives an
 * injected audio output, so the same code renders playback and MIDI export.
 */
(function () {
  'use strict';

  const T = typeof module !== 'undefined' ? require('./theory.js') : window.Theory;

  const STEPS_PER_BAR = 16;

  // -------------------------------------------------------------- progression prep

  /** Flatten parsed bars into chord segments with step ranges. */
  function buildSegments(bars) {
    const segs = [];
    bars.forEach((chords, bar) => {
      if (chords.length === 1) {
        segs.push({ bar, start: 0, end: 16, chord: chords[0] });
      } else {
        segs.push({ bar, start: 0, end: 8, chord: chords[0] });
        segs.push({ bar, start: 8, end: 16, chord: chords[1] });
      }
    });
    return segs;
  }

  /** Precompute voice-led RH voicings for every segment (loop-aware: last leads back to first). */
  function computeVoicings(segments, color) {
    const out = [];
    let prev = null;
    for (const seg of segments) {
      const v = T.voiceChord(seg.chord, prev, color);
      out.push(v);
      prev = v;
    }
    return out;
  }

  /** Build a full song context from a progression string + pattern. */
  function buildContext(progressionText, pattern) {
    const parsed = T.parseProgression(progressionText);
    if (!parsed.ok) return parsed;
    const chords = parsed.bars.flat();
    const tonic = T.detectKey(chords);
    const segments = buildSegments(parsed.bars);
    const voicings = computeVoicings(segments, pattern ? pattern.color : null);
    const susVoicings = {}; // lazy cache for sus4-modified hits
    return {
      ok: true,
      bars: parsed.bars,
      totalBars: parsed.bars.length,
      segments,
      voicings,
      susVoicings,
      tonic,
      romans: segments.map((s) => T.romanNumeral(s.chord, tonic)),
    };
  }

  function segmentAt(ctx, bar, step) {
    for (let i = 0; i < ctx.segments.length; i++) {
      const s = ctx.segments[i];
      if (s.bar === bar && step >= s.start && step < s.end) return i;
    }
    return 0;
  }

  function nextSegmentIndex(ctx, segIdx) {
    return (segIdx + 1) % ctx.segments.length;
  }

  function susVoicing(ctx, segIdx) {
    if (!(segIdx in ctx.susVoicings)) {
      const seg = ctx.segments[segIdx];
      const ch = seg.chord;
      const intervals = ch.intervals.map((i) => (i === 3 || i === 4 ? 5 : i));
      const modChord = { ...ch, intervals, pcs: intervals.map((i) => (ch.rootPc + i) % 12) };
      ctx.susVoicings[segIdx] = T.voiceChord(modChord, ctx.voicings[segIdx], null);
    }
    return ctx.susVoicings[segIdx];
  }

  // -------------------------------------------------------------- event resolution

  /** Chord-tone role placed in the RH arpeggio register (around C4–A5). */
  function arpNote(role, chord) {
    let root = chord.rootPc + 48; // C3 octave
    while (root < 55) root += 12; // lift into G3..F#4
    const third = chord.isMinor ? 3 : 4;
    switch (role) {
      case 'R': return root;
      case '3': return root + third;
      case '5': return root + 7;
      case '8': return root + 12;
      case '10': return root + 12 + third;
      case '12': return root + 19;
      default: return root;
    }
  }

  function anchorNotes(tonicPc) {
    let fifth = tonicPc + 7 + 48; // fifth of key
    while (fifth < 64) fifth += 12; // near G4..F#5
    while (fifth > 74) fifth -= 12;
    return [fifth, fifth + 5]; // 5̂ + 1̂ above it (a perfect 4th up = tonic)
  }

  function pickIndices(voicing, indices) {
    return indices.map((i) => voicing[i % voicing.length] + 12 * Math.floor(i / voicing.length));
  }

  /**
   * Render one bar into playable events.
   * Returns [{ step, dur, midis, vel, hand }] — step/dur in 16th steps (step may be fractional after swing).
   */
  function renderBar(ctx, pattern, barIndex, energy) {
    const events = [];
    const bar = barIndex % ctx.totalBars;
    const chorus = energy === 'chorus';

    const resolveSeg = (s, useNext) => {
      let idx = segmentAt(ctx, bar, Math.min(s, 15));
      if (useNext) idx = nextSegmentIndex(ctx, idx);
      return idx;
    };

    // ---- left hand
    for (const ev of pattern.lh) {
      const segIdx = resolveSeg(ev.s, ev.next);
      const chord = ctx.segments[segIdx].chord;
      let midis = ev.n.map((role) => T.lhRole(role, chord, ctx.tonic));
      const doublable = midis.length === 1 && (ev.n[0] === 'R' || ev.n[0] === 'pedal') && midis[0] + 12 <= 58;
      if (chorus && doublable) midis = [midis[0], midis[0] + 12];
      midis = [...new Set(midis)];
      events.push({ step: ev.s, dur: ev.d, midis, vel: ev.v != null ? ev.v : 0.72, hand: 'lh', next: !!ev.next });
    }

    // ---- right hand
    for (const ev of pattern.rh) {
      const segIdx = resolveSeg(ev.s, ev.next);
      const chord = ctx.segments[segIdx].chord;
      let midis;
      if (ev.n === 'anchor') {
        midis = anchorNotes(ctx.tonic);
      } else if (ev.mod === 'sus4') {
        midis = susVoicing(ctx, segIdx).slice();
      } else {
        const v = ctx.voicings[segIdx];
        if (ev.n === 'chord') midis = v.slice();
        else if (ev.n === 'shell') midis = [v[0], v[v.length - 1]];
        else if (ev.n === 'top') midis = [v[v.length - 1]];
        else if (Array.isArray(ev.n)) midis = pickIndices(v, ev.n);
        else if (ev.n && ev.n.arp) midis = [arpNote(ev.n.arp, chord)];
        else midis = v.slice();
      }
      if (chorus && (ev.n === 'chord' || ev.mod === 'sus4')) {
        const top = midis[midis.length - 1];
        if (top + 12 <= 88) midis = [...midis, top + 12];
      }
      events.push({ step: ev.s, dur: ev.d, midis, vel: ev.v != null ? ev.v : 0.7, hand: 'rh', next: !!ev.next });
    }

    // ---- energy velocity shaping
    const velScale = chorus ? 1.15 : 1.0;
    for (const ev of events) ev.vel = Math.min(1, ev.vel * velScale);

    // ---- pedal: let notes ring to the end of their chord segment
    if (pattern.pedal === 'chord') {
      for (const ev of events) {
        const segIdx = resolveSeg(Math.floor(ev.step), ev.next);
        const seg = ctx.segments[segIdx];
        const end = ev.next ? STEPS_PER_BAR + seg.end - seg.start : seg.end;
        const ringTo = Math.max(ev.dur, end - ev.step);
        ev.dur = Math.min(ringTo, ev.dur + 12); // cap the wash
      }
    }

    // ---- swing: delay off-beat 8ths (steps 2, 6, 10, 14) by a third of a beat’s half
    if (pattern.feel === 'swing') {
      for (const ev of events) {
        if (ev.step % 4 === 2) ev.step += 0.66;
      }
    }

    events.sort((a, b) => a.step - b.step);
    return events;
  }

  // -------------------------------------------------------------- scheduler

  function createPlayer(getAudio) {
    const state = {
      playing: false,
      bpm: 84,
      energy: 'verse',
      hands: 'both',
      metronome: false,
      countIn: false,
      ctxData: null, // song context
      pattern: null,
      pendingPattern: null,
      bar: 0, // next bar to schedule (absolute)
      nextBarTime: 0,
      timer: null,
      listeners: { bar: [], swap: [], stop: [] },
      viz: [], // {tOn,tOff,midi,hand}
      beats: [], // {t, bar, beat}
    };

    function emit(name, arg) {
      for (const fn of state.listeners[name]) fn(arg);
    }

    function secondsPerBar() {
      return (60 / state.bpm) * 4;
    }

    function scheduleBar(t0) {
      const audio = getAudio();
      const spb = secondsPerBar();
      const stepDur = spb / STEPS_PER_BAR;
      // apply queued pattern at the barline
      if (state.pendingPattern) {
        state.pattern = state.pendingPattern;
        state.pendingPattern = null;
        emit('swap', state.pattern);
      }
      const barMod = state.bar % state.ctxData.totalBars;
      const events = renderBar(state.ctxData, state.pattern, barMod, state.energy);
      for (const ev of events) {
        if (state.hands !== 'both' && ev.hand !== state.hands) continue;
        const t = t0 + ev.step * stepDur + (Math.random() - 0.5) * 0.008;
        const dur = Math.max(0.08, ev.dur * stepDur);
        for (const m of ev.midis) {
          const vel = Math.max(0.15, Math.min(1, ev.vel + (Math.random() - 0.5) * 0.05));
          audio.playNote(t, m, vel, dur, ev.hand);
          state.viz.push({ tOn: t, tOff: t + dur, midi: m, hand: ev.hand });
        }
      }
      if (state.metronome) {
        for (let b = 0; b < 4; b++) audio.click(t0 + b * (spb / 4), b === 0);
      }
      for (let b = 0; b < 4; b++) state.beats.push({ t: t0 + b * (spb / 4), bar: barMod, beat: b });
      // trim old viz data
      const now = audio.now();
      if (state.viz.length > 400) state.viz = state.viz.filter((v) => v.tOff > now - 0.5);
      if (state.beats.length > 64) state.beats = state.beats.filter((b) => b.t > now - 2);
      emit('bar', { bar: barMod, t: t0 });
      state.bar++;
      state.nextBarTime = t0 + spb;
    }

    function tick() {
      const audio = getAudio();
      const horizon = audio.now() + 0.18;
      while (state.nextBarTime < horizon) scheduleBar(state.nextBarTime);
    }

    return {
      state,
      on(name, fn) {
        state.listeners[name].push(fn);
      },
      setSong(progressionText) {
        const ctx = buildContext(progressionText, state.pendingPattern || state.pattern);
        if (!ctx.ok) return ctx;
        state.ctxData = ctx;
        return ctx;
      },
      setPattern(pattern, immediate) {
        if (!state.playing || immediate) {
          state.pattern = pattern;
          state.pendingPattern = null;
          // colour affects voicings — rebuild if colour changed
          if (state.ctxData) {
            state.ctxData.voicings = computeVoicings(state.ctxData.segments, pattern.color);
            state.ctxData.susVoicings = {};
          }
          emit('swap', pattern);
        } else {
          state.pendingPattern = pattern;
          if (state.ctxData) {
            state.ctxData.voicings = computeVoicings(state.ctxData.segments, pattern.color);
            state.ctxData.susVoicings = {};
          }
        }
      },
      play() {
        if (state.playing || !state.ctxData || !state.pattern) return;
        const audio = getAudio();
        audio.resume();
        state.playing = true;
        state.bar = 0;
        let start = audio.now() + 0.08;
        if (state.countIn) {
          const spb = secondsPerBar() / 4;
          for (let b = 0; b < 4; b++) audio.click(start + b * spb, b === 0);
          for (let b = 0; b < 4; b++) state.beats.push({ t: start + b * spb, bar: -1, beat: b });
          start += secondsPerBar();
        }
        state.nextBarTime = start;
        state.timer = setInterval(tick, 30);
        tick();
      },
      stop() {
        if (!state.playing) return;
        state.playing = false;
        clearInterval(state.timer);
        getAudio().allOff();
        state.viz = [];
        state.beats = [];
        emit('stop');
      },
    };
  }

  // -------------------------------------------------------------- MIDI export

  function vlq(n) {
    // variable-length quantity
    const bytes = [n & 0x7f];
    n >>= 7;
    while (n > 0) {
      bytes.unshift((n & 0x7f) | 0x80);
      n >>= 7;
    }
    return bytes;
  }

  function str(s) {
    return [...s].map((c) => c.charCodeAt(0));
  }

  /** Render the whole progression once and emit a Standard MIDI File (format 1). */
  function exportMidi(ctxData, pattern, energy, bpm) {
    const PPQ = 480;
    const stepTicks = PPQ / 4;
    const collect = { lh: [], rh: [] };
    for (let bar = 0; bar < ctxData.totalBars; bar++) {
      const events = renderBar(ctxData, pattern, bar, energy);
      for (const ev of events) {
        const on = Math.round((bar * 16 + ev.step) * stepTicks);
        const off = on + Math.max(1, Math.round(ev.dur * stepTicks));
        for (const m of ev.midis) {
          collect[ev.hand].push({ on, off, midi: m, vel: Math.round(30 + ev.vel * 90) });
        }
      }
    }
    const songTicks = ctxData.totalBars * 16 * stepTicks;

    function trackBytes(notes, name) {
      // clip overlapping repeats of the same pitch
      notes.sort((a, b) => a.on - b.on || a.midi - b.midi);
      const byPitch = {};
      for (const n of notes) {
        const prev = byPitch[n.midi];
        if (prev && prev.off > n.on) prev.off = Math.max(prev.on + 1, n.on - 2);
        byPitch[n.midi] = n;
      }
      const msgs = [];
      for (const n of notes) {
        msgs.push({ t: n.on, data: [0x90, n.midi, n.vel] });
        msgs.push({ t: Math.min(n.off, songTicks), data: [0x80, n.midi, 0] });
      }
      msgs.sort((a, b) => a.t - b.t || a.data[0] - b.data[0]);
      const out = [];
      out.push(...vlq(0), 0xff, 0x03, name.length, ...str(name)); // track name
      out.push(...vlq(0), 0xc0, 0x00); // program: acoustic grand
      let last = 0;
      for (const m of msgs) {
        out.push(...vlq(m.t - last), ...m.data);
        last = m.t;
      }
      out.push(...vlq(songTicks - last), 0xff, 0x2f, 0x00);
      return out;
    }

    const tempoTrack = [];
    const usPerBeat = Math.round(60000000 / bpm);
    tempoTrack.push(...vlq(0), 0xff, 0x51, 0x03, (usPerBeat >> 16) & 0xff, (usPerBeat >> 8) & 0xff, usPerBeat & 0xff);
    tempoTrack.push(...vlq(0), 0xff, 0x58, 0x04, 4, 2, 24, 8); // 4/4
    tempoTrack.push(...vlq(0), 0xff, 0x2f, 0x00);

    function chunk(tag, data) {
      const len = data.length;
      return [...str(tag), (len >> 24) & 0xff, (len >> 16) & 0xff, (len >> 8) & 0xff, len & 0xff, ...data];
    }

    const lh = trackBytes(collect.lh, 'Left Hand');
    const rh = trackBytes(collect.rh, 'Right Hand');
    const bytes = [
      ...chunk('MThd', [0, 1, 0, 3, (PPQ >> 8) & 0xff, PPQ & 0xff]),
      ...chunk('MTrk', tempoTrack),
      ...chunk('MTrk', rh),
      ...chunk('MTrk', lh),
    ];
    return new Uint8Array(bytes);
  }

  const Engine = { STEPS_PER_BAR, buildSegments, computeVoicings, buildContext, renderBar, createPlayer, exportMidi };
  if (typeof module !== 'undefined' && module.exports) module.exports = Engine;
  else window.Engine = Engine;
})();
