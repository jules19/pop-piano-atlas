/* Pop Piano Atlas — theory core
 * Chord parsing, key/roman-numeral analysis, and the voicing engine.
 * Plain script (no modules) so it runs in the browser and in node tests alike.
 */
(function () {
  'use strict';

  const PC_FROM_LETTER = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  const SHARP_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const FLAT_NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

  // Chord qualities → intervals in semitones from the root.
  // Order matters for parsing: longest suffixes first.
  const QUALITIES = [
    ['maj9', [0, 4, 7, 11, 14]],
    ['maj7', [0, 4, 7, 11]],
    ['madd9', [0, 3, 7, 14]],
    ['add9', [0, 4, 7, 14]],
    ['m7b5', [0, 3, 6, 10]],
    ['dim7', [0, 3, 6, 9]],
    ['sus2', [0, 2, 7]],
    ['sus4', [0, 5, 7]],
    ['sus', [0, 5, 7]],
    ['dim', [0, 3, 6]],
    ['aug', [0, 4, 8]],
    ['m9', [0, 3, 7, 10, 14]],
    ['m7', [0, 3, 7, 10]],
    ['m6', [0, 3, 7, 9]],
    ['6', [0, 4, 7, 9]],
    ['9', [0, 4, 7, 10, 14]],
    ['7', [0, 4, 7, 10]],
    ['5', [0, 7]],
    ['m', [0, 3, 7]],
    ['', [0, 4, 7]],
  ];
  const QUALITY_MAP = Object.fromEntries(QUALITIES);

  function parseNoteName(s) {
    const m = /^([A-Ga-g])([#b♯♭]?)/.exec(s);
    if (!m) return null;
    let pc = PC_FROM_LETTER[m[1].toUpperCase()];
    if (m[2] === '#' || m[2] === '♯') pc = (pc + 1) % 12;
    if (m[2] === 'b' || m[2] === '♭') pc = (pc + 11) % 12;
    return { pc, consumed: m[0].length };
  }

  /** Parse a chord symbol like "C", "Am7", "Fsus2", "G/B", "Bbadd9". Returns null if invalid. */
  function parseChord(symbol) {
    const raw = symbol.trim();
    if (!raw) return null;
    let s = raw;
    let bassPc = null;
    const slash = s.lastIndexOf('/');
    if (slash > 0) {
      const bass = parseNoteName(s.slice(slash + 1));
      if (!bass || bass.consumed !== s.length - slash - 1) return null;
      bassPc = bass.pc;
      s = s.slice(0, slash);
    }
    const root = parseNoteName(s);
    if (!root) return null;
    let rest = s.slice(root.consumed);
    // normalise a few aliases
    rest = rest.replace(/^min/, 'm').replace(/^-/, 'm').replace(/^M7/, 'maj7').replace(/^Δ7?/, 'maj7');
    if (!(rest in QUALITY_MAP)) return null;
    const intervals = QUALITY_MAP[rest];
    const isMinor = /^m(?!aj)/.test(rest) || rest === 'dim' || rest === 'dim7' || rest === 'm7b5';
    return {
      symbol: raw,
      rootPc: root.pc,
      quality: rest === '' ? 'maj' : rest,
      intervals,
      isMinor,
      bassPc: bassPc == null ? root.pc : bassPc,
      hasSlash: bassPc != null && bassPc !== root.pc,
      pcs: intervals.map((i) => (root.pc + i) % 12),
    };
  }

  /** Parse a progression string: bars separated by "|" or newlines; chords in a bar by spaces. */
  function parseProgression(text) {
    const cells = text
      .split(/[|\n]/)
      .map((c) => c.trim())
      .filter((c) => c.length > 0);
    if (cells.length === 0) return { ok: false, error: 'Enter at least one chord.' };
    const bars = [];
    for (const cell of cells) {
      const tokens = cell.split(/\s+/).filter(Boolean);
      if (tokens.length > 2) {
        return { ok: false, error: `"${cell}": max two chords per bar for now.` };
      }
      const chords = [];
      for (const t of tokens) {
        const ch = parseChord(t);
        if (!ch) return { ok: false, error: `Couldn't read "${t}" as a chord.` };
        chords.push(ch);
      }
      bars.push(chords);
    }
    if (bars.length > 16) return { ok: false, error: 'Max 16 bars — keep it loopable.' };
    return { ok: true, bars };
  }

  // ---------------------------------------------------------------- key analysis

  const MAJOR_SCALE = [0, 2, 4, 5, 7, 9, 11];
  const DIATONIC_QUALITY = ['maj', 'min', 'min', 'maj', 'maj', 'min', 'dim']; // triads on each degree

  /** Guess the major key (tonic pc) that best explains a list of chords. */
  function detectKey(chords) {
    let best = { tonic: 0, score: -Infinity };
    for (let tonic = 0; tonic < 12; tonic++) {
      let score = 0;
      chords.forEach((ch, idx) => {
        const deg = MAJOR_SCALE.indexOf((ch.rootPc - tonic + 12) % 12);
        if (deg >= 0) {
          score += 2;
          const q = ch.isMinor ? 'min' : ch.quality === 'dim' || ch.quality === 'm7b5' ? 'dim' : 'maj';
          if (
            (DIATONIC_QUALITY[deg] === 'min' && q === 'min') ||
            (DIATONIC_QUALITY[deg] === 'maj' && q === 'maj') ||
            (DIATONIC_QUALITY[deg] === 'dim' && q === 'dim')
          ) {
            score += 2;
          }
          if (deg === 0 && !ch.isMinor) score += (idx === 0 ? 3 : 1); // tonic chord, esp. first
          if (deg === 4) score += 1; // dominant presence
        }
        // every non-diatonic root costs a little
        else score -= 1;
      });
      if (score > best.score) best = { tonic, score };
    }
    return best.tonic;
  }

  const DEGREE_ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];

  /** Roman numeral for a chord in a major key. Handles borrowed roots with ♭/♯. */
  function romanNumeral(chord, tonicPc) {
    const rel = (chord.rootPc - tonicPc + 12) % 12;
    let deg = MAJOR_SCALE.indexOf(rel);
    let accidental = '';
    if (deg < 0) {
      // try flattened degree (e.g. bVII, bIII, bVI)
      deg = MAJOR_SCALE.indexOf((rel + 1) % 12);
      if (deg >= 0) accidental = '♭';
      else {
        deg = MAJOR_SCALE.indexOf((rel + 11) % 12);
        if (deg >= 0) accidental = '♯';
        else return '?';
      }
    }
    let numeral = DEGREE_ROMAN[deg];
    if (chord.isMinor) numeral = numeral.toLowerCase();
    let suffix = '';
    if (chord.quality === 'dim' || chord.quality === 'dim7') suffix = '°';
    else if (chord.quality === 'm7b5') suffix = 'ø';
    else if (/7|9/.test(chord.quality) && chord.quality !== 'add9' && chord.quality !== 'madd9') suffix = '⁷';
    else if (/^sus/.test(chord.quality)) suffix = 'ˢᵘˢ';
    return accidental + numeral + suffix;
  }

  function keyName(tonicPc) {
    // prefer flat spelling for flat-side keys
    const flatKeys = [1, 3, 5, 8, 10];
    return (flatKeys.includes(tonicPc) ? FLAT_NAMES : SHARP_NAMES)[tonicPc];
  }

  function midiToName(midi) {
    return SHARP_NAMES[midi % 12] + (Math.floor(midi / 12) - 1);
  }

  function transposeSymbol(symbol, semitones) {
    const ch = parseChord(symbol);
    if (!ch) return symbol;
    const useFlats = /b/.test(symbol) && !/#/.test(symbol);
    const names = useFlats ? FLAT_NAMES : SHARP_NAMES;
    const renote = (pc, orig) => {
      const parsed = parseNoteName(orig);
      return names[(parsed.pc + semitones + 1200) % 12] + orig.slice(parsed.consumed);
    };
    const slash = symbol.lastIndexOf('/');
    if (slash > 0 && ch.hasSlash) {
      return renote(null, symbol.slice(0, slash)) + '/' + renote(null, symbol.slice(slash + 1));
    }
    return renote(null, symbol);
  }

  // ---------------------------------------------------------------- voicing engine

  const RENDER = {
    lhLow: 32, // E1 floor
    lhTargetRoot: 40, // aim roots near E2..E3
    lhHigh: 55,
    rhLow: 55, // G3 floor — mud guard
    rhHigh: 84, // C6 ceiling
    rhTopMin: 64, // top voice at least E4
    rhTopMax: 81, // top voice at most A5
  };

  /** Place a pitch class in the LH bass register, near a target midi. */
  function bassMidi(pc, target) {
    target = target || 43;
    let m = pc + 24; // start at C1 octave
    let best = m,
      bestDist = Infinity;
    for (; m <= 60; m += 12) {
      const d = Math.abs(m - target);
      if (d < bestDist) {
        best = m;
        bestDist = d;
      }
    }
    return Math.max(best, RENDER.lhLow - 3);
  }

  /**
   * Voice a chord for the right hand with minimal movement from the previous voicing.
   * `color`: null | 'add9' | 'sus2' — stylistic colour applied when the chord is a plain triad.
   * Returns ascending midi array (3–4 notes).
   */
  function voiceChord(chord, prevVoicing, color) {
    let pcs = chord.intervals.slice();
    const isPlainTriad = chord.quality === 'maj' || chord.quality === 'm';
    if (color === 'add9' && isPlainTriad) pcs = [...pcs, 14];
    if (color === 'sus2' && isPlainTriad) pcs = pcs.map((i) => (i === 4 || i === 3 ? 2 : i));
    // absolute pitch classes
    const notePcs = [...new Set(pcs.map((i) => (chord.rootPc + i) % 12))];

    // candidate voicings: each pc placed in every octave within range, then choose a
    // stacked combination via rotation of the sorted pc set.
    const sorted = notePcs.slice().sort((a, b) => a - b);
    const candidates = [];
    for (let rot = 0; rot < sorted.length; rot++) {
      const order = [...sorted.slice(rot), ...sorted.slice(0, rot)];
      for (let baseOct = 3; baseOct <= 5; baseOct++) {
        let prev = -1;
        const v = [];
        let base = order[0] + 12 * (baseOct + 1);
        for (const pc of order) {
          let m = pc + 12 * (baseOct + 1);
          while (m <= prev) m += 12;
          v.push(m);
          prev = m;
        }
        // shift the whole voicing so it sits in range
        while (v[0] < RENDER.rhLow) for (let i = 0; i < v.length; i++) v[i] += 12;
        while (v[v.length - 1] > RENDER.rhHigh) for (let i = 0; i < v.length; i++) v[i] -= 12;
        if (v[0] < RENDER.rhLow) continue;
        const top = v[v.length - 1];
        if (top < RENDER.rhTopMin || top > RENDER.rhTopMax) continue;
        if (v[v.length - 1] - v[0] > 14) continue; // hand span guard (max a 9th)
        candidates.push(v);
      }
    }
    if (candidates.length === 0) {
      // fallback: root position around C4
      const v = notePcs
        .slice()
        .sort((a, b) => a - b)
        .map((pc, i) => pc + 60 + (pc < notePcs[0] ? 12 : 0));
      return v.sort((a, b) => a - b);
    }
    // score: minimal movement from prev, centered near C5-top, avoid semitone clusters at bottom
    const score = (v) => {
      let s = 0;
      if (prevVoicing && prevVoicing.length) {
        for (const n of v) {
          let d = Infinity;
          for (const p of prevVoicing) d = Math.min(d, Math.abs(n - p));
          s -= d;
        }
        // keep top voice movement small — the ear tracks it
        s -= Math.abs(v[v.length - 1] - prevVoicing[prevVoicing.length - 1]) * 1.5;
      } else {
        s -= Math.abs(v[v.length - 1] - 72) * 1.2; // first chord: top near C5
      }
      if (v[1] - v[0] <= 2 && v[0] < 60) s -= 4; // low seconds are muddy
      return s;
    };
    candidates.sort((a, b) => score(b) - score(a));
    // dedupe identical
    return candidates[0];
  }

  /** Resolve a left-hand role token to midi notes for a chord.
   *  Roles: 'R' root · '5' fifth · '8' octave · '10' tenth · '3','6' chordal steps ·
   *  'pedal' key tonic · '5-' fifth below root
   */
  function lhRole(role, chord, keyTonicPc) {
    const rootM = bassMidi(chord.bassPc, RENDER.lhTargetRoot + 2);
    const third = chord.isMinor ? 3 : 4;
    switch (role) {
      case 'R':
        return rootM;
      case '5': {
        const fifth = chord.quality === 'dim' || chord.quality === 'm7b5' ? 6 : 7;
        return rootM + fifth;
      }
      case '5-':
        return rootM - 5; // fifth below = fourth down
      case '8':
        return rootM + 12;
      case '3':
        return rootM + third;
      case '6':
        return rootM + 9;
      case 'b7':
        return rootM + 10;
      case '10':
        return rootM + 12 + third;
      case 'pedal':
        return bassMidi(keyTonicPc, RENDER.lhTargetRoot);
      default:
        return rootM;
    }
  }

  const Theory = {
    parseChord,
    parseProgression,
    detectKey,
    romanNumeral,
    keyName,
    midiToName,
    transposeSymbol,
    voiceChord,
    lhRole,
    bassMidi,
    RENDER,
    SHARP_NAMES,
    FLAT_NAMES,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = Theory;
  else window.Theory = Theory;
})();
