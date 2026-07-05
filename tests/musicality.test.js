/* Musical-correctness audit: for every pattern over a set of torture progressions,
 * verify the rendered notes actually convey each chord.
 *
 * Rules, per chord segment:
 *   1. WRONG NOTES — every sounded pitch class must be a chord tone or a sanctioned
 *      extension (pattern colour add2/add9 → the 2nd; sus4-mod hits → the 4th;
 *      LH melodic roles → 3rd/5th/6th/♭7 relative to the chord).
 *   2. IDENTITY — a full-bar segment must sound the chord's root (or slash bass) AND
 *      its third (when the chord has one). A half-bar segment (fast harmonic rhythm)
 *      must at least sound the root/bass — identity there leans on the bass, as it
 *      does in real playing.
 *   3. SUS RESOLUTION — any segment containing a sus4-coloured hit must resolve it
 *      (a later hit in the same segment containing the third).
 *
 * Documented exemptions (deliberate design, explained on the cards):
 *   - 'anchor' RH: a chord-independent key anchor — its tension IS the pattern.
 *     Its LH must still carry root+fifth, but the third check is waived.
 *   - 'pedal-point' LH: key-tonic pedal regardless of chord. RH carries identity.
 *   - grace events (ev.grace): the gospel ♭3→3 crush — a chromatic ornament by
 *     definition, resolved into the chord tone it decorates within the same hit.
 *   - pattern.rhColorTones: intervals a pattern declares as its RH colour (e.g.
 *     the Crossover's added 6th) — sanctioned the same way pattern colours are.
 */
const assert = require('assert');
const T = require('../js/theory.js');
const E = require('../js/engine.js');
const A = require('../js/patterns.js');

const PROGRESSIONS = [
  ...A.PRESETS.map((p) => ({ id: p.id, text: p.text })),
  { id: 'slash-walk', text: 'C | G/B | Am | F' },
  { id: 'split-bars', text: 'C Am | Dm G | Em Am | F G' },
  { id: 'minor-7ths', text: 'Am7 | Dm7 | G7 | Cmaj7' },
  { id: 'flat-keys', text: 'Bb | Ebadd9 | Cm7 | F7' },
  { id: 'sus-chords', text: 'Dsus4 | D | Gsus2 | G' },
  { id: 'dark', text: 'Em | C | Am | B7' },
];

const THIRD_EXEMPT_PATTERNS = new Set(['anchor']);

function hasThird(chord) {
  return chord.intervals.includes(3) || chord.intervals.includes(4);
}

function thirdPc(chord) {
  return (chord.rootPc + (chord.isMinor ? 3 : 4)) % 12;
}

function allowedPcs(chord, pattern, hand, usesSus) {
  const root = chord.rootPc;
  const set = new Set(chord.pcs.map((p) => p % 12));
  set.add(chord.bassPc % 12);
  if (pattern.color === 'add9' || pattern.color === 'add2') set.add((root + 2) % 12);
  if (hand === 'rh' && usesSus) set.add((root + 5) % 12);
  if (hand === 'rh' && pattern.rhColorTones) for (const i of pattern.rhColorTones) set.add((root + i) % 12);
  if (hand === 'lh') {
    const third = T.thirdSlot(chord);
    const fifth = chord.quality === 'dim' || chord.quality === 'm7b5' ? 6 : 7;
    for (const i of [0, third, fifth, 9, 10]) set.add((root + i) % 12);
  }
  return set;
}

const failures = [];

for (const prog of PROGRESSIONS) {
  for (const pattern of A.PATTERNS) {
    const ctx = E.buildContext(prog.text, pattern);
    assert.ok(ctx.ok, `${prog.id}: context failed`);
    const usesSus = pattern.rh.some((e) => e.mod === 'sus4');
    // accumulate sounded pcs per segment across the whole loop
    const segPcs = ctx.segments.map(() => new Set());
    const segRhEvents = ctx.segments.map(() => []);

    for (let bar = 0; bar < ctx.totalBars; bar++) {
      for (const energy of ['verse', 'chorus']) {
        const events = E.renderBar(ctx, pattern, bar, energy);
        for (const ev of events) {
          if (ev.grace) continue; // chromatic crush ornament — documented exemption
          assert.ok(ev.segIdx != null, `${pattern.id}: event missing segIdx`);
          const seg = ctx.segments[ev.segIdx];
          const chord = seg.chord;
          const exemptRh = ev.hand === 'rh' && THIRD_EXEMPT_PATTERNS.has(pattern.id);
          const exemptLh = ev.hand === 'lh' && pattern.id === 'pedal-point';
          if (!exemptRh && !exemptLh) {
            const allowed = allowedPcs(chord, pattern, ev.hand, usesSus);
            for (const m of ev.midis) {
              if (!allowed.has(m % 12)) {
                failures.push(
                  `WRONG NOTE  ${pattern.id} × ${prog.id} bar ${bar} (${energy}): ` +
                    `${ev.hand.toUpperCase()} plays ${T.midiToName(m)} over ${chord.symbol} at step ${ev.step}`
                );
              }
            }
            if (energy === 'verse') {
              for (const m of ev.midis) segPcs[ev.segIdx].add(m % 12);
              if (ev.hand === 'rh') segRhEvents[ev.segIdx].push(ev);
            }
          } else if (energy === 'verse' && !exemptRh && ev.hand === 'lh') {
            for (const m of ev.midis) segPcs[ev.segIdx].add(m % 12);
          }
        }
      }
    }

    // identity per segment
    ctx.segments.forEach((seg, i) => {
      const chord = seg.chord;
      const pcs = segPcs[i];
      const isHalfBar = seg.end - seg.start === 8;
      const rootOk = pcs.has(chord.rootPc % 12) || pcs.has(chord.bassPc % 12);
      if (!rootOk) {
        failures.push(`NO ROOT     ${pattern.id} × ${prog.id}: ${chord.symbol} (bar ${seg.bar}) never sounds its root or bass`);
      }
      if (!isHalfBar && hasThird(chord) && !THIRD_EXEMPT_PATTERNS.has(pattern.id)) {
        if (!pcs.has(thirdPc(chord))) {
          failures.push(`NO THIRD    ${pattern.id} × ${prog.id}: ${chord.symbol} (bar ${seg.bar}) never sounds its third — major/minor identity lost`);
        }
      }
      // sus resolution
      if (usesSus && hasThird(chord)) {
        const evs = segRhEvents[i].slice().sort((a, b) => a.step - b.step);
        const susHits = evs.filter((e) => e.midis.some((m) => m % 12 === (chord.rootPc + 5) % 12) && !e.midis.some((m) => m % 12 === thirdPc(chord)));
        for (const hit of susHits) {
          const resolved = evs.some((e) => e.step > hit.step && e.midis.some((m) => m % 12 === thirdPc(chord)));
          if (!resolved) {
            failures.push(`SUS HANGS   ${pattern.id} × ${prog.id}: ${chord.symbol} (bar ${seg.bar}) sus4 at step ${hit.step} never resolves to the third`);
          }
        }
      }
    });
  }
}

if (failures.length) {
  const uniq = [...new Set(failures)];
  console.log(`musicality.test.js: ${uniq.length} FAILURES\n`);
  console.log(uniq.slice(0, 80).join('\n'));
  if (uniq.length > 80) console.log(`… and ${uniq.length - 80} more`);
  process.exit(1);
}
console.log(`musicality.test.js: all patterns convey their chords (${A.PATTERNS.length} patterns × ${PROGRESSIONS.length} progressions, verse+chorus)`);
