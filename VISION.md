# Pop Piano Atlas

**You know the chords. Now learn every way to play them.**

---

## The problem

Every pop pianist hits the same wall, usually within their first year:

> "I can play C, G, Am and F. So why does it sound nothing like the record?"

The harmony of pop music is famously simple — four chords carry half the charts. The *magic* is
in the arrangement: what the left hand does, how the right hand voices the chord, where the
rhythm places its weight. A chord progression is the skeleton; **accompaniment is the body
language.**

Existing tools don't serve this moment:

- **Chord apps** (Tonaly, Piano Companion) stop at the skeleton — they tell you *what* the chords
  are, never *what to play*.
- **Backing-track apps** (iReal Pro, Band-in-a-Box) play the accompaniment *for* you, as an
  opaque audio product. You hear it; you can't see it, slow it into your hands, or understand it.
- **Producer tools** (Scaler, Captain Chords) generate MIDI for a DAW timeline. They think in
  tracks and exports, not in hands and habits.

Nobody is answering the actual question a learner asks at the keys:
**"I know the chords. What can I actually play — and why does it work?"**

## The product

Pop Piano Atlas is an **accompaniment atlas**: a curated, playable map of the patterns real
pianists actually use, laid over *your* chord progression.

The core loop, in ten seconds:

1. Enter any progression (or start with the one already loaded: `C  G  Am  F`).
2. Press play. It loops, forever.
3. Flip through pattern cards. Each click re-dresses the *same* progression in a new
   accompaniment — the swap lands cleanly on the next bar, so the music never stops.
4. When something makes you lean in, open it: see both hands on a keyboard, see the rhythm on a
   beat grid, slow it down, mute a hand, read *why it works* and *which records use it* — then go
   play it.

That's it. No timeline, no tracks, no project files. The unit of value is not a song or an
export; it's a **pattern that moves from the screen into your hands.**

## Where I deliberately departed from the brainstorm

The notes were treated as evidence, not spec. Four assumptions got challenged:

### 1. Combinatorics → Curation

The notes propose LH dropdown × RH dropdown × groove dropdown — "10 × 10 × 8 = 800 useful
combinations." I built that space under the hood, but I refuse to ship it as the interface.
A parameter space is how a *producer* thinks. A *teacher* gives you a small number of named,
real things: "this is the 1-5-8 roll; this is the heartbeat; this is the 3-3-2." Names are how
technique becomes memorable, discussable, and practicable. Most of those 800 combinations are
musically inert; a learner can't tell which, and auditioning 800 things is a chore, not
inspiration.

So the atlas ships **~22 curated, named patterns** — each one a technique that appears on
thousands of records — organized as a deck you can flip through in minutes. Depth comes from
crossing them with *your* progressions and the energy dial, not from a combinatorial matrix.

### 2. Artist archetypes → Technique names, with receipts

The notes lean on "Taylor-style," "Ben Folds-style," "Coldplay-style" as the primary taxonomy.
Artist names are great *hooks* but poor *categories*: they date quickly, they're legally
awkward as product surface, and they teach the wrong lesson — that the technique belongs to the
artist rather than to the tradition. The atlas flips it: patterns are named for **what your hands
do** ("Driving Octaves," "The Anchor," "Cascade 16ths"), and each card cites songs where you can
hear it. The artist becomes evidence, not identity.

### 3. Generative AI → Deterministic patterns, explained

The notes gesture at "type 'play this like Taylor Swift' and get MIDI." For the core learning
loop this is the wrong tool: generation is unrepeatable, unexplainable, and often subtly
unpianistic. Pedagogy needs the opposite — the same pattern every time, rendered through
explicit rules you can read (voice leading, hand span, register limits). AI belongs at the
edges (natural-language pattern search, "listen to me play and coach me"), and the data model
leaves room for it. It is not in v1's critical path.

### 4. Transform system → One energy dial

