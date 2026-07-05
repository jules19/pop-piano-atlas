/* Arrangement layer audit: every arrangement references real patterns, builds a sane
 * timeline over any progression, renders clean (fills included, all energy levels),
 * exports valid MIDI — and its fills actually do what they claim: the LH walk-up
 * lands a leading tone under the coming root, the RH lift anticipates the next chord.
 */
const assert = require('assert');
const T = require('../js/theory.js');
const A = require('../js/patterns.js');
const R = require('../js/arrangements.js');
const E = require('../js/engine.js');

const patternById = Object.fromEntries(A.PATTERNS.map((p) => [p.id, p]));

// ---- data integrity
for (const arr of R.ARRANGEMENTS) {
  assert.ok(arr.id && arr.name && arr.influence && arr.blurb && arr.why, `${arr.id}: missing copy`);
  assert.ok(arr.bpm >= 48 && arr.bpm <= 176, `${arr.id}: bpm outside the tempo slider`);
  assert.ok(arr.sections.length >= 3, `${arr.id}: an arc needs at least three sections`);
  for (const sec of arr.sections) {
    assert.ok(patternById[sec.pattern], `${arr.id}: unknown pattern "${sec.pattern}"`);
    assert.ok(sec.energy >= 1 && sec.energy <= 5, `${arr.id}/${sec.name}: energy out of range`);
    if (sec.dyn) assert.ok(sec.dyn.every((d) => d > 0.5 && d < 1.5), `${arr.id}/${sec.name}: wild dyn`);
    if (sec.fill) assert.ok(/^(walkup|lift|walkup\+lift)$/.test(sec.fill), `${arr.id}/${sec.name}: bad fill "${sec.fill}"`);
  }
}

// ---- energy ladder mapping + monotonic loudness
assert.strictEqual(E.energyLevel('verse'), 2);
assert.strictEqual(E.energyLevel('chorus'), 4);
assert.strictEqual(E.energyLevel('3'), 3);
assert.strictEqual(E.energyLevel(5), 5);
assert.strictEqual(E.energyLevel(undefined), 2);
{
  const pat = A.PATTERNS.find((p) => p.id === 'quarter-pulse');
  const ctx = E.buildContext('C | G | Am | F', pat);
  let prev = 0;
  for (const level of [1, 2, 3, 4, 5]) {
    const ev = E.renderBar(ctx, pat, 0, level)[0];
    assert.ok(ev.vel > prev, `energy ${level} should be louder than ${level - 1}`);
    prev = ev.vel;
  }
}

// ---- timelines build and render clean over every preset, fills and arcs included
for (const preset of A.PRESETS) {
  for (const arr of R.ARRANGEMENTS) {
    const ctx = E.buildContext(preset.text, null);
    assert.ok(ctx.ok, `context failed for ${preset.id}`);
    const timeline = E.buildTimeline(ctx, arr, patternById);
    const expected = arr.sections.reduce((n, s) => n + (s.loops || 1) * ctx.totalBars, 0);
    assert.strictEqual(timeline.length, expected, `${arr.id} × ${preset.id}: timeline length`);
    timeline.forEach((entry, i) => {
      assert.ok(entry.pattern && entry.velMul > 0.4 && entry.velMul < 1.6, `${arr.id}: bad entry ${i}`);
      const events = E.renderBar(ctx, entry.pattern, i % ctx.totalBars, entry.energy, {
        velMul: entry.velMul,
        fill: entry.fill,
      });
      assert.ok(events.length > 0, `${arr.id} × ${preset.id} bar ${i}: no events`);
      for (const ev of events) {
        assert.ok(ev.vel > 0 && ev.vel <= 1, `${arr.id} bar ${i}: bad vel ${ev.vel}`);
        assert.ok(ev.dur > 0, `${arr.id} bar ${i}: bad dur`);
        for (const m of ev.midis) {
          assert.ok(Number.isFinite(m) && m >= 24 && m <= 96, `${arr.id} × ${preset.id} bar ${i}: midi ${m} out of range`);
        }
      }
    });
  }
}

// ---- fills only fire on the last bar of a section that declares one
{
  const ctx = E.buildContext('C | G | Am | F', null);
  const arr = R.ARRANGEMENTS.find((a) => a.id === 'piano-man');
  const timeline = E.buildTimeline(ctx, arr, patternById);
  timeline.forEach((entry, i) => {
    const sec = arr.sections[entry.sectionIdx];
    const barsInSec = (sec.loops || 1) * ctx.totalBars;
    const isLast = entry.barInSection === barsInSec - 1;
    if (entry.fill) assert.ok(isLast && sec.fill, `${arr.id}: fill on a non-final bar`);
    if (isLast && sec.fill) assert.ok(entry.fill, `${arr.id}: declared fill missing on final bar`);
  });
}

