const assert = require('assert');
const T = require('../js/theory.js');
const E = require('../js/engine.js');
const A = require('../js/patterns.js');

// Every pattern renders over every preset without NaN, out-of-range, or empty output.
for (const preset of A.PRESETS) {
  for (const pattern of A.PATTERNS) {
    const ctx = E.buildContext(preset.text, pattern);
    assert.ok(ctx.ok, `context failed for ${preset.id}`);
    for (let bar = 0; bar < ctx.totalBars; bar++) {
      for (const energy of ['verse', 'chorus']) {
        const events = E.renderBar(ctx, pattern, bar, energy);
        assert.ok(events.length > 0, `${pattern.id} bar ${bar}: no events`);
        for (const ev of events) {
          assert.ok(ev.midis.length > 0, `${pattern.id}: empty midis`);
          assert.ok(ev.step >= 0 && ev.step < 17, `${pattern.id}: bad step ${ev.step}`);
          assert.ok(ev.dur > 0, `${pattern.id}: bad dur`);
          assert.ok(ev.vel > 0 && ev.vel <= 1, `${pattern.id}: bad vel ${ev.vel}`);
          for (const m of ev.midis) {
            assert.ok(Number.isFinite(m), `${pattern.id}: NaN midi`);
            assert.ok(m >= 24 && m <= 96, `${pattern.id} (${preset.id}, ${energy}): midi ${m} out of piano range`);
            if (ev.hand === 'rh') assert.ok(m >= 48, `${pattern.id} (${preset.id}): RH note ${m} too low`);
            if (ev.hand === 'lh') assert.ok(m <= 65, `${pattern.id} (${preset.id}, ${energy}): LH note ${m} too high`);
          }
        }
      }
    }
  }
}

// Anticipation events landing past the barline resolve to the NEXT chord.
{
  const push = A.PATTERNS.find((p) => p.id === 'push');
  const ctx = E.buildContext('C | G', push);
  const events = E.renderBar(ctx, push, 0, 'verse');
  const pushed = events.filter((e) => e.anticipate && e.intoNextBar);
  assert.ok(pushed.length >= 2, 'push pattern should have barline-crossing events');
  const lhPush = pushed.find((e) => e.hand === 'lh');
  assert.strictEqual(lhPush.midis[0] % 12, 7, 'pushed LH note should be G (next chord root)');
  // the and-of-2 anticipation stays on the CURRENT chord in a one-chord bar
  const mid = events.find((e) => e.anticipate && !e.intoNextBar && e.hand === 'rh');
  assert.ok(mid.midis.every((m) => [0, 2, 4, 7].includes(m % 12)), 'and-of-2 should still be C-family in a solid bar');
}

// Last bar's anticipation wraps to the first chord.
{
  const push = A.PATTERNS.find((p) => p.id === 'push');
  const ctx = E.buildContext('C | G', push);
  const events = E.renderBar(ctx, push, 1, 'verse');
  const lhPush = events.filter((e) => e.anticipate && e.intoNextBar).find((e) => e.hand === 'lh');
  assert.strictEqual(lhPush.midis[0] % 12, 0, 'wrap: pushed note should be C');
}

// In a split bar, the anticipated and-of-2 hit sounds the MID-BAR chord change.
{
  const push = A.PATTERNS.find((p) => p.id === 'push');
  const ctx = E.buildContext('C Am | Dm G', push);
  const events = E.renderBar(ctx, push, 0, 'verse');
  const mid = events.find((e) => e.hand === 'rh' && e.step === 6);
  const amPcs = new Set([9, 0, 4, 11]); // A C E + B (the pattern's add9 colour)
  assert.ok(mid.midis.every((m) => amPcs.has(m % 12)), 'and-of-2 should anticipate Am(add9), got ' + mid.midis.map((m) => m % 12));
  assert.ok(mid.midis.some((m) => m % 12 === 0), 'anticipated Am must contain its third (C)');
  // and Am's root must sound in the bar (LH beat-3 echo)
  const lhSeg2 = events.find((e) => e.hand === 'lh' && e.step === 8);
  assert.strictEqual(lhSeg2.midis[0] % 12, 9, 'beat-3 LH should be A under the Am half');
}

// Anchor pattern: RH notes identical across different chords.
{
  const anchor = A.PATTERNS.find((p) => p.id === 'anchor');
  const ctx = E.buildContext('C | G | Am | F', anchor);
  const rhSets = [];
  for (let bar = 0; bar < 4; bar++) {
    const rh = E.renderBar(ctx, anchor, bar, 'verse').filter((e) => e.hand === 'rh');
    rhSets.push(JSON.stringify(rh.map((e) => e.midis)));
  }
  assert.ok(rhSets.every((s) => s === rhSets[0]), 'anchor RH should not change with chords');
}

// Pedal-point pattern: LH stays on the tonic across all chords.
{
  const pp = A.PATTERNS.find((p) => p.id === 'pedal-point');
  const ctx = E.buildContext('C | G | Am | F', pp);
  for (let bar = 0; bar < 4; bar++) {
    const lh = E.renderBar(ctx, pp, bar, 'verse').filter((e) => e.hand === 'lh');
    for (const ev of lh) assert.strictEqual(ev.midis[0] % 12, 0, 'pedal should stay on C');
  }
}

