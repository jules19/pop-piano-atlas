# Pop Piano Atlas 🎹

**You know the chords. Now learn every way to play them.**

An accompaniment atlas for pianists: enter any chord progression, press play, and flip
through 22 curated, named accompaniment patterns — the ones real pop pianists actually use —
while the loop keeps playing. Every pattern teaches itself: what each hand does, why it works,
where you'd use it, and which records to hear it on.

![Pop Piano Atlas](docs/screenshot.png)

## Try it

No build, no dependencies, no server logic — it's a static web app.

```bash
# any static server works:
python3 -m http.server 8000
# then open http://localhost:8000
```

Or open `dist/pop-piano-atlas.html` — the whole product in a single self-contained file.

## The ten-second loop

1. A progression is already loaded (`C | G | Am | F` — the axis of pop). Click any pattern card.
2. The loop starts and **never stops** — click other cards (or use **←/→**) and each swap lands
   cleanly on the next barline.
3. Found one you love? Slow it down, mute a hand, switch **Verse → Chorus** to hear it lifted,
   turn on the click, read the practice tip — then go play it. **↓ MIDI** exports exactly what
   you hear, left and right hands on separate tracks.

Type your own chords (`Bbmaj7 | Gm7 | Ebadd9 | F/A …`), or pick a preset like *Pachelbel's
Wheel* or *The Chromatic Drift*. Transpose with −/+. Roman numerals come free.

## What's in the atlas

| Group | Patterns |
|---|---|
| **Start Here** | Bedrock · Half-Note Pillars · Quarter Pulse · First Arpeggio · The Backbeat |
| **Ballads & Big Feelings** | The 1-5-8 Roll · Cascade 16ths · The Anchor · The Push |
| **Singer-Songwriter** | Folk Roll · Campfire Strum · The Pedal Point · Alberti Drift |
| **Pop & Rock Engines** | The Pump · Driving Octaves · The 3-3-2 · Stadium Octaves |
| **Groove & Soul** | The '50s Walk · Off-Beats Only · The Charleston Shuffle · Gospel Sus · 16th Snap |

Patterns are pure data (`js/patterns.js`): roles on a 16th-note grid, rendered over any chord
in any key by a voice-leading engine with pianistic constraints (hand span, registers, a
low-interval mud guard, per-chord pedal). Adding pattern #23 is a JSON contribution, not
an engineering project.

## Why it's shaped this way

Read [VISION.md](VISION.md) — the product thesis, including where this deliberately departs
from the original brainstorm (curation over combinatorics, technique names over artist names,
deterministic patterns over generative AI, one energy dial instead of a transform system).

## Development

```
js/theory.js     chord parsing · key & roman-numeral analysis · voicing engine
js/patterns.js   the atlas (data) + progression presets
js/engine.js     (progression × pattern × energy) → notes · scheduler · MIDI export
js/audio.js      synthesized piano · reverb · metronome (Web Audio, no samples)
js/ui.js         deck · keyboard viz · rhythm map · learn panel · transport
```

```bash
node tests/theory.test.js && node tests/engine.test.js   # unit tests
python3 tools/build_single.py                            # rebuild dist/pop-piano-atlas.html
```
