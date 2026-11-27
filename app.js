(async function () {
  const LANE_VARS = ['--lane-1', '--lane-2', '--lane-3', '--lane-4', '--lane-5', '--lane-6'];
  const ALBUM_TITLE = 'Cloudport Chronicles';
  const EYEBROW_PREFIX = 'RETRO COZY-GAME OST';
  const LOOP_STORAGE_KEY = 'cc96_loop_mode';
  const DEFAULT_TRACK_IDX = 0;

  const audio = document.getElementById('audio');
  const heroPlayBtn = document.getElementById('heroPlayBtn');
  const heroPlayIcon = document.getElementById('heroPlayIcon');
  const heroPauseIcon = document.getElementById('heroPauseIcon');
  const heroPlayLabel = document.getElementById('heroPlayLabel');
  const shareBtn = document.getElementById('shareBtn');
  const shareLabel = document.getElementById('shareLabel');
  const downloadCurrentBtn = document.getElementById('downloadCurrentBtn');
  const sceneBadge = document.getElementById('sceneBadge');
  const trackBlurb = document.getElementById('trackBlurb');
  const albumEyebrow = document.getElementById('albumEyebrow');
  const masterInfo = document.getElementById('masterInfo');

  const prevBtn = document.getElementById('prevBtn');
  const playBtn = document.getElementById('playBtn');
  const nextBtn = document.getElementById('nextBtn');
  const loopBtn = document.getElementById('loopBtn');
  const loopLabel = document.getElementById('loopLabel');
  const iconPlay = document.getElementById('iconPlay');
  const iconPause = document.getElementById('iconPause');
  const songTitle = document.getElementById('songTitle');
  const songMeta = document.getElementById('songMeta');
  const sectionBadge = document.getElementById('sectionBadge');
  const timeReadout = document.getElementById('timeReadout');
  const barReadout = document.getElementById('barReadout');
  const arrLabel = document.getElementById('arrLabel');
  const volSlider = document.getElementById('volSlider');
  const canvas = document.getElementById('waveCanvas');
  const hoverTime = document.getElementById('hoverTime');
  const pillsEl = document.getElementById('sectionPills');
  const lanesEl = document.getElementById('lanes');
  const trackListEl = document.getElementById('trackList');

  const res = await fetch('album-data.json');
  const ALBUM = await res.json();

  let activeIdx = DEFAULT_TRACK_IDX;
  const LOOP_MODES = ['off', 'album', 'song'];
  const LOOP_LABELS = { off: 'Loop: Off', album: 'Loop: Album', song: 'Loop: Song' };
  let loopMode = 'off';
  try {
    const savedLoop = localStorage.getItem(LOOP_STORAGE_KEY);
    if (LOOP_MODES.includes(savedLoop)) loopMode = savedLoop;
  } catch (_) {}

  const params = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  if (params.has('track')) {
    const n = Number(params.get('track')) - 1;
    if (n >= 0 && n < ALBUM.length) activeIdx = n;
  }

  let hoverFrac = null, pillButtons = [], rowEls = [], lanePlayhead = null;
  audio.volume = Number(volSlider.value);

  function cur() { return ALBUM[activeIdx]; }
  function bpbOf(s = cur()) { return s.beatsPerBar || 4; }
  function secPerBar(s = cur()) { return (bpbOf(s) / s.bpm) * 60; }
  function totalDur(s = cur()) { return Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : s.duration; }
  function fmtTime(sec) { const s = Math.max(0, Math.floor(sec)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; }

  const totalSec = ALBUM.reduce((sum, s) => sum + (s.duration || 0), 0);
  if (albumEyebrow) albumEyebrow.textContent = `${EYEBROW_PREFIX} · ${ALBUM.length} TRACKS · ${fmtTime(totalSec)}`;

  function currentSection(sec) {
    const s = cur(), bar = sec / secPerBar(s) + 1;
    for (let i = s.sections.length - 1; i >= 0; i--) if (bar >= s.sections[i].startBar) return s.sections[i];
    return s.sections[0];
  }
  function getToken(name, fallback) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback; }
  function updateHash() { history.replaceState(null, '', `#track=${activeIdx + 1}`); }

  rowEls = ALBUM.map((s, idx) => {
    const li = document.createElement('li');
    li.className = 'track-row';
    const meter = `${bpbOf(s)}/4`;
    li.innerHTML = `<span class="track-num">${String(idx + 1).padStart(2, '0')}</span><div class="track-info"><div class="track-name">${s.title}</div><div class="track-sub">${s.subtitle}</div></div><span class="track-meta">${s.bpm} BPM · ${meter} · ${s.key} · ${fmtTime(s.duration)}</span><a class="track-dl" href="${s.audio}" download="${s.downloadName}" title="Download ${s.title} MP3" aria-label="Download ${s.title} MP3"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg></a>`;
    li.querySelector('.track-dl').addEventListener('click', (e) => e.stopPropagation());
    li.addEventListener('click', () => { if (idx === activeIdx) togglePlay(); else selectTrack(idx, true); });
    trackListEl.appendChild(li);
    return li;
  });

  function updateMediaSession() {
    if (!('mediaSession' in navigator)) return;
    const s = cur();
    navigator.mediaSession.metadata = new MediaMetadata({
      title: s.title, artist: 'OpenBand · Surge XT', album: ALBUM_TITLE,
      artwork: [{ src: 'cover.jpg', sizes: '512x512', type: 'image/jpeg' }],
    });
    navigator.mediaSession.setActionHandler('previoustrack', () => selectTrack((activeIdx - 1 + ALBUM.length) % ALBUM.length, true));
    navigator.mediaSession.setActionHandler('nexttrack', () => selectTrack((activeIdx + 1) % ALBUM.length, true));
  }

  function selectTrack(idx, autoplay = false) {
    activeIdx = idx;
    const s = cur();
    document.documentElement.setAttribute('data-theme', s.theme || 'title');
    audio.src = s.audio;
    audio.load();
    songTitle.textContent = `${idx + 1}. ${s.title}`;
    songMeta.textContent = `${s.bpm} BPM · ${bpbOf(s)}/4 · Key ${s.key} · ${s.bars} bars`;
    sceneBadge.textContent = s.scene || s.subtitle.split(' · ')[0] || s.subtitle;
    trackBlurb.textContent = s.blurb;
    arrLabel.textContent = `Arrangement · ${s.tracks.length} native CLAP stems · ${s.bars} bars`;
    if (masterInfo) masterInfo.textContent = `${s.lufs} LUFS · Peak ${s.peakDb} dBFS`;
    downloadCurrentBtn.href = s.audio;
    downloadCurrentBtn.download = s.downloadName;
    rowEls.forEach((el, i) => el.classList.toggle('active', i === activeIdx));

    pillsEl.innerHTML = '';
    pillButtons = s.sections.map((sec) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'sec-pill';
      const t = (sec.startBar - 1) * secPerBar(s);
      btn.innerHTML = `${sec.name}<span>${fmtTime(t)}</span>`;
      btn.addEventListener('click', () => { audio.currentTime = Math.min(t, totalDur(s)); if (audio.paused) audio.play().catch(() => {}); render(); });
      pillsEl.appendChild(btn);
      return { section: sec, btn };
    });

    lanesEl.innerHTML = '';
    lanePlayhead = document.createElement('div');
    lanePlayhead.className = 'lane-playhead';
    lanePlayhead.style.left = '146px';
    s.tracks.forEach((tr, ti) => {
      const row = document.createElement('div');
      row.className = 'lane-row';
      const label = document.createElement('div');
      label.className = 'lane-label';
      label.textContent = tr.name;
      const bar = document.createElement('div');
      bar.className = 'lane-bar';
      tr.spans.forEach(([a, b]) => {
        const seg = document.createElement('div');
        seg.className = 'lane-seg';
        seg.style.left = `${((a - 1) / s.bars) * 100}%`;
        seg.style.width = `${((b - a) / s.bars) * 100}%`;
        seg.style.backgroundColor = `var(${LANE_VARS[ti % LANE_VARS.length]})`;
        bar.appendChild(seg);
      });
      bar.addEventListener('click', (ev) => {
        const rect = bar.getBoundingClientRect();
        audio.currentTime = Math.max(0, Math.min(1, (ev.clientX - rect.left) / rect.width)) * (s.bars * secPerBar(s));
        if (audio.paused) audio.play().catch(() => {});
        render();
      });
      row.appendChild(label);
      row.appendChild(bar);
      lanesEl.appendChild(row);
    });
    lanesEl.appendChild(lanePlayhead);

    updateHash();
    updateMediaSession();
    syncPlayUI();
    render();
    if (autoplay) audio.play().catch(() => {});
  }

  function drawWaveform() {
    const s = cur(), dpr = window.devicePixelRatio || 1, rect = canvas.getBoundingClientRect();
    const w = Math.max(1, Math.round(rect.width)), h = Math.max(1, Math.round(rect.height));
    if (canvas.width !== w * dpr || canvas.height !== h * dpr) { canvas.width = w * dpr; canvas.height = h * dpr; }
    const c = canvas.getContext('2d');
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, w, h);
    const dur = totalDur(s), prog = Math.max(0, Math.min(1, (audio.currentTime || 0) / dur));
    const accent = getToken('--accent', '#f6b25c'), muted = getToken('--muted', '#b6c2d6'), border = getToken('--border', 'rgba(255,255,255,0.14)');
    c.strokeStyle = border;
    c.lineWidth = 1;
    s.sections.slice(1).forEach((sec) => {
      const x = Math.round((((sec.startBar - 1) * secPerBar(s)) / dur) * w) + 0.5;
      c.beginPath(); c.moveTo(x, 4); c.lineTo(x, h - 4); c.stroke();
    });
    const peaks = s.peaks || [], step = peaks.length ? w / peaks.length : w, barW = Math.max(2, step * 0.65), midY = h / 2;
    for (let i = 0; i < peaks.length; i++) {
      const frac = (i + 0.5) / peaks.length, bh = Math.max(0.05, peaks[i]) * (h - 14), x = i * step + (step - barW) / 2;
      c.fillStyle = frac <= prog ? accent : muted;
      c.globalAlpha = frac <= prog ? 0.94 : 0.30;
      c.beginPath(); c.roundRect(x, midY - bh / 2, barW, bh, 2); c.fill();
    }
    c.globalAlpha = 1;
    if (hoverFrac !== null) {
      const hx = Math.round(hoverFrac * w) + 0.5;
      c.strokeStyle = muted; c.globalAlpha = 0.5; c.beginPath(); c.moveTo(hx, 2); c.lineTo(hx, h - 2); c.stroke(); c.globalAlpha = 1;
    }
    const px = Math.round(prog * w) + 0.5;
    c.strokeStyle = accent; c.lineWidth = 1.75; c.beginPath(); c.moveTo(px, 2); c.lineTo(px, h - 2); c.stroke();
  }

  function render() {
    const s = cur(), t = audio.currentTime || 0, dur = totalDur(s), bpb = bpbOf(s);
    timeReadout.textContent = `${fmtTime(t)} / ${fmtTime(dur)}`;
    const barFloat = Math.min(s.bars + 0.99, t / secPerBar(s) + 1), barNum = Math.floor(barFloat), beatNum = Math.floor((barFloat - barNum) * bpb) + 1;
    barReadout.textContent = `Bar ${Math.min(s.bars, barNum)}.${Math.min(bpb, beatNum)}`;
    const sec = currentSection(t);
    sectionBadge.textContent = sec.name;
    pillButtons.forEach(({ section, btn }) => btn.classList.toggle('active', section.name === sec.name));
    const firstBar = lanesEl.querySelector('.lane-bar');
    if (firstBar && lanePlayhead) lanePlayhead.style.left = `${firstBar.offsetLeft + Math.max(0, Math.min(1, t / (s.bars * secPerBar(s)))) * firstBar.clientWidth}px`;
    drawWaveform();
  }

  function syncPlayUI() {
    const playing = !audio.paused && !audio.ended;
    iconPlay.classList.toggle('hidden', playing); iconPause.classList.toggle('hidden', !playing);
    heroPlayIcon.classList.toggle('hidden', playing); heroPauseIcon.classList.toggle('hidden', !playing);
    heroPlayLabel.textContent = playing ? `Pause · Track ${activeIdx + 1}` : `Play Track ${activeIdx + 1}`;
  }
  function togglePlay() { if (audio.paused) audio.play().catch(() => {}); else audio.pause(); }
  function tick() { render(); if (!audio.paused && !audio.ended) requestAnimationFrame(tick); }

  function syncLoopUI() {
    audio.loop = loopMode === 'song';
    loopLabel.textContent = LOOP_LABELS[loopMode];
    loopBtn.classList.toggle('active', loopMode !== 'off');
    loopBtn.setAttribute('aria-pressed', loopMode !== 'off' ? 'true' : 'false');
    try { localStorage.setItem(LOOP_STORAGE_KEY, loopMode); } catch (_) {}
  }
  function cycleLoopMode() { loopMode = LOOP_MODES[(LOOP_MODES.indexOf(loopMode) + 1) % LOOP_MODES.length]; syncLoopUI(); }

  playBtn.addEventListener('click', togglePlay);
  heroPlayBtn.addEventListener('click', togglePlay);
  prevBtn.addEventListener('click', () => selectTrack((activeIdx - 1 + ALBUM.length) % ALBUM.length, !audio.paused));
  nextBtn.addEventListener('click', () => selectTrack((activeIdx + 1) % ALBUM.length, !audio.paused));
  loopBtn.addEventListener('click', cycleLoopMode);
  volSlider.addEventListener('input', () => { audio.volume = Number(volSlider.value); });

  shareBtn.addEventListener('click', async () => {
    const url = window.location.href;
    try { await navigator.clipboard.writeText(url); shareLabel.textContent = 'Link Copied!'; setTimeout(() => { shareLabel.textContent = 'Copy Link'; }, 1800); }
    catch { window.prompt('Copy album link:', url); }
  });

  function seekFromEvent(ev) { const rect = canvas.getBoundingClientRect(); audio.currentTime = Math.max(0, Math.min(1, (ev.clientX - rect.left) / rect.width)) * totalDur(); render(); }
  let dragging = false;
  canvas.addEventListener('pointerdown', (ev) => { dragging = true; canvas.setPointerCapture(ev.pointerId); seekFromEvent(ev); });
  canvas.addEventListener('pointermove', (ev) => {
    const rect = canvas.getBoundingClientRect();
    hoverFrac = Math.max(0, Math.min(1, (ev.clientX - rect.left) / rect.width));
    hoverTime.textContent = fmtTime(hoverFrac * totalDur());
    hoverTime.style.left = `${Math.max(4, Math.min(rect.width - 48, hoverFrac * rect.width - 20))}px`;
    hoverTime.classList.remove('hidden');
    if (dragging) seekFromEvent(ev); else drawWaveform();
  });
  canvas.addEventListener('pointerup', () => { dragging = false; });
  canvas.addEventListener('pointerleave', () => { dragging = false; hoverFrac = null; hoverTime.classList.add('hidden'); drawWaveform(); });

  audio.addEventListener('play', () => { syncPlayUI(); tick(); });
  audio.addEventListener('pause', () => { syncPlayUI(); render(); });
  audio.addEventListener('loadedmetadata', render);
  audio.addEventListener('ended', () => {
    if (loopMode === 'song') { audio.currentTime = 0; audio.play().catch(() => {}); }
    else if (activeIdx + 1 < ALBUM.length) selectTrack(activeIdx + 1, true);
    else if (loopMode === 'album') selectTrack(0, true);
    else { syncPlayUI(); render(); }
  });

  window.addEventListener('keydown', (e) => {
    if (e.target && ['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;
    if (e.code === 'Space') { e.preventDefault(); togglePlay(); }
    else if (e.key === 'l' || e.key === 'L') cycleLoopMode();
    else if (e.code === 'ArrowRight') { audio.currentTime = Math.min(totalDur(), (audio.currentTime || 0) + 5); render(); }
    else if (e.code === 'ArrowLeft') { audio.currentTime = Math.max(0, (audio.currentTime || 0) - 5); render(); }
    else if (e.key === 'n' || e.key === 'N') selectTrack((activeIdx + 1) % ALBUM.length, !audio.paused);
    else if (e.key === 'p' || e.key === 'P') selectTrack((activeIdx - 1 + ALBUM.length) % ALBUM.length, !audio.paused);
  });

  window.addEventListener('resize', render);
  syncLoopUI();
  selectTrack(activeIdx, false);
})();
