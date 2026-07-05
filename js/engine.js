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
      colorCache: {}, // per-colour voicing sets, so arrangement sections can mix colours
      tonic,
      romans: segments.map((s) => T.romanNumeral(s.chord, tonic)),
    };
  }

  /** Voicings + sus cache for a given colour, computed once per context. */
  function voicingSet(ctx, color) {
    const key = color || 'plain';
    if (!ctx.colorCache) ctx.colorCache = {};
    if (!ctx.colorCache[key]) {
      ctx.colorCache[key] = { voicings: computeVoicings(ctx.segments, color), sus: {} };
    }
    return ctx.colorCache[key];
  }

  function segmentAt(ctx, bar, step) {
    for (let i = 0; i < ctx.segments.length; i++) {
      const s = ctx.segments[i];
      if (s.bar === bar && step >= s.start && step < s.end) return i;
    }
    return 0;
  }

  function segIndexFor(ctx, bar, step) {
    const b = ((bar % ctx.totalBars) + ctx.totalBars) % ctx.totalBars;
    return segmentAt(ctx, b, Math.min(Math.max(step, 0), 15));
  }

  function barIsSplit(ctx, bar) {
    const b = ((bar % ctx.totalBars) + ctx.totalBars) % ctx.totalBars;
    return ctx.segments.some((s) => s.bar === b && s.start === 8);
  }

  /**
   * Resolve where an event belongs harmonically. Returns placement pieces:
   * [{ step, dur, segIdx, intoNextBar?, reattack? }]
   *
   * - `anticipate: true` events belong to the chord they LAND on (step + dur):
   *   the pop anticipation — including mid-bar chord changes and the next bar.
   * - Long notes that substantially overhang a mid-bar chord change are split and
   *   re-attacked on the new chord (what a real player does with a whole note
   *   when the harmony moves at beat 3).
   * - Short syncopated overhangs (< a beat past the change) simply ring over,
   *   like a pedalled suspension.
   */
  function placeEvent(ctx, bar, ev) {
    const s = ev.s;
    const d = ev.d;
    if (ev.anticipate) {
      const land = s + d;
      if (land >= STEPS_PER_BAR) {
        return [{ step: s, dur: d, segIdx: segIndexFor(ctx, bar + 1, land - STEPS_PER_BAR), intoNextBar: true }];
      }
      return [{ step: s, dur: d, segIdx: segIndexFor(ctx, bar, land) }];
    }
    const segIdx = segIndexFor(ctx, bar, s);
    if (barIsSplit(ctx, bar) && s < 8 && s + d >= 12) {
      return [
        { step: s, dur: 8 - s, segIdx },
        { step: 8, dur: s + d - 8, segIdx: segIndexFor(ctx, bar, 8), reattack: true },
      ];
    }
    return [{ step: s, dur: d, segIdx }];
  }

  function susVoicing(ctx, vs, segIdx) {
    if (!(segIdx in vs.sus)) {
      const seg = ctx.segments[segIdx];
      const ch = seg.chord;
      const intervals = ch.intervals.map((i) => (i === 3 || i === 4 ? 5 : i));
      const modChord = { ...ch, intervals, pcs: intervals.map((i) => (ch.rootPc + i) % 12) };
      vs.sus[segIdx] = T.voiceChord(modChord, vs.voicings[segIdx], null);
    }
    return vs.sus[segIdx];
  }

  /** Normalise an energy setting to a 1–5 level. 'verse'/'chorus' keep their classic meanings. */
  function energyLevel(energy) {
    if (energy === 'chorus') return 4;
    if (energy === 'verse') return 2;
    const n = +energy;
    return Number.isFinite(n) && n >= 1 ? Math.min(5, Math.round(n)) : 2;
  }

  // level →      1     2    3     4     5
  const ENERGY_VEL = [0, 0.84, 1.0, 1.08, 1.15, 1.24];

  // -------------------------------------------------------------- event resolution

  /** Chord-tone role placed in the RH arpeggio register (around C4–A5). */
  function arpNote(role, chord) {
    let root = chord.rootPc + 48; // C3 octave
    while (root < 55) root += 12; // lift into G3..F#4
    const third = T.thirdSlot(chord);
    const fifth = chord.quality === 'dim' || chord.quality === 'm7b5' ? 6 : 7;
    switch (role) {
      case 'R': return root;
      case '3': return root + third;
      case '5': return root + fifth;
      case '6': return root + (chord.isMinor ? 10 : 9); // 6th colour; on minor chords the 7th sings instead
      case '8': return root + 12;
      case '10': return root + 12 + third;
      case '12': return root + 12 + fifth;
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
   * Index-based figures (arpeggios, Alberti, the 3-3-2) address voicing notes by
   * position, so a pattern reaching only indices 0–2 would never sound the note
   * parked at index 3 of a rich chord (m7, add9…). Reduce such voicings to their
   * essential tones — drop the 5th first, then the root (the left hand owns it) —
   * so the figure always carries the chord's identity, especially its third.
   */
  function reduceForIndices(voicing, chord, need) {
    const keep = Math.max(need, 3);
    if (voicing.length <= keep) return voicing;
    const fifthPc = (chord.rootPc + (chord.quality === 'dim' || chord.quality === 'm7b5' ? 6 : 7)) % 12;
    let out = voicing.filter((m) => m % 12 !== fifthPc);
    if (out.length < keep) out = voicing;
    if (out.length > keep) {
      const noRoot = out.filter((m) => m % 12 !== chord.rootPc % 12);
      if (noRoot.length >= keep) out = noRoot;
    }
    return out;
  }

  /** Connector (passing chord) into the NEXT bar's first chord, if one applies here.
   *  Patterns that pedal (static bass is their point) or push their own anticipations
   *  into the barline already own that moment — no connector on top. */
  function connectorForBar(ctx, pattern, bar, mode) {
    if (pattern.lh.some((e) => e.n.includes && e.n.includes('pedal'))) return null;
    const tailAnticipates = [...pattern.lh, ...pattern.rh].some((e) => e.anticipate && e.s >= 12);
    if (tailAnticipates) return null;
    if (!ctx.connCache) ctx.connCache = {};
    const key = mode + ':' + (bar % ctx.totalBars);
    if (!(key in ctx.connCache)) {
      const cur = ctx.segments[segIndexFor(ctx, bar, 15)].chord;
      const next = ctx.segments[segIndexFor(ctx, bar + 1, 0)].chord;
      ctx.connCache[key] = T.connectorFor(cur, next, mode);
    }
    return ctx.connCache[key];
  }

  /** Voice a connector chord close to the current segment's voicing (cached). */
  function voicingFor(ctx, vs, chord, segIdx) {
    if (!vs.connVoicings) vs.connVoicings = {};
    const key = segIdx + ':' + chord.symbol;
    if (!(key in vs.connVoicings)) {
      vs.connVoicings[key] = T.voiceChord(chord, vs.voicings[segIdx], null);
    }
    return vs.connVoicings[key];
  }

  function nearestPitch(voicing, target) {
    let best = voicing[0];
    for (const m of voicing) if (Math.abs(m - target) < Math.abs(best - target)) best = m;
    return best;
  }

  /**
   * Render one bar into playable events.
   * Returns [{ step, dur, midis, vel, hand }] — step/dur in 16th steps (step may be fractional after swing).
   *
   * `energy`: 'verse' | 'chorus' | 1..5 — a five-rung dynamic ladder. 4+ adds octave
   * doublings (the classic chorus lift); 1 pulls everything back to a hush.
   * `opts` (all optional, used by arrangements and the colour control):
   *   velMul        — extra velocity multiplier for section dynamics arcs
   *   fill          — { type, targetPc }: 'walkup' (LH climbs into the next root),
   *                   'lift' (RH sus4 push + anticipation), 'walkup+lift',
   *                   'pianoman' (RH dyad fill, fifth fixed on top), or
   *                   'stab' (stop-time: beat 1 hits, then silence)
   *   colour        — 'off' | 'subtle' | 'rich': auto passing chords on beat 4
   *                   before harmony changes (see Theory.connectorFor)
   *   colorOverride — voicing colour ('add9'…) replacing the pattern's own, so
   *                   arrangements can brighten chords on later sections
   */
  function renderBar(ctx, pattern, barIndex, energy, opts) {
    const events = [];
    const bar = barIndex % ctx.totalBars;
    const level = energyLevel(energy);
    const chorus = level >= 4;
    const split = barIsSplit(ctx, bar);
    const seg1Idx = segIndexFor(ctx, bar, 0);
    const vs = voicingSet(ctx, (opts && opts.colorOverride) || pattern.color);
    const fill = opts && opts.fill ? opts.fill : null;

    // fills reshape the bar's tail before rendering, so anticipation/segment
    // machinery applies to the injected events exactly as to authored ones
    let lhSource = pattern.lh;
    let rhSource = pattern.rh;
    if (fill && /walkup/.test(fill.type)) {
      lhSource = pattern.lh.filter((ev) => ev.s < 10 && !ev.anticipate);
    }
    if (fill && /lift/.test(fill.type)) {
      rhSource = [
        ...pattern.rh.filter((ev) => ev.s < 12 && !ev.anticipate),
        { s: 12, d: 2, n: 'chord', mod: 'sus4', v: 0.72 },
        { s: 14, d: 2, n: 'chord', v: 0.8, anticipate: true },
      ];
    }

    // ---- left hand
    // When the chord changes mid-bar, the first bass note under the new chord
    // becomes its root (what a real player does), unless the pattern already
    // lands on a root/octave there or is a deliberate pedal.
    let lhRootedSeg2 = false;
    for (const ev of lhSource) {
      for (const piece of placeEvent(ctx, bar, ev)) {
        const chord = ctx.segments[piece.segIdx].chord;
        let roles = ev.n;
        if (
          split &&
          !ev.anticipate &&
          !piece.intoNextBar &&
          piece.segIdx !== seg1Idx &&
          !lhRootedSeg2 &&
          !roles.includes('pedal')
        ) {
          if (!roles.includes('R') && !roles.includes('8')) roles = ['R'];
          lhRootedSeg2 = true;
        }
        let midis = roles.map((role) => T.lhRole(role, chord, ctx.tonic));
        const doublable = midis.length === 1 && (roles[0] === 'R' || roles[0] === 'pedal') && midis[0] + 12 <= 58;
        if (chorus && doublable) midis = [midis[0], midis[0] + 12];
        midis = [...new Set(midis)];
        const vel = (ev.v != null ? ev.v : 0.72) * (piece.reattack ? 0.85 : 1);
        events.push({
          step: piece.step,
          dur: piece.dur,
          midis,
          vel,
          hand: 'lh',
          segIdx: piece.segIdx,
          intoNextBar: !!piece.intoNextBar,
          anticipate: !!ev.anticipate,
        });
      }
    }

    // ---- LH walk-up fill: two approach notes (the 6̂–7̂ climb) into the coming root
    if (fill && /walkup/.test(fill.type)) {
      const lastSegIdx = segIndexFor(ctx, bar, 15);
      const target = T.bassMidi(fill.targetPc, T.RENDER.lhTargetRoot + 2);
      events.push({ step: 12, dur: 2, midis: [target - 3], vel: 0.68, hand: 'lh', segIdx: lastSegIdx, fill: true });
      events.push({ step: 14, dur: 2, midis: [target - 1], vel: 0.74, hand: 'lh', segIdx: lastSegIdx, fill: true });
    }

    // ---- right hand
    for (const ev of rhSource) {
      for (const piece of placeEvent(ctx, bar, ev)) {
        const chord = ctx.segments[piece.segIdx].chord;
        let midis;
        if (ev.n === 'anchor') {
          midis = anchorNotes(ctx.tonic);
        } else if (ev.n === 'box') {
          // the Elton box: the voicing's top note doubled an octave below —
          // outer octave "boxing in" the harmony makes any triad sound huge
          const base = ev.mod === 'sus4' ? susVoicing(ctx, vs, piece.segIdx) : vs.voicings[piece.segIdx];
          const top = base[base.length - 1];
          midis = [...new Set([top - 12, ...base])].sort((a, b) => a - b);
        } else if (ev.mod === 'sus4') {
          midis = susVoicing(ctx, vs, piece.segIdx).slice();
        } else {
          const v = vs.voicings[piece.segIdx];
          if (ev.n === 'chord') midis = v.slice();
          else if (ev.n === 'shell') midis = [v[0], v[v.length - 1]];
          else if (ev.n === 'top') midis = [v[v.length - 1]];
          else if (Array.isArray(ev.n)) midis = pickIndices(reduceForIndices(v, chord, Math.max(...ev.n) + 1), ev.n);
          else if (ev.n && ev.n.arp) midis = [arpNote(ev.n.arp, chord)];
          else midis = v.slice();
        }
        if (chorus && (ev.n === 'chord' || ev.n === 'box' || ev.mod === 'sus4')) {
          const top = midis[midis.length - 1];
          if (top + 12 <= 88) midis = [...midis, top + 12];
        }
        // gospel grace slide: a soft chromatic crush into the major third, played
        // just ahead of the hit — the ♭3→3 ornament that says "player, not playback"
        if (ev.grace && !piece.reattack) {
          const third = midis.find((m) => (m - chord.rootPc + 1200) % 12 === 4);
          if (third) {
            events.push({
              step: Math.max(0, piece.step - 0.4),
              dur: 0.5,
              midis: [third - 1],
              vel: (ev.v != null ? ev.v : 0.7) * 0.4,
              hand: 'rh',
              segIdx: piece.segIdx,
              grace: true,
              noRing: true,
            });
          }
        }
        const vel = (ev.v != null ? ev.v : 0.7) * (piece.reattack ? 0.85 : 1);
        events.push({
          step: piece.step,
          dur: piece.dur,
          midis,
          vel,
          hand: 'rh',
          segIdx: piece.segIdx,
          intoNextBar: !!piece.intoNextBar,
          anticipate: !!ev.anticipate,
        });
      }
    }

    // ---- Piano Man fill: RH dyad cells, the fifth fixed on top while the lower
    // voice walks third → root, closing with a pickup dyad on the coming chord
    if (fill && /pianoman/.test(fill.type)) {
      for (let i = events.length - 1; i >= 0; i--) {
        const e = events[i];
        if (e.hand !== 'rh' || e.anticipate || e.grace) continue;
        if (e.step >= 10) events.splice(i, 1);
        else if (e.step + e.dur > 10) {
          e.dur = 10 - e.step;
          e.noRing = true;
        }
      }
      const lastSegIdx = segIndexFor(ctx, bar, 15);
      const nextSegIdx = segIndexFor(ctx, bar + 1, 0);
      const cur = ctx.segments[lastSegIdx].chord;
      const next = ctx.segments[nextSegIdx].chord;
      const top = arpNote('12', cur);
      events.push({ step: 10, dur: 2, midis: [arpNote('10', cur), top], vel: 0.58, hand: 'rh', segIdx: lastSegIdx, fill: true });
      events.push({ step: 12, dur: 2, midis: [arpNote('8', cur), top], vel: 0.62, hand: 'rh', segIdx: lastSegIdx, fill: true });
      events.push({
        step: 14,
        dur: 2,
        midis: [arpNote('10', next), arpNote('12', next)],
        vel: 0.6,
        hand: 'rh',
        segIdx: nextSegIdx,
        intoNextBar: true,
        fill: true,
      });
    }

    // ---- auto passing chords ("colour"): on the last beat before the harmony
    // moves, the bass walks — an inversion, a secondary dominant's leading tone,
    // or a chromatic diminished — exactly as the gospel/pop playbook prescribes.
    const colour = opts && opts.colour;
    if (colour && colour !== 'off' && !fill) {
      const conn = connectorForBar(ctx, pattern, bar, colour);
      if (conn) {
        const lastSegIdx = segIndexFor(ctx, bar, 15);
        for (let i = events.length - 1; i >= 0; i--) {
          const e = events[i];
          if (e.anticipate || e.grace) continue;
          if (e.hand === 'lh') {
            if (e.step >= 12) events.splice(i, 1);
            else if (e.step + e.dur > 12) {
              e.dur = 12 - e.step;
              e.noRing = true;
            }
          }
        }
        events.push({
          step: 12,
          dur: 4,
          midis: [T.bassMidi(conn.chord.bassPc, T.RENDER.lhTargetRoot + 2)],
          vel: 0.64,
          hand: 'lh',
          segIdx: lastSegIdx,
          connector: true,
        });
        // walkup keeps the same harmony (only the bass moves); the chromatic kinds
        // re-voice any right-hand tail hit — or add a soft shell when the pattern
        // holds through beat 4, so the passing harmony is actually heard
        if (conn.kind !== 'walkup') {
          const connVoicing = voicingFor(ctx, vs, conn.chord, lastSegIdx);
          let retargeted = false;
          for (const e of events) {
            if (e.hand === 'rh' && !e.anticipate && !e.grace && !e.fill && e.step >= 12) {
              e.midis = e.midis.length > 1 ? connVoicing.slice() : [nearestPitch(connVoicing, e.midis[0])];
              e.connector = true;
              retargeted = true;
            }
          }
          if (!retargeted && (conn.kind === 'dominant' || conn.kind === 'dim')) {
            for (const e of events) {
              if (e.hand === 'rh' && !e.grace && !e.anticipate && e.step < 12 && e.step + e.dur > 12) {
                e.dur = 12 - e.step;
                e.noRing = true;
              }
            }
            events.push({
              step: 12,
              dur: 4,
              midis: [connVoicing[0], connVoicing[connVoicing.length - 1]],
              vel: 0.5,
              hand: 'rh',
              segIdx: lastSegIdx,
              connector: true,
            });
          }
        }
      }
    }

    // ---- stop-time stab: beat 1 lands, then silence — the oldest drama in gospel
    if (fill && fill.type === 'stab') {
      for (let i = events.length - 1; i >= 0; i--) {
        const e = events[i];
        if (e.step >= 4) events.splice(i, 1);
        else {
          e.dur = Math.min(e.dur, 6);
          e.vel = Math.min(1, e.vel * 1.18);
          e.noRing = true;
        }
      }
    }

    // ---- energy velocity shaping (five-rung ladder × optional section arc)
    const velScale = ENERGY_VEL[level] * (opts && opts.velMul ? opts.velMul : 1);
    for (const ev of events) ev.vel = Math.max(0.12, Math.min(1, ev.vel * velScale));

    // ---- pedal: let notes ring to the end of their chord segment
    if (pattern.pedal === 'chord') {
      for (const ev of events) {
        if (ev.noRing || ev.grace) continue;
        const seg = ctx.segments[ev.segIdx];
        const end = ev.intoNextBar ? STEPS_PER_BAR + seg.end : seg.end;
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

  // -------------------------------------------------------------- arrangements

  /**
   * Flatten an arrangement (a sequence of sections, each looping the whole
   * progression with a pattern + energy + dynamics arc) into one timeline
   * entry per bar: { pattern, energy, velMul, fill, sectionIdx, barInSection }.
   *
   * Sections always span whole loops of the progression, so the bar after any
   * section boundary is bar 0 — which makes the fill's walk-up target simply
   * the progression's opening bass note.
   */
  function buildTimeline(ctx, arrangement, patternById) {
    const entries = [];
    const targetPc = ctx.segments[0].chord.bassPc;
    arrangement.sections.forEach((sec, sectionIdx) => {
      const pattern = patternById[sec.pattern];
      if (!pattern) throw new Error(`arrangement ${arrangement.id}: unknown pattern "${sec.pattern}"`);
      const loops = sec.loops || 1;
      const totalBars = loops * ctx.totalBars;
      const dyn = sec.dyn || [1, 1];
      for (let b = 0; b < totalBars; b++) {
        const frac = totalBars === 1 ? 1 : b / (totalBars - 1);
        const lastBar = b === totalBars - 1;
        entries.push({
          pattern,
          energy: sec.energy,
          velMul: dyn[0] + (dyn[1] - dyn[0]) * frac,
          fill: lastBar && sec.fill ? { type: sec.fill, targetPc } : null,
          colour: sec.colour || null, // per-section passing-chord mode
          voicing: sec.voicing || null, // per-section colour upgrade (triads → add9…)
          sectionIdx,
          barInSection: b,
        });
      }
    });
    return entries;
  }

  // -------------------------------------------------------------- scheduler

  function createPlayer(getAudio) {
    const state = {
      playing: false,
      bpm: 84,
      energy: 'verse',
      colour: 'off', // passing-chord mode: 'off' | 'subtle' | 'rich'
      hands: 'both',
      metronome: false,
      countIn: false,
      ctxData: null, // song context
      pattern: null,
      pendingPattern: null,
      arrangement: null, // active arrangement (null = single-pattern mode)
      timeline: null, // flattened per-bar plan when an arrangement is active
      timelineStart: 0, // absolute bar at which the timeline's bar 0 lands
      bar: 0, // next bar to schedule (absolute)
      nextBarTime: 0,
      timer: null,
      listeners: { bar: [], swap: [], stop: [] },
      viz: [], // {tOn,tOff,midi,hand}
      beats: [], // {t, bar, beat, sectionIdx?}
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
      let entry = null;
      if (state.timeline && state.timeline.length) {
        // arrangement mode: the timeline is the conductor
        const tlBar = state.bar - state.timelineStart;
        entry = state.timeline[((tlBar % state.timeline.length) + state.timeline.length) % state.timeline.length];
        if (entry.pattern !== state.pattern) {
          state.pattern = entry.pattern;
          emit('swap', state.pattern);
        }
      } else if (state.pendingPattern) {
        // apply queued pattern at the barline
        state.pattern = state.pendingPattern;
        state.pendingPattern = null;
        emit('swap', state.pattern);
      }
      const barMod = state.bar % state.ctxData.totalBars;
      const events = entry
        ? renderBar(state.ctxData, entry.pattern, barMod, entry.energy, {
            velMul: entry.velMul,
            fill: entry.fill,
            colour: entry.colour || state.colour,
            colorOverride: entry.voicing,
          })
        : renderBar(state.ctxData, state.pattern, barMod, state.energy, { colour: state.colour });
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
      for (let b = 0; b < 4; b++) {
        state.beats.push({ t: t0 + b * (spb / 4), bar: barMod, beat: b, sectionIdx: entry ? entry.sectionIdx : null });
      }
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
        if (state.arrangement) {
          state.timeline = buildTimeline(ctx, state.arrangement, state.arrangement._patternById);
        }
        return ctx;
      },
      setArrangement(arrangement, patternById) {
        if (!state.ctxData) return null;
        arrangement._patternById = patternById; // kept for timeline rebuilds on song change
        state.arrangement = arrangement;
        state.timeline = buildTimeline(state.ctxData, arrangement, patternById);
        state.pendingPattern = null;
        state.pattern = state.timeline[0].pattern;
        // start the arc from its top: immediately when idle, at the next barline when playing
        state.timelineStart = state.playing ? state.bar : 0;
        if (!state.playing) state.bar = 0;
        emit('swap', state.pattern);
        return state.timeline;
      },
      clearArrangement() {
        state.arrangement = null;
        state.timeline = null;
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
        state.timelineStart = 0;
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

  /** Emit a format-1 SMF from per-hand note lists. Shared by pattern + arrangement export. */
  function emitSmf(collect, songTicks, bpm) {
    const PPQ = 480;

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

  const STEP_TICKS = 480 / 4;

  function collectBar(collect, events, barOffset) {
    for (const ev of events) {
      const on = Math.round((barOffset * 16 + ev.step) * STEP_TICKS);
      const off = on + Math.max(1, Math.round(ev.dur * STEP_TICKS));
      for (const m of ev.midis) {
        collect[ev.hand].push({ on, off, midi: m, vel: Math.round(30 + ev.vel * 90) });
      }
    }
  }

  /** Render the whole progression once and emit a Standard MIDI File (format 1). */
  function exportMidi(ctxData, pattern, energy, bpm, colour) {
    const collect = { lh: [], rh: [] };
    for (let bar = 0; bar < ctxData.totalBars; bar++) {
      collectBar(collect, renderBar(ctxData, pattern, bar, energy, { colour }), bar);
    }
    return emitSmf(collect, ctxData.totalBars * 16 * STEP_TICKS, bpm);
  }

  /** Render a full arrangement timeline (every section, arc and fill) to MIDI. */
  function exportArrangementMidi(ctxData, timeline, bpm, colour) {
    const collect = { lh: [], rh: [] };
    timeline.forEach((entry, i) => {
      const events = renderBar(ctxData, entry.pattern, i % ctxData.totalBars, entry.energy, {
        velMul: entry.velMul,
        fill: entry.fill,
        colour: entry.colour || colour,
        colorOverride: entry.voicing,
      });
      collectBar(collect, events, i);
    });
    return emitSmf(collect, timeline.length * 16 * STEP_TICKS, bpm);
  }

  const Engine = {
    STEPS_PER_BAR,
    buildSegments,
    computeVoicings,
    buildContext,
    renderBar,
    energyLevel,
    buildTimeline,
    createPlayer,
    exportMidi,
    exportArrangementMidi,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = Engine;
  else window.Engine = Engine;
})();
