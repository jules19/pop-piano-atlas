/* Pop Piano Atlas — full arrangements.
 * A style recipe = a sequence of sections, each looping the whole progression with
 * one pattern, an energy level (1–5), a dynamics arc, and an optional fill into the
 * next section. The same chords, played as a complete performance: intro, verse,
 * build, chorus, afterglow — the arc is the arrangement.
 *
 * Section fields:
 *   pattern — a pattern id from the atlas          energy — 1 hush … 5 finale
 *   loops   — times through the progression (default 1)
 *   dyn     — [startMul, endMul] velocity arc across the section
 *   fill    — 'walkup' (LH climbs into the next root) | 'lift' (RH sus4 push +
 *             anticipated chord) | 'walkup+lift' — played in the section's last bar
 */
(function () {
  'use strict';

  const ARRANGEMENTS = [
    {
      id: 'slow-burn',
      name: 'The Slow Burn',
      influence: 'Adele · power-ballad arc',
      bpm: 68,
      blurb: 'Whole notes to a wall of sound in five moves. The classic ballad crescendo.',
      why:
        'Big ballads are built on withholding: the first minute spends almost nothing, so the chorus can spend everything. Each section here adds exactly one thing — motion, then density, then register — and the fills tell your ear a change is coming before it arrives.',
      sections: [
        { name: 'Intro', pattern: 'bedrock', energy: 1, dyn: [0.85, 0.92] },
        { name: 'Verse', pattern: 'roll-158', energy: 2, dyn: [0.92, 1.0], fill: 'lift' },
        { name: 'Build', pattern: 'cascade-16', energy: 3, dyn: [0.95, 1.1], fill: 'walkup+lift' },
        { name: 'Chorus', pattern: 'anthem', energy: 5, dyn: [1.05, 1.1] },
        { name: 'Afterglow', pattern: 'first-arpeggio', energy: 1, dyn: [0.9, 0.75] },
      ],
    },
    {
      id: 'cardigan',
      name: 'Cardigan Weather',
      influence: 'Taylor Swift · live-piano ballad',
      bpm: 80,
      blurb: 'Pedal tones, folk picking, the heartbeat pulse — intimacy that swells and recedes.',
      why:
        'The Taylor-at-the-piano sound is repetition recoloured: a fixed figure (the heartbeat, the anchor) held steady while the harmony moves underneath. Energy comes from texture, not volume — the chorus here is a strum, not a shout, and the outro empties the room again.',
      sections: [
        { name: 'Intro', pattern: 'pedal-point', energy: 1, dyn: [0.85, 0.95] },
        { name: 'Verse', pattern: 'folk-roll', energy: 2, dyn: [0.92, 1.0] },
        { name: 'Heartbeat', pattern: 'heartbeat', energy: 3, dyn: [0.95, 1.08], fill: 'lift' },
        { name: 'Chorus', pattern: 'campfire', energy: 4, dyn: [1.0, 1.08] },
        { name: 'Outro', pattern: 'bedrock', energy: 1, dyn: [0.88, 0.72] },
      ],
    },
    {
      id: 'piano-man',
      name: 'Piano Man Fuel',
      influence: 'Ben Folds · Elton John · rock piano',
      bpm: 126,
      blurb: 'Quarter pulse, pushed chords, driving octaves — the piano as a whole rhythm section.',
      why:
        'Rock piano is an escalation of pulse: quarters become pushed 8ths become relentless octaves. The walk-up fills are the tell — that little 6̂–7̂ climb into the next root is how a player signals “hold on, here it comes” without a drummer.',
      sections: [
        { name: 'Verse', pattern: 'quarter-pulse', energy: 2, dyn: [0.95, 1.0] },
        { name: 'Pre-chorus', pattern: 'push', energy: 3, dyn: [1.0, 1.08], fill: 'walkup' },
        { name: 'Chorus', pattern: 'folds-drive', energy: 4, dyn: [1.02, 1.08], fill: 'walkup' },
        { name: 'Last chorus', pattern: 'anthem', energy: 5, dyn: [1.05, 1.12] },
      ],
    },
    {
      id: 'yellow-lights',
      name: 'Yellow Lights',
      influence: 'Coldplay · arena anthem build',
      bpm: 108,
      blurb: 'A hypnotic 3-3-2 that swells into stadium octaves. Bring a lighter.',
      why:
        'The anthem formula: start with a loop so hypnotic the listener stops noticing it, then raise the floor under them. The 3-3-2 carries the verse, straight 8ths take over as the pulse locks in, and the final section is the same chords played as wide as two hands allow.',
      sections: [
        { name: 'Intro', pattern: 'pedal-point', energy: 1, dyn: [0.85, 0.95] },
        { name: 'Verse', pattern: 'clocks-332', energy: 2, dyn: [0.95, 1.02] },
        { name: 'Build', pattern: 'eighth-pump', energy: 3, dyn: [0.98, 1.1], fill: 'lift' },
        { name: 'Chorus', pattern: 'anthem', energy: 5, dyn: [1.05, 1.12] },
      ],
    },
    {
      id: 'sunday-service',
      name: 'Sunday Service',
      influence: 'Gospel-soul · Aretha to worship piano',
      bpm: 84,
      blurb: 'Backbeats, a walking bass, and sus4 suspensions that resolve like an amen.',
      why:
        'Gospel piano moves the congregation by tension and release: backbeat comping makes the pulse physical, the ’50s walk keeps the floor moving, and the sus chorus leans on every chord before letting it land. The walk-up fill is pure church — the bass always announces the next chord.',
      sections: [
        { name: 'Verse', pattern: 'pillars', energy: 2, dyn: [0.92, 1.0] },
        { name: 'Groove', pattern: 'backbeat', energy: 3, dyn: [0.98, 1.04] },
        { name: 'Walk', pattern: 'fifties-walk', energy: 3, dyn: [1.0, 1.06], fill: 'walkup' },
        { name: 'Chorus', pattern: 'gospel-sus', energy: 4, dyn: [1.02, 1.1], fill: 'walkup+lift' },
        { name: 'Benediction', pattern: 'bedrock', energy: 2, dyn: [0.9, 0.78] },
      ],
    },
    {
      id: 'small-hours',
      name: 'Small Hours',
      influence: 'Neo-soul · late-night groove',
      bpm: 96,
      blurb: 'Swing, skank, snap — the groove tightens as the night gets later.',
      why:
        'Groove arrangements build by subdivision, not volume: the shuffle lopes in 8ths, the off-beats halve the space, and the 16th snap fills what’s left. Then the last section exhales — ending a groove quietly is the oldest late-night move there is.',
      sections: [
        { name: 'Stroll', pattern: 'shuffle', energy: 2, dyn: [0.95, 1.0] },
        { name: 'Skank', pattern: 'offbeats', energy: 3, dyn: [0.98, 1.05] },
        { name: 'Snap', pattern: 'snap-16', energy: 4, dyn: [1.0, 1.08], fill: 'walkup' },
        { name: 'Fade', pattern: 'first-arpeggio', energy: 1, dyn: [0.88, 0.7] },
      ],
    },
  ];

  const Arrangements = { ARRANGEMENTS };
  if (typeof module !== 'undefined' && module.exports) module.exports = Arrangements;
  else window.Arrangements = Arrangements;
})();
