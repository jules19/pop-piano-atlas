/* Pop Piano Atlas — UI wiring: deck, stage, keyboard viz, rhythm map, transport. */
(function () {
  'use strict';

  const T = window.Theory;
  const A = window.Atlas;
  const R = window.Arrangements;
  const E = window.Engine;

  const $ = (id) => document.getElementById(id);

  const player = E.createPlayer(() => window.AudioOut);

  const PATTERN_BY_ID = Object.fromEntries(A.PATTERNS.map((p) => [p.id, p]));

  let currentPattern = null; // the pattern the UI is presenting (may be queued)
  let currentArrangement = null; // active full arrangement (null = manual pattern mode)
  let currentPresetId = 'axis';

  // ------------------------------------------------------------------ deck

  const cardEls = {};

  function glyphRow(events, cls) {
    const row = document.createElement('div');
    row.className = 'glyph-row ' + cls;
    for (const ev of events) {
      const span = document.createElement('span');
      const s = Math.min(ev.s, 15.5);
      const d = Math.max(0.8, Math.min(ev.d, 16 - s));
      span.style.left = (s / 16) * 100 + '%';
      span.style.width = (d / 16) * 100 + '%';
      span.style.opacity = String(0.4 + (ev.v != null ? ev.v : 0.7) * 0.6);
      row.appendChild(span);
    }
    return row;
  }

  function buildDeck() {
    const deck = $('deck');
    for (const group of A.GROUPS) {
      const head = document.createElement('div');
      head.className = 'group-head';
      head.innerHTML = `<h2>${group.name}</h2><p>${group.blurb}</p>`;
      deck.appendChild(head);
      for (const p of A.PATTERNS.filter((x) => x.group === group.id)) {
        const card = document.createElement('button');
        card.className = 'card';
        card.setAttribute('aria-label', p.name);
        const dots = '●'.repeat(p.difficulty) + '○'.repeat(3 - p.difficulty);
        card.innerHTML = `
          <div class="card-top">
            <span class="card-name">${p.name}</span>
            ${p.feel === 'swing' ? '<span class="badge swing">swing</span>' : ''}
            <span class="card-dots"><span class="f">${'●'.repeat(p.difficulty)}</span>${'○'.repeat(3 - p.difficulty)}</span>
          </div>
          <div class="card-tag">${p.tag}</div>`;
        const glyph = document.createElement('div');
        glyph.className = 'card-glyph';
        glyph.appendChild(glyphRow(p.rh, 'rh'));
        glyph.appendChild(glyphRow(p.lh, 'lh'));
        card.appendChild(glyph);
        card.addEventListener('click', () => selectPattern(p, true));
        deck.appendChild(card);
        cardEls[p.id] = card;
      }
    }
  }

  function markCards() {
    const queued = player.state.pendingPattern;
    const active = player.state.pattern;
    for (const p of A.PATTERNS) {
      const el = cardEls[p.id];
      el.classList.toggle('selected', !!active && active.id === p.id && !queued);
      el.classList.toggle('queued', !!queued && queued.id === p.id);
      if (!queued && active && active.id === p.id) el.classList.add('selected');
    }
    if (queued) cardEls[queued.id].classList.add('queued');
  }

  function selectPattern(p, autoplay) {
    if (currentArrangement) exitArrangement();
    currentPattern = p;
    player.setPattern(p);
    // when idle, adopt the pattern's natural tempo so it always auditions at a musical speed
    if (!player.state.playing && p.bpm) {
      player.state.bpm = p.bpm;
      $('tempo').value = p.bpm;
      $('bpm').textContent = p.bpm + ' bpm';
    }
    markCards();
    renderStage(p);
    if (autoplay && !player.state.playing) startPlayback();
    if (!player.state.playing) previewOnKeyboard(p);
  }

  /** When stopped: light the pattern's beat-1 notes so the hand shapes are visible before play. */
  function previewOnKeyboard(p) {
    for (const m in keyEls) keyEls[m].classList.remove('lit-lh', 'lit-rh');
    const ctx = player.state.ctxData;
    if (!ctx) return;
    const events = E.renderBar(ctx, p, 0, player.state.energy);
    $('kbd').classList.add('preview');
    const notes = { lh: new Set(), rh: new Set() };
    for (const ev of events) {
      if (ev.step >= 4) continue; // first beat only
      for (const m of ev.midis) {
        if (keyEls[m]) keyEls[m].classList.add(ev.hand === 'lh' ? 'lit-lh' : 'lit-rh');
        notes[ev.hand].add(m);
      }
    }
    const names = (set) => [...set].sort((a, b) => a - b).map(T.midiToName).join(' ');
    const chord = ctx.segments[0].chord;
    // name the inversion so a voice-led voicing (e.g. D-G-B for G) reads as intentional
    const rhSorted = [...notes.rh].sort((a, b) => a - b);
    let inv = '';
    if (rhSorted.length >= 3) {
      const rel = ((rhSorted[0] % 12) - chord.rootPc + 12) % 12;
      inv = rel === 0 ? 'root position' : rel === 3 || rel === 4 ? '1st inversion' : rel === 6 || rel === 7 ? '2nd inversion' : '';
    }
    const el = $('under-fingers');
    el.innerHTML =
      `beat 1 of ${chord.symbol}: <b class="l">${names(notes.lh) || '—'}</b> · <b class="r">${names(notes.rh) || '—'}</b>` +
      (inv ? ` <span class="inv">(${inv})</span>` : '');
    el.title = 'The Atlas voices each chord as close as possible to the previous one — smooth voice leading. That is why you often get inversions instead of root position.';
  }

  // ------------------------------------------------------------------ arrangements

  const arrCardEls = {};
  const sectionChipEls = []; // chips for the active arrangement's sections

  function buildArrangements() {
    const wrap = $('arr-cards');
    for (const arr of R.ARRANGEMENTS) {
      const card = document.createElement('button');
      card.className = 'arr-card';
      card.innerHTML = `
        <div class="arr-name">${arr.name}</div>
        <div class="arr-influence">${arr.influence}</div>
        <div class="arr-blurb">${arr.blurb}</div>
        <div class="arr-sections">${arr.sections.map((s) => s.name).join(' → ')}</div>`;
      card.addEventListener('click', () => selectArrangement(arr));
      wrap.appendChild(card);
      arrCardEls[arr.id] = card;
    }
  }

  function markArrCards() {
    for (const arr of R.ARRANGEMENTS) {
      arrCardEls[arr.id].classList.toggle('selected', !!currentArrangement && currentArrangement.id === arr.id);
    }
  }

  function renderTimelineChips(arr) {
    const tl = $('arr-timeline');
    tl.innerHTML = '';
    sectionChipEls.length = 0;
    arr.sections.forEach((sec, i) => {
      const chip = document.createElement('div');
      chip.className = 'sec-chip';
      const pat = PATTERN_BY_ID[sec.pattern];
      chip.innerHTML = `<span class="sec-name">${sec.name}</span><span class="sec-pat">${pat.name}</span><span class="sec-energy">${'▮'.repeat(sec.energy)}${'▯'.repeat(5 - sec.energy)}</span>`;
      tl.appendChild(chip);
      sectionChipEls.push(chip);
      if (i < arr.sections.length - 1) {
        const arrow = document.createElement('span');
        arrow.className = 'sec-arrow';
        arrow.textContent = sec.fill ? '⤳' : '→';
        arrow.title = sec.fill ? `fill: ${sec.fill}` : '';
        tl.appendChild(arrow);
      }
    });
    tl.hidden = false;
  }

  function selectArrangement(arr) {
    currentArrangement = arr;
    const timeline = player.setArrangement(arr, PATTERN_BY_ID);
    if (!timeline) return;
    player.state.bpm = arr.bpm;
    $('tempo').value = arr.bpm;
    $('bpm').textContent = arr.bpm + ' bpm';
    $('energy').classList.add('disabled');
    renderTimelineChips(arr);
    markArrCards();
    currentPattern = player.state.pattern;
    markCards();
    renderStage(currentPattern);
    if (!player.state.playing) startPlayback();
  }

  function exitArrangement() {
    currentArrangement = null;
    player.clearArrangement();
    $('arr-timeline').hidden = true;
    $('energy').classList.remove('disabled');
    sectionChipEls.length = 0;
    markArrCards();
  }

  function highlightSection(idx) {
    sectionChipEls.forEach((chip, i) => chip.classList.toggle('now', i === idx));
    if (currentArrangement && idx != null && currentArrangement.sections[idx]) {
      const energy = String(currentArrangement.sections[idx].energy);
      $('energy')
        .querySelectorAll('button')
        .forEach((b) => b.classList.toggle('on', b.dataset.v === energy));
    }
  }

  // ------------------------------------------------------------------ stage: header + learn

  function renderStage(p) {
    $('pat-name').textContent = p.name;
    $('pat-tag').textContent = p.tag;
    const meta = $('pat-meta');
    meta.innerHTML = '';
    const bits = [];
    bits.push(`<span class="badge">difficulty ${'●'.repeat(p.difficulty)}${'○'.repeat(3 - p.difficulty)}</span>`);
    bits.push(`<span class="badge">energy ${p.energy}/5</span>`);
    if (p.bpm) bits.push(`<span class="badge">feels best ~${p.bpm} bpm</span>`);
    if (p.feel === 'swing') bits.push('<span class="badge swing">swing 8ths</span>');
    if (p.color) bits.push(`<span class="badge">${p.color} colour</span>`);
    if (p.pedal === 'chord') bits.push('<span class="badge">pedal per chord</span>');
    meta.innerHTML = bits.join('');

    $('how-lh').textContent = p.how.lh;
    $('how-rh').textContent = p.how.rh;
    $('why').textContent = p.why;
    $('use').textContent = p.use;
    $('songs').innerHTML = p.songs.map((s) => `<li>${s}</li>`).join('');
    $('tip').textContent = p.tip;
    renderRhythmMap(p);
  }

  // ------------------------------------------------------------------ rhythm map

  function renderRhythmMap(p) {
    for (const hand of ['rh', 'lh']) {
      const lane = $('lane-' + hand);
      lane.innerHTML = '';
      for (let b = 1; b < 16; b++) {
        const line = document.createElement('div');
        line.className = 'beatline' + (b % 4 === 0 ? ' strong' : '');
        line.style.left = (b / 16) * 100 + '%';
        lane.appendChild(line);
      }
      for (const ev of p[hand]) {
        const hit = document.createElement('div');
        hit.className = 'hit ' + hand;
        const s = ev.s + (p.feel === 'swing' && ev.s % 4 === 2 ? 0.66 : 0);
        const d = Math.max(0.7, Math.min(ev.d, 16 - s));
        hit.style.left = (s / 16) * 100 + '%';
        hit.style.width = (d / 16) * 100 + '%';
        hit.style.opacity = String(0.45 + (ev.v != null ? ev.v : 0.7) * 0.55);
        lane.appendChild(hit);
      }
    }
    const count = $('rmap-count');
    count.innerHTML = '';
    const labels = ['1', 'e', '&', 'a', '2', 'e', '&', 'a', '3', 'e', '&', 'a', '4', 'e', '&', 'a'];
    labels.forEach((l, i) => {
      const s = document.createElement('span');
      s.textContent = l;
      if (i % 4 === 0) s.className = 'b';
      count.appendChild(s);
    });
    $('rmap-note').textContent =
      p.feel === 'swing' ? 'off-beats swing late — the grid shows where they actually land' : 'block length = how long the note is held';
  }

  // ------------------------------------------------------------------ keyboard viz

  const KEY_LO = 33; // A1
  const KEY_HI = 96; // C7
  const WHITE_PCS = [0, 2, 4, 5, 7, 9, 11];
  const keyEls = {};

  function buildKeyboard() {
    const svg = $('kbd');
    svg.removeAttribute('preserveAspectRatio');
    const whites = [];
    for (let m = KEY_LO; m <= KEY_HI; m++) if (WHITE_PCS.includes(m % 12)) whites.push(m);
    const W = 20;
    const width = whites.length * W;
    const height = 96;
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    const xOfWhite = {};
    whites.forEach((m, i) => (xOfWhite[m] = i * W));
    // white keys first
    for (const m of whites) {
      const r = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      r.setAttribute('x', xOfWhite[m]);
      r.setAttribute('y', 0);
      r.setAttribute('width', W);
      r.setAttribute('height', height);
      r.setAttribute('rx', 1.5);
      r.setAttribute('class', 'white');
      svg.appendChild(r);
      keyEls[m] = r;
    }
    // black keys on top
    for (let m = KEY_LO; m <= KEY_HI; m++) {
      if (WHITE_PCS.includes(m % 12)) continue;
      const below = m - 1; // white key below
      const x = xOfWhite[below] + W * 0.64;
      const r = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      r.setAttribute('x', x);
      r.setAttribute('y', 0);
      r.setAttribute('width', W * 0.62);
      r.setAttribute('height', height * 0.6);
      r.setAttribute('rx', 1.5);
      r.setAttribute('class', 'black');
      svg.appendChild(r);
      keyEls[m] = r;
    }
    // middle C marker
    const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    dot.setAttribute('cx', xOfWhite[60] + W / 2);
    dot.setAttribute('cy', height - 8);
    dot.setAttribute('r', 2.4);
    dot.setAttribute('fill', '#b8b0a0');
    svg.appendChild(dot);
  }

  // ------------------------------------------------------------------ progression strip

  function renderBars(ctx) {
    const wrap = $('bars');
    wrap.innerHTML = '';
    ctx.bars.forEach((chords, i) => {
      const chip = document.createElement('div');
      chip.className = 'bar-chip';
      chip.dataset.bar = i;
      const sym = chords.map((c) => c.symbol).join('  ');
      const segIdx = ctx.segments.findIndex((s) => s.bar === i);
      const rns = ctx.segments.filter((s) => s.bar === i).map((s, j) => ctx.romans[segIdx + j]);
      chip.innerHTML = `<div class="sym">${sym}</div><div class="rn">${rns.join(' · ')}</div>`;
      wrap.appendChild(chip);
    });
    $('keybadge').innerHTML = `key of <b>${T.keyName(ctx.tonic)}</b>`;
  }

  function applyProgression(text, fromPreset) {
    const input = $('prog');
    const hint = $('proghint');
    const res = player.setSong(text);
    if (!res.ok) {
      input.classList.add('invalid');
      hint.textContent = res.error;
      hint.classList.add('error');
      return false;
    }
    input.classList.remove('invalid');
    hint.classList.remove('error');
    hint.textContent = fromPreset
      ? A.PRESETS.find((p) => p.id === currentPresetId)?.note || ''
      : 'Type any chords — triads, m7, sus2/4, add9, slash bass like G/B — then press Enter.';
    renderBars(res);
    if (!player.state.playing && currentPattern) previewOnKeyboard(currentPattern);
    return true;
  }

  function buildPresets() {
    const sel = $('preset');
    for (const p of A.PRESETS) {
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = p.name;
      sel.appendChild(opt);
    }
    const custom = document.createElement('option');
    custom.value = '_custom';
    custom.textContent = 'Custom…';
    sel.appendChild(custom);
    sel.addEventListener('change', () => {
      const p = A.PRESETS.find((x) => x.id === sel.value);
      if (!p) return;
      currentPresetId = p.id;
      $('prog').value = p.text;
      applyProgression(p.text, true);
    });
  }

  function transpose(semis) {
    const input = $('prog');
    const parts = input.value.split('|').map((cell) =>
      cell
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .map((tok) => T.transposeSymbol(tok, semis))
        .join(' ')
    );
    const text = parts.filter((p) => p.length).join(' | ');
    input.value = text;
    $('preset').value = '_custom';
    currentPresetId = '_custom';
    applyProgression(text, false);
  }

  // ------------------------------------------------------------------ transport

  function startPlayback() {
    $('under-fingers').textContent = '';
    $('kbd').classList.remove('preview');
    for (const m in keyEls) keyEls[m].classList.remove('lit-lh', 'lit-rh');
    player.play();
    $('play').classList.add('playing');
    $('play-icon').setAttribute('d', 'M3 3h4v10H3zM9 3h4v10H9z');
  }

  function stopPlayback() {
    player.stop();
    $('play').classList.remove('playing');
    $('play-icon').setAttribute('d', 'M4 2l10 6-10 6z');
    document.querySelectorAll('.bar-chip.now').forEach((el) => el.classList.remove('now'));
    $('rmap-ph').style.opacity = '0';
    markCards();
    if (currentPattern) previewOnKeyboard(currentPattern);
  }

  function wireTransport() {
    $('play').addEventListener('click', () => (player.state.playing ? stopPlayback() : startPlayback()));

    $('tempo').addEventListener('input', (e) => {
      player.state.bpm = +e.target.value;
      $('bpm').textContent = e.target.value + ' bpm';
    });

    for (const [segId, key] of [['energy', 'energy'], ['colour', 'colour'], ['hands', 'hands']]) {
      $(segId).addEventListener('click', (e) => {
        const btn = e.target.closest('button');
        if (!btn) return;
        if (segId === 'energy' && currentArrangement) return; // sections conduct the energy
        player.state[key] = btn.dataset.v;
        $(segId).querySelectorAll('button').forEach((b) => b.classList.toggle('on', b === btn));
        if (segId === 'energy' && !player.state.playing && currentPattern) previewOnKeyboard(currentPattern);
      });
    }

    $('metro').addEventListener('click', () => {
      player.state.metronome = !player.state.metronome;
      $('metro').classList.toggle('on', player.state.metronome);
    });
    $('countin').addEventListener('click', () => {
      player.state.countIn = !player.state.countIn;
      $('countin').classList.toggle('on', player.state.countIn);
    });

    $('midi').addEventListener('click', () => {
      if (!player.state.ctxData) return;
      const song = currentPresetId === '_custom' ? 'custom' : currentPresetId;
      let bytes, name;
      if (currentArrangement && player.state.timeline) {
        bytes = E.exportArrangementMidi(player.state.ctxData, player.state.timeline, player.state.bpm, player.state.colour);
        name = `atlas-${song}-${currentArrangement.id}.mid`;
      } else {
        const pat = player.state.pendingPattern || player.state.pattern;
        if (!pat) return;
        bytes = E.exportMidi(player.state.ctxData, pat, player.state.energy, player.state.bpm, player.state.colour);
        name = `atlas-${song}-${pat.id}.mid`;
      }
      const blob = new Blob([bytes], { type: 'audio/midi' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    });

    const prog = $('prog');
    prog.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        $('preset').value = '_custom';
        currentPresetId = '_custom';
        applyProgression(prog.value, false);
        prog.blur();
      }
    });
    $('tr-up').addEventListener('click', () => transpose(1));
    $('tr-down').addEventListener('click', () => transpose(-1));

    document.addEventListener('keydown', (e) => {
      const tag = document.activeElement && document.activeElement.tagName;
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
      if (e.code === 'Space') {
        e.preventDefault();
        player.state.playing ? stopPlayback() : startPlayback();
      } else if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        e.preventDefault();
        const dir = e.key === 'ArrowRight' ? 1 : -1;
        const idx = A.PATTERNS.findIndex((p) => p.id === (currentPattern ? currentPattern.id : ''));
        const next = A.PATTERNS[(idx + dir + A.PATTERNS.length) % A.PATTERNS.length];
        selectPattern(next, false);
        cardEls[next.id].scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    });
  }

  // ------------------------------------------------------------------ animation loop

  function animate() {
    const audio = window.AudioOut;
    if (player.state.playing && audio) {
      const now = audio.now();
      // keyboard lights
      const lit = {};
      for (const v of player.state.viz) {
        if (v.tOn <= now && now < v.tOff) lit[v.midi] = v.hand;
      }
      for (const m in keyEls) {
        const el = keyEls[m];
        const h = lit[m];
        el.classList.toggle('lit-lh', h === 'lh');
        el.classList.toggle('lit-rh', h === 'rh');
      }
      // current beat → bar chip + playhead
      let cur = null;
      for (const b of player.state.beats) if (b.t <= now) cur = b;
      if (cur && cur.sectionIdx != null) highlightSection(cur.sectionIdx);
      if (cur && cur.bar >= 0) {
        document.querySelectorAll('.bar-chip').forEach((el) => {
          el.classList.toggle('now', +el.dataset.bar === cur.bar);
        });
        const beatDur = 60 / player.state.bpm;
        const frac = Math.min(1, (now - cur.t) / beatDur);
        const pos = (cur.beat + frac) / 4;
        const lane = $('lane-rh');
        const rmap = $('rmap');
        const laneBox = lane.getBoundingClientRect();
        const rmapBox = rmap.getBoundingClientRect();
        const ph = $('rmap-ph');
        ph.style.opacity = '0.5';
        ph.style.left = laneBox.left - rmapBox.left + pos * laneBox.width + 'px';
      }
    }
    requestAnimationFrame(animate);
  }

  // ------------------------------------------------------------------ init

  player.on('swap', (p) => {
    markCards();
    if (currentArrangement && p) {
      // the arrangement is conducting: keep the stage teaching whatever is sounding
      currentPattern = p;
      renderStage(p);
    }
  });
  player.on('stop', () => {
    markCards();
    sectionChipEls.forEach((chip) => chip.classList.remove('now'));
  });

  buildDeck();
  buildArrangements();
  buildPresets();
  buildKeyboard();
  wireTransport();

  $('preset').value = 'axis';
  $('prog').value = A.PRESETS[0].text;
  applyProgression(A.PRESETS[0].text, true);
  selectPattern(A.PATTERNS[0], false);
  requestAnimationFrame(animate);
})();