The notes design a whole transform vocabulary (`build_energy.json`, `simplify.json`,
`bridge_climax.json`). That's a real insight — arrangement is about *sections*, and the same
pattern is played small in a verse and big in a chorus — but it doesn't need a system. It needs
**one switch: Verse ↔ Chorus.** Chorus mode widens the left hand into octaves, doubles the
right-hand top, and leans into the velocities — the exact moves a real pianist makes when the
chorus hits. One control, one lesson, learned by ear in ten seconds.

## What survived from the notes (because it was right)

- **"Skeleton vs body language"** — it's the product's thesis, verbatim.
- **The recipe data model.** Patterns are stored as *roles on a rhythm grid* (`root`, `fifth`,
  chord-tone indices), never as literal pitches — so any pattern renders over any chord in any
  key. This is the notes' pattern-JSON idea, tightened.
- **Rendering constraints as first-class.** Hand span limits, LH/RH register windows, a
  low-interval mud guard, per-chord pedal — the difference between "MIDI" and "something a human
  plays with two hands."
- **The learning layer.** Every pattern answers four questions: *How do I play it? Why does it
  work? Where would I use it? Where can I hear it?* Notes' idea, promoted from feature to
  reason-for-being.
- **The "static right-hand anchor"** pattern from the notes' Taylor vocabulary is in the deck
  (as "The Anchor") — it's a genuinely great teaching pattern.

## The interaction that carries the product

**The loop never stops.** Every design decision serves audition speed:

- Pattern swaps queue to the next barline — always musical, never a stutter.
- Arrow keys flip through the deck while the loop plays: fifteen accompaniments a minute.
- Tempo, energy, hands, and metronome are all live during playback.
- Chord edits re-render on the next pass.

Discovery happens *inside* continuous music. That feeling — the same four chords becoming
fifteen different songs under your fingers' future — is the product.

## Pedagogy model

Each pattern card carries:

| Field | Question it answers |
|---|---|
| **Hands** | What does each hand literally do, beat by beat? |
| **Why it works** | The musical mechanism (space for a vocal, tension of a static anchor, the 3-3-2's forward lean) |
| **Use it for** | Verse / chorus / build — arrangement context |
| **Hear it in** | Real records, so the ear confirms the concept |
| **Difficulty** | 1–3, honest |

Plus practice affordances: loop by default, tempo 40–180, hands-separate muting, count-in,
metronome, live keyboard + rhythm-grid visualization, and one-click MIDI export of exactly what
you hear.

## Architecture (v1, shipped in this repo)

Zero-dependency web app — no build step, no server, no accounts. Static files.

```
index.html
css/styles.css
js/theory.js     chord parser · key & roman-numeral analysis · voice-led voicing engine
js/patterns.js   the atlas: 22 patterns + 8 progression presets (data, not code)
js/engine.js     (progression × pattern × energy) → note events · lookahead scheduler · MIDI export
js/audio.js      Web Audio piano (additive, velocity-sensitive) · reverb · metronome
js/ui.js         deck, keyboard viz, rhythm map, learn panel, transport
tools/build_single.py  → dist/pop-piano-atlas.html (single-file, shareable)
tests/           node unit tests for theory + engine
```

The pattern schema is deliberately boring JSON so that new patterns are contributions, not
engineering.

## Roadmap (in order of conviction)

1. **More meters** — 3/4 and 6/8 unlock waltz ballads and "Hallelujah"-family patterns.
2. **MIDI keyboard in** — play along, get gentle rhythm feedback; the practice loop closes.
3. **Song mode** — assign patterns per section (verse/pre/chorus) and hear the arrangement arc.
4. **AI at the edges** — natural-language search over pattern metadata ("something sparse and
   hopeful for a verse"), and pattern *explanation* chat.
5. **Community atlas** — user-contributed patterns through the same schema, editorially curated.

---

*The bet: pianists don't need another tool that plays music at them. They need a map from the
chords they know to the music they hear — small enough to explore in an evening, deep enough to
practice for a year.*