// Chorus energy: LH single notes gain octaves, velocities rise.
{
  const bedrockish = A.PATTERNS.find((p) => p.id === 'quarter-pulse');
  const ctx = E.buildContext('C | G | Am | F', bedrockish);
  const v = E.renderBar(ctx, bedrockish, 0, 'verse');
  const c = E.renderBar(ctx, bedrockish, 0, 'chorus');
  const vLH = v.find((e) => e.hand === 'lh');
  const cLH = c.find((e) => e.hand === 'lh');
  assert.ok(cLH.midis.length > vLH.midis.length, 'chorus LH should add octave');
  assert.ok(c[0].vel > v[0].vel, 'chorus should be louder');
}

// Swing pattern shifts off-beat 8ths.
{
  const shuffle = A.PATTERNS.find((p) => p.id === 'shuffle');
  const ctx = E.buildContext('C | F', shuffle);
  const ev = E.renderBar(ctx, shuffle, 0, 'verse');
  const offbeat = ev.find((e) => e.hand === 'rh' && e.step > 6 && e.step < 7);
  assert.ok(offbeat, 'swing should delay the and-of-2 to ~6.66 steps');
}

// Two chords in a bar: second half uses the second chord, and the first bass
// note under the new chord becomes its ROOT (the split-bar root rule).
{
  const qp = A.PATTERNS.find((p) => p.id === 'quarter-pulse');
  const ctx = E.buildContext('C G | Am F', qp);
  assert.strictEqual(ctx.segments.length, 4);
  const ev = E.renderBar(ctx, qp, 0, 'verse');
  const beat3lh = ev.find((e) => e.hand === 'lh' && e.step === 8);
  assert.strictEqual(beat3lh.midis[0] % 12, 7, 'beat 3 LH should be G (root of the new chord)');
  const beat3rh = ev.find((e) => e.hand === 'rh' && e.step === 8);
  const gPcs = new Set([7, 11, 2]);
  assert.ok(beat3rh.midis.every((m) => gPcs.has(m % 12)), 'beat 3 RH should be a G chord');
}

// Whole notes over a split bar get re-attacked on the mid-bar chord change.
{
  const bedrock = A.PATTERNS.find((p) => p.id === 'bedrock');
  const ctx = E.buildContext('C Am | Dm G', bedrock);
  const ev = E.renderBar(ctx, bedrock, 0, 'verse');
  const reattacks = ev.filter((e) => e.step === 8);
  assert.ok(reattacks.some((e) => e.hand === 'lh') && reattacks.some((e) => e.hand === 'rh'), 'bedrock should re-attack both hands at beat 3');
  const rh = reattacks.find((e) => e.hand === 'rh');
  const amPcs = new Set([9, 0, 4]);
  assert.ok(rh.midis.every((m) => amPcs.has(m % 12)), 're-attack should voice Am');
}

// Sus4 mod produces a different voicing that contains the 4th.
{
  const gospel = A.PATTERNS.find((p) => p.id === 'gospel-sus');
  const ctx = E.buildContext('C | F', gospel);
  const ev = E.renderBar(ctx, gospel, 0, 'verse');
  const sus = ev.find((e) => e.hand === 'rh' && e.step === 0);
  const pcs = sus.midis.map((m) => m % 12);
  assert.ok(pcs.includes(5), 'sus4 hit over C should contain F');
  assert.ok(!pcs.includes(4), 'sus4 hit over C should not contain E');
}

// MIDI export: valid header, nonzero size, tracks present.
{
  const p = A.PATTERNS.find((x) => x.id === 'cascade-16');
  const ctx = E.buildContext('C | G | Am | F', p);
  const bytes = E.exportMidi(ctx, p, 'verse', 84);
  assert.strictEqual(String.fromCharCode(...bytes.slice(0, 4)), 'MThd');
  assert.ok(bytes.length > 500, 'midi file suspiciously small: ' + bytes.length);
  // count MTrk chunks
  let tracks = 0;
  for (let i = 0; i < bytes.length - 3; i++) {
    if (bytes[i] === 0x4d && bytes[i + 1] === 0x54 && bytes[i + 2] === 0x72 && bytes[i + 3] === 0x6b) tracks++;
  }
  assert.strictEqual(tracks, 3, 'expected 3 MTrk chunks');
}

// Pattern data hygiene: steps within bar, durations positive, groups valid.
{
  const groupIds = new Set(A.GROUPS.map((g) => g.id));
  for (const p of A.PATTERNS) {
    assert.ok(groupIds.has(p.group), `${p.id}: unknown group`);
    assert.ok([1, 2, 3].includes(p.difficulty), `${p.id}: difficulty`);
    assert.ok(p.energy >= 1 && p.energy <= 5, `${p.id}: energy`);
    assert.ok(p.how && p.how.lh && p.how.rh && p.why && p.use && p.songs.length && p.tip, `${p.id}: missing teaching copy`);
    for (const ev of [...p.lh, ...p.rh]) {
      assert.ok(ev.s >= 0 && ev.s < 16, `${p.id}: step ${ev.s}`);
      assert.ok(ev.d > 0 && ev.s + ev.d <= 32, `${p.id}: dur overrun`);
    }
  }
  // no duplicate ids
  const ids = A.PATTERNS.map((p) => p.id);
  assert.strictEqual(new Set(ids).size, ids.length, 'duplicate pattern ids');
  assert.ok(A.PATTERNS.length >= 20, 'atlas should have at least 20 patterns');
}

console.log(`engine.test.js: all assertions passed (${A.PATTERNS.length} patterns × ${A.PRESETS.length} presets rendered clean)`);
