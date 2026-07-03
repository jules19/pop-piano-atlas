const assert = require('assert');
const T = require('../js/theory.js');

// ---- chord parsing
let c = T.parseChord('C');
assert.deepStrictEqual(c.pcs, [0, 4, 7]);
assert.strictEqual(c.isMinor, false);

c = T.parseChord('Am7');
assert.strictEqual(c.rootPc, 9);
assert.deepStrictEqual(c.intervals, [0, 3, 7, 10]);
assert.strictEqual(c.isMinor, true);

c = T.parseChord('G/B');
assert.strictEqual(c.rootPc, 7);
assert.strictEqual(c.bassPc, 11);
assert.strictEqual(c.hasSlash, true);

c = T.parseChord('Fsus2');
assert.deepStrictEqual(c.intervals, [0, 2, 7]);

c = T.parseChord('Bbadd9');
assert.strictEqual(c.rootPc, 10);
assert.deepStrictEqual(c.intervals, [0, 4, 7, 14]);

c = T.parseChord('C#m');
assert.strictEqual(c.rootPc, 1);
assert.strictEqual(c.isMinor, true);

assert.strictEqual(T.parseChord('H7'), null);
assert.strictEqual(T.parseChord('Cxyz'), null);

// ---- progression parsing
let p = T.parseProgression('C | G | Am | F');
assert.ok(p.ok);
assert.strictEqual(p.bars.length, 4);
assert.strictEqual(p.bars[0].length, 1);

p = T.parseProgression('C G | Am F');
assert.ok(p.ok);
assert.strictEqual(p.bars[0].length, 2);

p = T.parseProgression('C G Am | F');
assert.ok(!p.ok);

p = T.parseProgression('');
assert.ok(!p.ok);

// ---- key detection + roman numerals
const axis = ['C', 'G', 'Am', 'F'].map(T.parseChord);
const tonic = T.detectKey(axis);
assert.strictEqual(tonic, 0, 'C G Am F should read as C major, got ' + T.keyName(tonic));
assert.strictEqual(T.romanNumeral(axis[0], tonic), 'I');
assert.strictEqual(T.romanNumeral(axis[1], tonic), 'V');
assert.strictEqual(T.romanNumeral(axis[2], tonic), 'vi');
assert.strictEqual(T.romanNumeral(axis[3], tonic), 'IV');

const inA = ['A', 'C#m', 'F#m', 'D'].map(T.parseChord);
const tonicA = T.detectKey(inA);
assert.strictEqual(tonicA, 9, 'expected A major, got ' + T.keyName(tonicA));
assert.strictEqual(T.romanNumeral(inA[1], tonicA), 'iii');

// borrowed chord: Creep — G B C Cm
const creep = ['G', 'B', 'C', 'Cm'].map(T.parseChord);
const tonicG = T.detectKey(creep);
assert.strictEqual(tonicG, 7, 'expected G major, got ' + T.keyName(tonicG));
assert.strictEqual(T.romanNumeral(creep[3], tonicG), 'iv');

// ---- transpose
assert.strictEqual(T.transposeSymbol('C', 2), 'D');
assert.strictEqual(T.transposeSymbol('Am7', 3), 'Cm7');
assert.strictEqual(T.transposeSymbol('G/B', 2), 'A/C#');
assert.strictEqual(T.transposeSymbol('Bb', 2), 'C');

// ---- voicing engine
const R = T.RENDER;
let prev = null;
const seq = ['C', 'G', 'Am', 'F'].map(T.parseChord);
const voicings = [];
for (const ch of seq) {
  const v = T.voiceChord(ch, prev, 'add9');
  voicings.push(v);
  // in range
  assert.ok(v[0] >= R.rhLow, `bottom ${v[0]} below mud guard`);
  assert.ok(v[v.length - 1] <= R.rhHigh, `top ${v[v.length - 1]} too high`);
  // ascending, unique
  for (let i = 1; i < v.length; i++) assert.ok(v[i] > v[i - 1], 'voicing not ascending');
  // hand span
  assert.ok(v[v.length - 1] - v[0] <= 14, 'span > 9th');
  // contains chord tones only (mod 12, allowing color)
  prev = v;
}
// voice-leading: total top-voice movement across the loop should be small
for (let i = 1; i < voicings.length; i++) {
  const a = voicings[i - 1], b = voicings[i];
  const topMove = Math.abs(a[a.length - 1] - b[b.length - 1]);
  assert.ok(topMove <= 7, `top voice jumped ${topMove} semitones between chords ${i - 1}->${i}`);
}

// slash chord bass goes to the slash note
const gb = T.parseChord('G/B');
assert.strictEqual(T.lhRole('R', gb, 0) % 12, 11);

// pedal role uses the key tonic
assert.strictEqual(T.lhRole('pedal', T.parseChord('F'), 0) % 12, 0);

// bass register sanity across all roots
for (let pc = 0; pc < 12; pc++) {
  const m = T.bassMidi(pc, 42);
  assert.ok(m >= 29 && m <= 55, `bass ${m} out of register for pc ${pc}`);
}

console.log('theory.test.js: all assertions passed');