// ---- walk-up fill: last two LH notes climb to a leading tone under the coming root
{
  const pat = patternById['quarter-pulse'];
  const ctx = E.buildContext('C | G | Am | F', pat);
  const targetPc = ctx.segments[0].chord.bassPc; // C
  const events = E.renderBar(ctx, pat, 3, 'verse', { fill: { type: 'walkup', targetPc } });
  const fillNotes = events.filter((e) => e.fill);
  assert.strictEqual(fillNotes.length, 2, 'walk-up should add two approach notes');
  const [a, b] = fillNotes.sort((x, y) => x.step - y.step);
  assert.strictEqual(a.step, 12);
  assert.strictEqual(b.step, 14);
  assert.strictEqual((b.midis[0] + 1) % 12, targetPc, 'second approach note should lead by a semitone into the root');
  assert.strictEqual(b.midis[0] - a.midis[0], 2, 'the climb should be a whole step then a half step');
  // the LH tail it replaces is gone
  assert.ok(!events.some((e) => e.hand === 'lh' && !e.fill && e.step >= 10), 'original LH tail should be cleared');
}

// ---- lift fill: the bar ends with a sus4 colour then an anticipation of the NEXT chord
{
  const pat = patternById['eighth-pump'];
  const ctx = E.buildContext('C | G | Am | F', pat);
  const targetPc = ctx.segments[0].chord.bassPc;
  const events = E.renderBar(ctx, pat, 3, 'verse', { fill: { type: 'lift', targetPc } });
  const antic = events.find((e) => e.hand === 'rh' && e.anticipate && e.intoNextBar);
  assert.ok(antic, 'lift should anticipate across the barline');
  // bar 3 is F; the anticipation must sound the wrapped-around first chord (C major)
  assert.ok(antic.midis.every((m) => [0, 4, 7].includes(m % 12)), 'anticipated chord should be the coming C, got ' + antic.midis.map((m) => m % 12));
  const sus = events.find((e) => e.hand === 'rh' && e.step === 12);
  assert.ok(sus, 'lift should place a sus4 push on beat 4');
  assert.ok(sus.midis.some((m) => m % 12 === (ctx.segments[3].chord.rootPc + 5) % 12), 'beat-4 push should carry the suspended 4th');
}

// ---- arrangement MIDI export: valid SMF, long enough to hold the whole arc
{
  const ctx = E.buildContext('C | G | Am | F', null);
  const arr = R.ARRANGEMENTS[0];
  const timeline = E.buildTimeline(ctx, arr, patternById);
  const bytes = E.exportArrangementMidi(ctx, timeline, arr.bpm);
  assert.ok(bytes instanceof Uint8Array && bytes.length > 400, 'arrangement midi too small');
  assert.strictEqual(String.fromCharCode(...bytes.slice(0, 4)), 'MThd');
  const singleBytes = E.exportMidi(ctx, patternById['bedrock'], 'verse', 84);
  assert.ok(bytes.length > singleBytes.length, 'arrangement export should contain more music than one pattern loop');
}

// ---- the player follows the timeline: patterns swap at section boundaries.
// The scheduler runs on setInterval + an audio clock, so drive it with a fake
// clock that jumps a bar's worth of time on every read.
(async function playerFollowsTimeline() {
  let clock = 0;
  const audio = {
    resume() {},
    now() {
      clock += 3.2; // > seconds-per-bar at 84 bpm, so every tick schedules a bar
      return clock;
    },
    playNote() {},
    click() {},
    allOff() {},
  };
  const player = E.createPlayer(() => audio);
  player.setSong('C | G | Am | F');
  const arr = R.ARRANGEMENTS.find((a) => a.id === 'slow-burn');
  const timeline = player.setArrangement(arr, patternById);
  assert.ok(timeline.length >= 20, 'slow burn should span at least 5 sections × 4 bars');
  assert.strictEqual(player.state.pattern.id, arr.sections[0].pattern, 'player should open on the first section pattern');
  const swaps = [];
  player.on('swap', (p) => swaps.push(p.id));
  player.play();
  const deadline = Date.now() + 5000;
  while (player.state.bar < timeline.length + 1 && Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 25));
  }
  player.stop();
  assert.ok(player.state.bar >= timeline.length, `player only scheduled ${player.state.bar} bars`);
  for (const sec of arr.sections.slice(1)) {
    assert.ok(swaps.includes(sec.pattern), `player never swapped to ${sec.pattern}`);
  }
  console.log(
    `arrangements.test.js: ${R.ARRANGEMENTS.length} arrangements × ${A.PRESETS.length} progressions render clean — fills, arcs, energy ladder, MIDI, player`
  );
})();
