/* Pop Piano Atlas — the atlas itself.
 * 22 curated accompaniment patterns + progression presets.
 *
 * Grid: 16 sixteenth-note steps per 4/4 bar. Every pattern is data:
 *   lh events: { s, d, n: [roles], v? }              roles: R 5 5- 8 3 6 10 pedal
 *   rh events: { s, d, n, v?, mod?, anticipate? }    n: 'chord' | 'shell' | 'top' | [voicing indices]
 *                                                       | { arp: role }  (single chord-tone in RH register)
 *                                                       | 'anchor'       (key-tonic 5th+octave, chord-independent)
 *   mod: 'sus4' re-voices that hit with a suspended 4th (added colour never replaces the third).
 *   anticipate: true — the note belongs to the chord it LANDS on (step + dur), which is how
 *   pop anticipations work: pushed hits sound the coming chord, including mid-bar changes.
 */
(function () {
  'use strict';

  // helper: sixteen 16th-note RH arpeggio steps from a cycle of chord-tone roles
  function arp16(cycle, vAccent) {
    const ev = [];
    for (let s = 0; s < 16; s++) {
      ev.push({ s, d: 1, n: { arp: cycle[s % cycle.length] }, v: s % 4 === 0 ? vAccent : 0.55 });
    }
    return ev;
  }

  // helper: straight 8th-note chord hits with a velocity contour
  function pump8(vels) {
    return vels.map((v, i) => ({ s: i * 2, d: 2, n: 'chord', v }));
  }

  const GROUPS = [
    { id: 'start', name: 'Start Here', blurb: 'The load-bearing basics. Master these and every other card is a variation.' },
    { id: 'ballad', name: 'Ballads & Big Feelings', blurb: 'Slow-burn textures that carry a melody — or a singer — on top.' },
    { id: 'songwriter', name: 'Singer-Songwriter', blurb: 'Intimate, guitar-flavoured textures. Space is the instrument.' },
    { id: 'engine', name: 'Pop & Rock Engines', blurb: 'Momentum machines. These patterns are the drummer.' },
    { id: 'groove', name: 'Groove & Soul', blurb: 'Where the rhythm gets opinionated: swing, off-beats, suspensions, syncopation.' },
  ];

  const PATTERNS = [
    // ------------------------------------------------------------- START HERE
    {
      id: 'bedrock',
      group: 'start',
      name: 'Bedrock',
      tag: 'Whole notes. Hear the changes before you decorate them.',
      difficulty: 1,
      energy: 1,
      bpm: 76,
      feel: 'straight',
      pedal: 'chord',
      color: null,
      lh: [{ s: 0, d: 16, n: ['R', '5'] }],
      rh: [{ s: 0, d: 16, n: 'chord', v: 0.75 }],
      how: {
        lh: 'Root + fifth together on beat 1. Hold the whole bar.',
        rh: 'One full chord on beat 1. Hold, breathe, change with the bar.',
      },
      why:
        'Every arrangement is this pattern with decisions added. Playing it first tunes your ear to the progression itself — the voice leading, the pull between chords — before rhythm enters the picture.',
      use: 'First contact with any new progression; rubato intros; the last chord of anything.',
      songs: ['The first 30 seconds of a thousand ballads', '“Someone Like You” intro gestures'],
      tip: 'Change chords without looking down: find the next shape while the current one rings.',
    },
    {
      id: 'pillars',
      group: 'start',
      name: 'Half-Note Pillars',
      tag: 'Two pulses a bar. The slowest groove that still grooves.',
      difficulty: 1,
      energy: 2,
      bpm: 80,
      feel: 'straight',
      pedal: 'chord',
      color: null,
      lh: [
        { s: 0, d: 8, n: ['R'] },
        { s: 8, d: 8, n: ['5'] },
      ],
      rh: [
        { s: 0, d: 8, n: 'chord', v: 0.8 },
        { s: 8, d: 8, n: 'chord', v: 0.65 },
      ],
      how: {
        lh: 'Root on beat 1, fifth on beat 3. That root–fifth swing is the oldest bass move in music.',
        rh: 'Chord on 1 and 3, the second one softer — like a heartbeat’s echo.',
      },
      why:
        'Beat 1 states the chord; beat 3 answers it. The root–fifth alternation gives the bass a sense of motion without changing harmony — the foundation of country, folk and half the pop canon.',
      use: 'Verses that need calm forward motion; accompanying a singer who rushes.',
      songs: ['“Let It Be” (verse feel)', 'Country & gospel piano everywhere'],
      tip: 'Make beat 3 quieter than beat 1 and the bar instantly sounds intentional.',
    },
    {
      id: 'quarter-pulse',
      group: 'start',
      name: 'Quarter Pulse',
      tag: 'A chord on every beat. Sturdy as a table.',
      difficulty: 1,
      energy: 2,
      bpm: 92,
      feel: 'straight',
      pedal: 'chord',
      color: null,
      lh: [
        { s: 0, d: 8, n: ['R'] },
        { s: 8, d: 8, n: ['5'] },
      ],
      rh: [
        { s: 0, d: 4, n: 'chord', v: 0.85 },
        { s: 4, d: 4, n: 'chord', v: 0.6 },
        { s: 8, d: 4, n: 'chord', v: 0.72 },
        { s: 12, d: 4, n: 'chord', v: 0.6 },
      ],
      how: {
        lh: 'Root on 1, fifth on 3 — long notes under the pulse.',
        rh: 'Repeat the chord on every beat: strong, weak, medium, weak.',
      },
      why:
        'The dynamic shape 1 > 3 > 2 = 4 is what separates “playing quarters” from “hammering quarters”. This is the piano acting as its own drummer, and the listener’s foot finds it immediately.',
      use: 'Mid-energy verses; songs that need to feel honest and unfussy.',
      songs: ['“Let It Be” (chorus)', '“Lean on Me” pulse', 'Beatles piano generally'],
      tip: 'Think of beats 2 and 4 as played by your hand’s weight alone — no push.',
    },
    {
      id: 'first-arpeggio',
      group: 'start',
      name: 'First Arpeggio',
      tag: 'Unfold the chord instead of stating it.',
      difficulty: 1,
      energy: 1,
      bpm: 72,
      feel: 'straight',
      pedal: 'chord',
      color: null,
      lh: [{ s: 0, d: 16, n: ['R'] }],
      rh: [
        { s: 0, d: 4, n: [0], v: 0.75 },
        { s: 4, d: 4, n: [1], v: 0.65 },
        { s: 8, d: 4, n: [2], v: 0.7 },
        { s: 12, d: 4, n: [3], v: 0.6 },
      ],
      how: {
        lh: 'One deep root, held all bar.',
        rh: 'Play the chord one note at a time, bottom to top — four steps to the octave — and let the pedal gather them.',
      },
      why:
        'A broken chord is the same information as a block chord delivered with suspense. With the sustain pedal down, the notes accumulate into harmony — you get shimmer for the price of three fingers.',
      use: 'Intros, quiet verses, the bar before everything goes quiet.',
      songs: ['“Hallelujah”-family intros', 'Music-box moments in any ballad'],
      tip: 'Aim for perfectly even timing — the beauty of an arpeggio is its calm.',
    },
    {
      id: 'backbeat',
      group: 'start',
      name: 'The Backbeat',
      tag: 'Chords on 2 and 4 — where the snare lives.',
      difficulty: 1,
      energy: 2,
      bpm: 96,
      feel: 'straight',
      pedal: 'none',
      color: null,
      lh: [{ s: 0, d: 16, n: ['R', '5'] }],
      rh: [
        { s: 4, d: 3, n: 'chord', v: 0.72 },
        { s: 12, d: 3, n: 'chord', v: 0.78 },
      ],
      how: {
        lh: 'Root + fifth held from beat 1 — the anchor.',
        rh: 'Nothing on 1. Chords on 2 and 4, short and confident.',
      },
      why:
        'Beats 2 and 4 are the backbeat — where a drummer puts the snare. Comping there makes the piano lock with a rhythm section (real or imagined) and leaves beat 1 open for bass and voice. Learning to NOT play beat 1 is a rite of passage.',
      use: 'Band settings; behind a busy vocal; anything that should feel like soul.',
      songs: ['“Stand By Me” claps', 'Soul & gospel comping', '“Ain’t No Mountain” feel'],
      tip: 'Count out loud the first ten times. Everyone drifts back to beat 1 at first.',
    },

    // ------------------------------------------------------- BALLADS & BIG FEELINGS
    {
      id: 'roll-158',
      group: 'ballad',
      name: 'The 1-5-8 Roll',
      tag: 'The left hand becomes a harp.',
      difficulty: 2,
      energy: 2,
      bpm: 69,
      feel: 'straight',
      pedal: 'chord',
      color: 'add9',
      lh: [
        { s: 0, d: 2, n: ['R'] },
        { s: 2, d: 2, n: ['5'] },
        { s: 4, d: 2, n: ['8'] },
        { s: 6, d: 10, n: ['10'] },
      ],
      rh: [
        { s: 0, d: 8, n: 'shell', v: 0.6 },
        { s: 8, d: 8, n: 'chord', v: 0.7 },
      ],
      how: {
        lh: 'Root, fifth, octave, tenth — a rising ripple in 8ths, then let it ring.',
        rh: 'Two soft touches: an open shell on 1, the full colour on 3.',
      },
      why:
        'Root–fifth–octave outlines the chord with zero mud (no thirds down low), and the tenth on top adds the emotion. With pedal, the left hand alone sounds like an entire accompaniment — which is why every ballad pianist leans on it.',
      use: 'Verses and choruses of slow songs; weddings; any time someone says “play something pretty”.',
      songs: ['“Perfect” (Ed Sheeran, piano versions)', '“Can You Feel the Love Tonight”', 'Richard Marx / David Foster balladry'],
      tip: 'If the tenth is too far to reach, land on the octave instead — the pedal keeps the fifth alive.',
    },
    {
      id: 'cascade-16',
      group: 'ballad',
      name: 'Cascade 16ths',
      tag: 'Continuous shimmer — the “Someone Like You” engine.',
      difficulty: 3,
      energy: 3,
      bpm: 66,
      feel: 'straight',
      pedal: 'chord',
      color: null,
      lh: [
        { s: 0, d: 8, n: ['R'] },
        { s: 8, d: 8, n: ['R', '5'] },
      ],
      rh: arp16(['R', '5', '8', '10'], 0.72),
      how: {
        lh: 'Deep root on 1, root + fifth on 3. Stay out of the right hand’s way.',
        rh: 'A four-note loop — root, fifth, octave, tenth — in unbroken 16ths.',
      },
      why:
        'Constant 16ths create intensity without loudness: the energy is in the motion, not the attack. Because the loop uses only root, fifth, octave and tenth, it never clutters the harmony — it’s a waterfall that any melody can float on.',
      use: 'Emotional builds; final choruses of ballads; when stillness needs to tremble.',
      songs: ['“Someone Like You” (Adele)', '“River Flows in You” (Yiruma)', '“Clocks” cousin'],
      tip: 'Keep the wrist loose and the fingers close to the keys — this is a marathon, not punches.',
    },
    {
      id: 'anchor',
      group: 'ballad',
      name: 'The Anchor',
      tag: 'The right hand refuses to move. Tension for free.',
      difficulty: 2,
      energy: 2,
      bpm: 76,
      feel: 'straight',
      pedal: 'chord',
      color: null,
      lh: [
        { s: 0, d: 8, n: ['R', '5'] },
        { s: 8, d: 8, n: ['R', '5'] },
      ],
      rh: [
        { s: 0, d: 3, n: 'anchor', v: 0.7 },
        { s: 6, d: 2, n: 'anchor', v: 0.55 },
        { s: 12, d: 4, n: 'anchor', v: 0.62 },
      ],
      how: {
        lh: 'Root + fifth, restated on 1 and 3 — this hand carries the actual chord changes.',
        rh: 'One fixed two-note shape (the key’s 5th + octave), repeated in a heartbeat rhythm: 1, the “and” of 2, 4. It does not change when the chords change.',
      },
      why:
        'When the right hand holds still while the bass moves underneath, each chord recolours the same two notes — consonant on one chord, aching suspension on the next. It’s the cheapest emotional tension in pop, and it leaves total space for a vocal.',
      use: 'Bridge builds; stripped-back verse 2; mashup transitions; underneath a melody you’re singing.',
      songs: ['Taylor Swift’s live piano bridges', '“Everywhere”-style pedal figures', 'Worship piano builds'],
      tip: 'Listen for the chord where the anchor turns dissonant — that bar is the emotional centre of the loop.',
    },
    {
      id: 'heartbeat',
      group: 'ballad',
      name: 'The Heartbeat',
      tag: 'Beat 1, the and-of-2, beat 4. A pulse with a limp — like a heart.',
      difficulty: 2,
      energy: 3,
      bpm: 78,
      feel: 'straight',
      pedal: 'chord',
      color: 'add2',
      lh: [
        { s: 0, d: 8, n: ['R', '5'] },
        { s: 8, d: 8, n: ['R'] },
      ],
      rh: [
        { s: 0, d: 6, n: 'chord', v: 0.8 },
        { s: 6, d: 6, n: 'chord', v: 0.6 },
        { s: 12, d: 4, n: 'chord', v: 0.72 },
      ],
      how: {
        lh: 'Root + fifth on 1, root alone on 3 — steady ground under an unsteady pulse.',
        rh: 'Three chords a bar: beat 1, the “and” of 2, beat 4 — long, short-early, recover. Add2 colour keeps the repetition warm.',
      },
      why:
        'The 1 / and-of-2 / 4 figure is pop’s heartbeat motif: the second hit lands early enough to feel like a skipped beat, and the third steadies it. Repeat it unchanged while the chords move underneath and the same rhythm reads calm on one chord, anxious on the next — a whole verse of feeling from one bar of rhythm.',
      use: 'Intimate verses that need a pulse; bridge builds; under a confessional vocal.',
      songs: ['Taylor Swift piano ballads (“the heartbeat strum”)', '“my tears ricochet” live', 'Half of folklore/evermore at the piano'],
      tip: 'Keep all three hits inside one dynamic — the rhythm makes the shape, your hand shouldn’t.',
    },
    {
      id: 'push',
      group: 'ballad',
      name: 'The Push',
      tag: 'Arrive early. The secret rhythm of nearly all pop.',
      difficulty: 2,
      energy: 3,
      bpm: 88,
      feel: 'straight',
      pedal: 'chord',
      color: 'add9',
      lh: [
        { s: 0, d: 8, n: ['R'] },
        { s: 8, d: 6, n: ['R'], v: 0.6 },
        { s: 14, d: 2, n: ['R'], anticipate: true },
      ],
      rh: [
        { s: 0, d: 6, n: 'chord', v: 0.8 },
        { s: 6, d: 8, n: 'chord', v: 0.65, anticipate: true },
        { s: 14, d: 2, n: 'chord', v: 0.75, anticipate: true },
      ],
      how: {
        lh: 'Root on 1, echoed softly on 3 — then jump to the NEXT root half a beat early.',
        rh: 'Chord on 1, again on the “and” of 2… then the next chord lands on the “and” of 4, before the barline.',
      },
      why:
        'Landing the new chord an 8th early is called an anticipation, and it is the single most common rhythm in recorded pop. It makes the music lean forward — the ear hears the future arrive ahead of schedule and reads it as momentum.',
      use: 'Any time straight playing feels stiff or “classical”. Which is often.',
      songs: ['Nearly every pop record since 1965', '“Don’t Look Back in Anger” comping', 'Elton John’s right hand'],
      tip: 'Practise saying “one… and-of-four” aloud. The push must feel placed, not rushed.',
    },

    // ---------------------------------------------------------- SINGER-SONGWRITER
    {
      id: 'folk-roll',
      group: 'songwriter',
      name: 'Folk Roll',
      tag: 'Fingerpicking, translated to piano.',
      difficulty: 2,
      energy: 2,
      bpm: 84,
      feel: 'straight',
      pedal: 'chord',
      color: null,
      lh: [
        { s: 0, d: 8, n: ['R'] },
        { s: 8, d: 8, n: ['5'] },
      ],
      rh: [
        { s: 2, d: 2, n: [0], v: 0.55 },
        { s: 4, d: 2, n: [1], v: 0.6 },
        { s: 6, d: 2, n: [2], v: 0.65 },
        { s: 10, d: 2, n: [1], v: 0.55 },
        { s: 12, d: 2, n: [2], v: 0.6 },
        { s: 14, d: 2, n: [1], v: 0.5 },
      ],
      how: {
        lh: 'Root on 1, fifth on 3 — the “thumb” of the pattern.',
        rh: 'Single chord tones woven between the bass notes, never on the beat with them.',
      },
      why:
        'This is Travis picking without the guitar: bass and treble take turns, so the texture is delicate but continuous. Because hands alternate, it sounds twice as hard as it is — a classic accompaniment illusion.',
      use: 'Intimate verses; acoustic covers; songs about weather and leaving.',
      songs: ['“Landslide” (as pianists play it)', '“Skinny Love” covers', 'Iron & Wine textures'],
      tip: 'The hands should interlock like footsteps — if two notes collide, slow down until they don’t.',
    },
    {
      id: 'campfire',
      group: 'songwriter',
      name: 'Campfire Strum',
      tag: 'The world’s most-strummed rhythm, borrowed from guitar.',
      difficulty: 2,
      energy: 3,
      bpm: 108,
      feel: 'straight',
      pedal: 'none',
      color: 'add2',
      lh: [{ s: 0, d: 16, n: ['R'] }],
      rh: [
        { s: 0, d: 4, n: 'chord', v: 0.85 },
        { s: 4, d: 2, n: 'chord', v: 0.6 },
        { s: 6, d: 2, n: 'chord', v: 0.7 },
        { s: 10, d: 2, n: 'chord', v: 0.7 },
        { s: 12, d: 2, n: 'chord', v: 0.75 },
        { s: 14, d: 2, n: 'chord', v: 0.55 },
      ],
      how: {
        lh: 'Root, held — you’re the low E string.',
        rh: 'The guitar strum D–DU–UDU: hits on 1, 2, and-of-2, and-of-3, 4, and-of-4. Beat 3 is silent — that gap IS the pattern.',
      },
      why:
        'The missing downbeat on 3 is what gives this rhythm its skip. Every guitarist learns it first; on piano it instantly reads as “acoustic, warm, sung around a fire”. An added 2nd inside each chord keeps the repetition from cloying — colour on top of the triad, never instead of it.',
      use: 'Uptempo acoustic pop; covers of guitar songs; choruses that should bounce, not pound.',
      songs: ['“Love Story”, “Riptide”, “Ho Hey” — the strum is the genre'],
      tip: 'Lighten the up-strums (the off-beats). Down heavy, up feathered.',
    },
    {
      id: 'pedal-point',
      group: 'songwriter',
      name: 'The Pedal Point',
      tag: 'The bass stays home while the chords wander.',
      difficulty: 1,
      energy: 2,
      bpm: 74,
      feel: 'straight',
      pedal: 'chord',
      color: null,
      lh: [
        { s: 0, d: 8, n: ['pedal'] },
        { s: 8, d: 8, n: ['pedal'] },
      ],
      rh: [
        { s: 0, d: 8, n: 'chord', v: 0.72 },
        { s: 8, d: 8, n: 'chord', v: 0.62 },
      ],
      how: {
        lh: 'The key’s home note (the tonic), on 1 and 3 — for every single chord.',
        rh: 'The real chords, changing as written, floating above the fixed bass.',
      },
      why:
        'A pedal point inverts the usual logic: harmony moves, bass refuses. Chords that agree with the pedal sound grounded; chords that clash sound suspended, yearning. It makes even a plain progression feel cinematic — and it’s the easiest left hand on this map.',
      use: 'Intros and outros; verse 1 before the bass “arrives”; ambient reharmonising.',
      songs: ['“Halo” verse feel', '“Chasing Cars” (concept)', 'Film-score piano everywhere'],
      tip: 'Notice which chords rub against the pedal — those are your song’s tension points.',
    },
    {
      id: 'alberti-drift',
      group: 'songwriter',
      name: 'Alberti Drift',
      tag: 'Mozart’s accompaniment, wearing a hoodie.',
      difficulty: 2,
      energy: 2,
      bpm: 88,
      feel: 'straight',
      pedal: 'chord',
      color: null,
      lh: [
        { s: 0, d: 8, n: ['R'] },
        { s: 8, d: 8, n: ['5'] },
      ],
      rh: [
        { s: 0, d: 2, n: [0], v: 0.65 },
        { s: 2, d: 2, n: [2], v: 0.5 },
        { s: 4, d: 2, n: [1], v: 0.55 },
        { s: 6, d: 2, n: [2], v: 0.5 },
        { s: 8, d: 2, n: [0], v: 0.62 },
        { s: 10, d: 2, n: [2], v: 0.5 },
        { s: 12, d: 2, n: [1], v: 0.55 },
        { s: 14, d: 2, n: [2], v: 0.5 },
      ],
      how: {
        lh: 'Root and fifth in long notes.',
        rh: 'Low–high–middle–high, over and over: the Alberti bass figure, moved up into the right hand.',
      },
      why:
        'The Alberti figure is a 250-year-old trick for making a held chord feel alive. In pop it becomes a gentle music-box texture — “A Thousand Miles” is its most famous modern descendant. Great for keeping motion under a slow melody.',
      use: 'Dreamy verses; interludes; anything nostalgic.',
      songs: ['“A Thousand Miles” (spirit of)', 'Mozart K.545 (the source)', 'Lo-fi piano loops'],
      tip: 'The repeated top note should be the quietest — it’s texture, not melody.',
    },

    // -------------------------------------------------------- POP & ROCK ENGINES
    {
      id: 'eighth-pump',
      group: 'engine',
      name: 'The Pump',
      tag: 'Straight 8ths, all conviction. The pop-rock heartbeat.',
      difficulty: 2,
      energy: 4,
      bpm: 116,
      feel: 'straight',
      pedal: 'none',
      color: null,
      lh: [
        { s: 0, d: 8, n: ['R'] },
        { s: 8, d: 8, n: ['R'] },
      ],
      rh: pump8([0.85, 0.55, 0.7, 0.55, 0.78, 0.55, 0.7, 0.58]),
      how: {
        lh: 'Root in half notes — a solid floor.',
        rh: 'The chord, eight times a bar, with weight on the beats and none on the “ands”.',
      },
      why:
        'Repeated 8th-note chords are pop-rock’s idle engine: motion you can build anything on. The whole art is dynamic — beats heavy, off-beats light — so it pulses instead of hammering. Add the chorus energy switch and this becomes a stadium.',
      use: 'Choruses; driving verses; any song the drummer counts in with sticks.',
      songs: ['“How to Save a Life” (The Fray)', '“Apologize” pulse', 'The Killers’ piano parts'],
      tip: 'Practise it pianissimo. If you can pump quietly, loud is free.',
    },
    {
      id: 'folds-drive',
      group: 'engine',
      name: 'Driving Octaves',
      tag: 'Left hand as bass guitar, right hand as snare. Punk for pianists.',
      difficulty: 3,
      energy: 5,
      bpm: 132,
      feel: 'straight',
      pedal: 'none',
      color: null,
      lh: [
        { s: 0, d: 2, n: ['R', '8'], v: 0.85 },
        { s: 2, d: 2, n: ['R', '8'], v: 0.6 },
        { s: 4, d: 2, n: ['R', '8'], v: 0.7 },
        { s: 6, d: 2, n: ['R', '8'], v: 0.6 },
        { s: 8, d: 2, n: ['R', '8'], v: 0.8 },
        { s: 10, d: 2, n: ['R', '8'], v: 0.6 },
        { s: 12, d: 2, n: ['R', '8'], v: 0.7 },
        { s: 14, d: 2, n: ['R', '8'], v: 0.62 },
      ],
      rh: [
        { s: 0, d: 4, n: 'chord', v: 0.85 },
        { s: 6, d: 4, n: 'chord', v: 0.9 },
        { s: 12, d: 4, n: 'chord', v: 0.8 },
      ],
      how: {
        lh: 'Octaves on every 8th note. Relentless. This is the workout.',
        rh: 'Three stabs: beat 1, the “and” of 2, beat 4 — the classic rock syncopation.',
      },
      why:
        'The left hand takes the bass player’s job (constant 8ths = drive), freeing the right hand to hit like a snare drum. The 1 / and-of-2 / 4 stab pattern is syncopation with training wheels off — it’s why Ben Folds sounds like a full band alone.',
      use: 'When the song needs to be louder than it is; final choruses; anything cathartic.',
      songs: ['“Zak and Sara”, “Song for the Dumped” (Ben Folds)', '“Bennie and the Jets” attitude'],
      tip: 'Bounce the octaves from the wrist, not the arm — stiff forearms end this pattern early.',
    },
    {
      id: 'clocks-332',
      group: 'engine',
      name: 'The 3-3-2',
      tag: 'Eight notes, split 3+3+2. The most important rhythm in pop.',
      difficulty: 2,
      energy: 3,
      bpm: 104,
      feel: 'straight',
      pedal: 'chord',
      color: null,
      lh: [
        { s: 0, d: 8, n: ['R', '5'] },
        { s: 8, d: 8, n: ['R', '5'] },
      ],
      rh: [
        { s: 0, d: 2, n: [2], v: 0.8 },
        { s: 2, d: 2, n: [1], v: 0.55 },
        { s: 4, d: 2, n: [0], v: 0.6 },
        { s: 6, d: 2, n: [2], v: 0.78 },
        { s: 8, d: 2, n: [1], v: 0.55 },
        { s: 10, d: 2, n: [0], v: 0.6 },
        { s: 12, d: 2, n: [2], v: 0.75 },
        { s: 14, d: 2, n: [1], v: 0.55 },
      ],
      how: {
        lh: 'Root + fifth in half notes, calm underneath.',
        rh: 'A falling three-note figure (top–middle–bottom) that restarts every 3 eighth-notes: groups of 3 + 3 + 2.',
      },
      why:
        'Eight 8th-notes divided 3+3+2 — the tresillo — is the rhythmic DNA of “Clocks”, reggaetón, EDM builds and half the Hot 100. The accents drift across the beat and pull the bar forward. Learn to feel 3-3-2 and modern pop rhythm opens up.',
      use: 'Hypnotic verses; builds; any loop that should feel like it’s rolling downhill.',
      songs: ['“Clocks” (Coldplay) — literally this figure', '“Shape of You”, “Despacito” (the underlying tresillo)'],
      tip: 'Accent the first note of each group — ONE-two-three ONE-two-three ONE-two — until your hand knows it.',
    },
    {
      id: 'anthem',
      group: 'engine',
      name: 'Stadium Octaves',
      tag: 'Both hands wide open. The last chorus, in pattern form.',
      difficulty: 2,
      energy: 5,
      bpm: 120,
      feel: 'straight',
      pedal: 'chord',
      color: 'add9',
      lh: [
        { s: 0, d: 4, n: ['R', '8'], v: 0.85 },
        { s: 4, d: 4, n: ['R', '8'], v: 0.7 },
        { s: 8, d: 4, n: ['R', '8'], v: 0.8 },
        { s: 12, d: 4, n: ['R', '8'], v: 0.7 },
      ],
      rh: pump8([0.9, 0.6, 0.75, 0.6, 0.85, 0.6, 0.75, 0.65]),
      how: {
        lh: 'Octaves in quarter notes — big bells.',
        rh: 'Add9 chords pumping in 8ths, top note ringing out.',
      },
      why:
        'Octave bass in quarters plus pumping add9 chords is the “final chorus” texture: maximum width (low octaves to high add9s) and maximum pulse. The add9 keeps the wall of sound from sounding blunt — that 9th is the shimmer in every anthem.',
      use: 'Choruses, key changes, the moment the crowd’s phones go up.',
      songs: ['“Fix You” climax', '“Don’t Stop Believin’” grandeur', 'Coldplay/OneRepublic choruses'],
      tip: 'Save it. If verse 1 is a stadium, the chorus has nowhere to go.',
    },

    // ------------------------------------------------------------ GROOVE & SOUL
    {
      id: 'fifties-walk',
      group: 'groove',
      name: "The '50s Walk",
      tag: 'The bass line that built rock and roll: 1–3–5–6.',
      difficulty: 2,
      energy: 3,
      bpm: 112,
      feel: 'straight',
      pedal: 'none',
      color: null,
      lh: [
        { s: 0, d: 4, n: ['R'], v: 0.8 },
        { s: 4, d: 4, n: ['3'], v: 0.65 },
        { s: 8, d: 4, n: ['5'], v: 0.72 },
        { s: 12, d: 4, n: ['6'], v: 0.68 },
      ],
      rh: [
        { s: 4, d: 3, n: 'chord', v: 0.65 },
        { s: 12, d: 3, n: 'chord', v: 0.7 },
      ],
      how: {
        lh: 'Walk up the chord: root, third, fifth, sixth — one note per beat.',
        rh: 'Chords on the backbeat (2 and 4), short, like a snare.',
      },
      why:
        'The 1–3–5–6 walk is the skeleton of “Stand By Me” and the entire doo-wop era. A moving bass under a static chord creates groove without changing harmony, and the walk delivers you perfectly onto the next bar’s root.',
      use: 'Doo-wop progressions; retro numbers; teaching your left hand independence.',
      songs: ['“Stand By Me”', '“Earth Angel”', 'Every 12/8 slow-dance ever'],
      tip: 'The walk works because it’s legato — connect the bass notes like a singer would.',
    },
    {
      id: 'offbeats',
      group: 'groove',
      name: 'Off-Beats Only',
      tag: 'Play only the “ands”. Instant lift.',
      difficulty: 2,
      energy: 3,
      bpm: 100,
      feel: 'straight',
      pedal: 'none',
      color: null,
      lh: [
        { s: 0, d: 6, n: ['R'], v: 0.8 },
        { s: 8, d: 6, n: ['R'], v: 0.72 },
      ],
      rh: [
        { s: 2, d: 2, n: 'chord', v: 0.65 },
        { s: 6, d: 2, n: 'chord', v: 0.65 },
        { s: 10, d: 2, n: 'chord', v: 0.65 },
        { s: 14, d: 2, n: 'chord', v: 0.65 },
      ],
      how: {
        lh: 'Roots on 1 and 3 — the “on” beats.',
        rh: 'Chords ONLY on the off-beats: the “and” of every beat. Crisp, short, even.',
      },
      why:
        'This is the reggae skank on piano: the right hand answers the bass instead of agreeing with it. Off-beat chords create buoyancy — the music seems to bounce upward. It is also the single best exercise for rhythmic independence between your hands.',
      use: 'Reggae/ska feels; tropical pop; brightening a plodding song.',
      songs: ['“Three Little Birds”', '“No Woman, No Cry” skank', '“Shape of You” comp feel'],
      tip: 'Whisper “and” as you play each chord. When you can stop whispering, you own it.',
    },
    {
      id: 'shuffle',
      group: 'groove',
      name: 'The Charleston Shuffle',
      tag: 'Swing the 8ths, hit 1 and the and-of-2. Ninety years of cool.',
      difficulty: 2,
      energy: 3,
      bpm: 112,
      feel: 'swing',
      pedal: 'none',
      color: null,
      lh: [
        { s: 0, d: 4, n: ['R'], v: 0.78 },
        { s: 4, d: 4, n: ['5'], v: 0.62 },
        { s: 8, d: 4, n: ['6'], v: 0.7 },
        { s: 12, d: 4, n: ['5'], v: 0.62 },
      ],
      rh: [
        { s: 0, d: 3, n: 'chord', v: 0.78 },
        { s: 6, d: 4, n: 'chord', v: 0.68 },
      ],
      how: {
        lh: 'A bouncing walk — root, fifth, sixth, fifth — with a swing lilt.',
        rh: 'Two hits per bar: beat 1, then the “and” of 2, held. That rhythm is called the Charleston.',
      },
      why:
        'Swing means the off-beats arrive late, in a long-short lope. The Charleston rhythm (1, and-of-2) is jazz’s most durable comping figure — two notes that imply an entire rhythm section. Together they make anything sound like it owns a hat.',
      use: 'Blues, swing, old-soul covers; making simple progressions sound sophisticated.',
      songs: ['“Valerie” (Winehouse version)', '“Home” (Bublé)', 'Any 12-bar blues'],
      tip: 'Swing lives in the LATE off-beat. If it sounds like a limerick, you’ve over-swung.',
    },
    {
      id: 'gospel-sus',
      group: 'groove',
      name: 'Gospel Sus',
      tag: 'Suspend the chord, then let it land. Church in one move.',
      difficulty: 3,
      energy: 4,
      bpm: 80,
      feel: 'straight',
      pedal: 'chord',
      color: null,
      lh: [
        { s: 0, d: 8, n: ['R'] },
        { s: 8, d: 4, n: ['R', '5'] },
        { s: 12, d: 4, n: ['8'], v: 0.7 },
      ],
      rh: [
        { s: 0, d: 4, n: 'chord', mod: 'sus4', v: 0.82 },
        { s: 4, d: 6, n: 'chord', v: 0.7 },
        { s: 10, d: 2, n: 'chord', mod: 'sus4', v: 0.6 },
        { s: 12, d: 4, n: 'chord', v: 0.78 },
      ],
      how: {
        lh: 'Root, then root + fifth, then the octave climbing into the next bar.',
        rh: 'Every chord arrives suspended (4th instead of 3rd) and then resolves. Tension… release. Twice a bar.',
      },
      why:
        'The sus4→3 resolution is gospel’s signature gesture: the 4th leans on the chord and then settles home, and the ear hears “amen” every time. Sprinkling suspensions over a plain progression is the fastest way to make it sound played rather than pressed.',
      use: 'Gospel, soul and worship settings; turnarounds; adding ceremony to a chorus.',
      songs: ['“Oh Happy Day”', '“Let It Be” (gospel readings)', '“Someone Saved My Life Tonight”'],
      tip: 'Voice the sus and its resolution with the same hand shape — only one finger should move.',
    },
    {
      id: 'snap-16',
      group: 'groove',
      name: '16th Snap',
      tag: 'Short, syncopated, funky. The chord as percussion.',
      difficulty: 3,
      energy: 4,
      bpm: 96,
      feel: 'straight',
      pedal: 'none',
      color: null,
      lh: [
        { s: 0, d: 3, n: ['R'], v: 0.85 },
        { s: 6, d: 2, n: ['R'], v: 0.6 },
        { s: 8, d: 2, n: ['5'], v: 0.65 },
        { s: 12, d: 3, n: ['R'], v: 0.75 },
      ],
      rh: [
        { s: 0, d: 1, n: 'chord', v: 0.85 },
        { s: 3, d: 1, n: 'chord', v: 0.55 },
        { s: 6, d: 2, n: 'chord', v: 0.78 },
        { s: 10, d: 1, n: 'chord', v: 0.6 },
        { s: 12, d: 2, n: 'chord', v: 0.8 },
      ],
      how: {
        lh: 'Punchy roots and fifths in a broken, bass-player rhythm.',
        rh: 'Five stabs scattered across the 16th grid — beat 1, the “a” of 1, the “and” of 2, the “a” of 3, beat 4. All short.',
      },
      why:
        'Funk treats chords as drums: the pitch matters less than the placement. Notes off the grid’s strong points (the “e”s and “a”s) snap against the pulse. Every release is as rhythmic as every attack — the silence between stabs IS the groove.',
      use: 'Funk and R&B; pre-choruses that need attitude; tightening up a band.',
      songs: ['“Superstition” (clav feel)', 'Charlie Puth-style pop-funk', 'D’Angelo-lite comping'],
      tip: 'Practise with the metronome on 2 and 4 only. Funk is measured in what you leave out.',
    },
  ];

  // ------------------------------------------------------------ progression presets
  const PRESETS = [
    { id: 'axis', name: 'The Axis of Pop', text: 'C | G | Am | F', note: 'I–V–vi–IV. Half the charts, one loop.' },
    { id: 'doowop', name: "'50s Doo-Wop", text: 'C | Am | F | G', note: 'I–vi–IV–V. “Stand By Me”, “Earth Angel”.' },
    { id: 'turnaround', name: 'The Turnaround', text: 'C Am | Dm G', note: 'I–vi–ii–V, two chords a bar. Jazz’s favourite loop.' },
    { id: 'heart', name: 'The Heart-Tugger', text: 'Am | F | C | G', note: 'vi–IV–I–V. Same chords as the Axis, sadder door.' },
    { id: 'lift', name: 'The Lift', text: 'F | G | Em | Am', note: 'IV–V–iii–vi. The J-pop “royal road”.' },
    { id: 'adele', name: 'Hello, Adele', text: 'A | C#m/G# | F#m | D', note: 'I–iii⁶–vi–IV with a walking bass line.' },
    { id: 'letitbe', name: 'Let It Be', text: 'C | G | Am | F | C | G | F | C', note: 'The full 8-bar gospel-pop sentence.' },
    { id: 'canon', name: "Pachelbel's Wheel", text: 'C | G | Am | Em | F | C | F | G', note: 'The Canon. Also “Basket Case”. Also everything.' },
    { id: 'creep', name: 'The Chromatic Drift', text: 'G | B | C | Cm', note: 'I–III–IV–iv. “Creep”. Borrowed chords, big feelings.' },
  ];

  const Atlas = { GROUPS, PATTERNS, PRESETS };
  if (typeof module !== 'undefined' && module.exports) module.exports = Atlas;
  else window.Atlas = Atlas;
})();
