/**
 * GravitySynth Main Application Controller
 * Coordinates PhysicsWorld, AudioEngine, Renderer, Bilingual i18n (EN default + ZH toggle),
 * UI controls, Undo/Redo, URL sharing, Audio recording, and Local Gallery API.
 */

import { INSTRUMENTS, ROOT_NOTES, SCALES, midiToLabel } from './harmony.js';
import { PhysicsWorld, dist, genId } from './physics.js';
import { AudioEngine } from './audio.js';
import { Renderer } from './renderer.js';
import { PRESET_LIST, buildPreset, generateProceduralScene } from './presets.js';
import { serializeScene, encodeSceneToHash, decodeSceneFromHash } from './serializer.js';
import { detectInitialLang, getDict } from './i18n.js';

const PORTAL_COLORS = ['#22d3ee', '#a855f7', '#f43f5e', '#34d399', '#fbbf24'];

const appEl = document.getElementById('app');
const canvas = document.getElementById('stageCanvas');
const audioBanner = document.getElementById('audioBanner');
const startAudioBtn = document.getElementById('startAudioBtn');
const statOrbs = document.getElementById('statOrbs');
const statHits = document.getElementById('statHits');
const presetButtonsEl = document.getElementById('presetButtons');
const instrumentButtonsEl = document.getElementById('instrumentButtons');
const hintText = document.getElementById('hintText');
const toastEl = document.getElementById('toast');

const selectScale = document.getElementById('selectScale');
const selectRoot = document.getElementById('selectRoot');
const sliderBpm = document.getElementById('sliderBpm');
const valBpm = document.getElementById('valBpm');
const sliderTime = document.getElementById('sliderTime');
const valTime = document.getElementById('valTime');
const sliderReverb = document.getElementById('sliderReverb');
const valReverb = document.getElementById('valReverb');
const sliderDelay = document.getElementById('sliderDelay');
const valDelay = document.getElementById('valDelay');
const sliderVolume = document.getElementById('sliderVolume');
const valVolume = document.getElementById('valVolume');
const btnMute = document.getElementById('btnMute');
const btnPlayPause = document.getElementById('btnPlayPause');
const btnRecord = document.getElementById('btnRecord');
const btnSnapshot = document.getElementById('btnSnapshot');
const btnShare = document.getElementById('btnShare');
const btnStageMode = document.getElementById('btnStageMode');
const btnLang = document.getElementById('btnLang');
const exitStageBtn = document.getElementById('exitStageBtn');
const btnInspire = document.getElementById('btnInspire');
const btnGallery = document.getElementById('btnGallery');
const btnUndo = document.getElementById('btnUndo');
const btnClearOrbs = document.getElementById('btnClearOrbs');
const btnClearAll = document.getElementById('btnClearAll');
const btnToggleRack = document.getElementById('btnToggleRack');
const rackBody = document.getElementById('rackBody');
const gravityButtonsEl = document.getElementById('gravityButtons');

const galleryModal = document.getElementById('galleryModal');
const btnCloseGallery = document.getElementById('btnCloseGallery');
const savePresetForm = document.getElementById('savePresetForm');
const inputPresetName = document.getElementById('inputPresetName');
const inputPresetAuthor = document.getElementById('inputPresetAuthor');
const galleryList = document.getElementById('galleryList');

const world = new PhysicsWorld(window.innerWidth, window.innerHeight);
const audio = new AudioEngine();
const renderer = new Renderer(canvas);

let currentLang = detectInitialLang();
let isPlaying = true;
let audioUnlocked = false;
let currentTool = 'string';
let currentInstrument = 'crystal';
let currentPresetId = 'cyberpunk-rain';
let portalColorIndex = 0;
let bulletTimeSavedScale = null;
let undoStack = [];
let toastTimer = null;

const interaction = {
  isDrawing: false,
  tool: 'string',
  instrument: 'crystal',
  startX: 0,
  startY: 0,
  curX: 0,
  curY: 0,
  pendingPortal: null,
  draggingTarget: null,
  isErasingDrag: false,
};

function dict() {
  return getDict(currentLang);
}

function localizedName(item) {
  return currentLang === 'zh' && item.nameZh ? item.nameZh : item.name;
}

function localizedTag(item) {
  return currentLang === 'zh' && item.tagZh ? item.tagZh : item.tag;
}

function localizedMood(scale) {
  return currentLang === 'zh' && scale.moodZh ? scale.moodZh : scale.mood;
}

function showToast(msg, ms = 2400) {
  toastEl.textContent = msg;
  toastEl.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toastEl.classList.add('hidden');
  }, ms);
}

function unlockAudio() {
  if (audio.init()) {
    audioUnlocked = true;
    audioBanner.classList.add('hidden');
    audio.setReverbMix(world.settings.reverbMix);
    audio.setDelayMix(world.settings.delayMix);
    audio.setVolume(Number(sliderVolume.value));
  }
}

function pushUndoSnapshot() {
  undoStack.push(JSON.stringify(serializeScene(world)));
  if (undoStack.length > 35) undoStack.shift();
}

function undo() {
  if (undoStack.length === 0) {
    showToast(dict().toasts.noUndo);
    return;
  }
  const prev = JSON.parse(undoStack.pop());
  world.loadScene(prev);
  syncControlsFromWorld();
  showToast(dict().toasts.undone);
}

function renderDynamicLists() {
  // Preset chips
  presetButtonsEl.innerHTML = '';
  for (const p of PRESET_LIST) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `preset-chip${p.id === currentPresetId ? ' active' : ''}`;
    btn.dataset.preset = p.id;
    btn.textContent = localizedName(p);
    btn.title = `${localizedName(p)} — ${localizedTag(p)}`;
    btn.addEventListener('click', () => {
      unlockAudio();
      loadPresetById(p.id);
    });
    presetButtonsEl.appendChild(btn);
  }

  // Instrument swatches
  instrumentButtonsEl.innerHTML = '';
  for (const inst of Object.values(INSTRUMENTS)) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `inst-btn${inst.id === currentInstrument ? ' active' : ''}`;
    btn.dataset.inst = inst.id;
    btn.style.setProperty('--inst-color', inst.color);
    btn.innerHTML = `<span class="inst-dot"></span><span>${localizedName(inst)}</span>`;
    btn.addEventListener('click', () => {
      unlockAudio();
      setInstrument(inst.id);
    });
    instrumentButtonsEl.appendChild(btn);
  }

  // Scale & Root selects
  const prevScale = world.settings.scaleId;
  selectScale.innerHTML = '';
  for (const sc of Object.values(SCALES)) {
    const opt = document.createElement('option');
    opt.value = sc.id;
    opt.textContent = localizedName(sc);
    selectScale.appendChild(opt);
  }
  selectScale.value = prevScale;

  const prevRoot = String(world.settings.rootMidi);
  selectRoot.innerHTML = '';
  for (const rt of ROOT_NOTES) {
    const opt = document.createElement('option');
    opt.value = String(rt.midi);
    opt.textContent = `${rt.name}${dict().rootKeySuffix}`;
    selectRoot.appendChild(opt);
  }
  selectRoot.value = prevRoot;
}

function applyLanguage(lang, announce = false) {
  currentLang = lang === 'zh' ? 'zh' : 'en';
  document.documentElement.lang = currentLang === 'zh' ? 'zh-CN' : 'en';
  const d = dict();
  document.title = d.pageTitle;

  try {
    window.localStorage.setItem('gravity-synth-lang', currentLang);
  } catch {
    // ignore
  }

  for (const el of document.querySelectorAll('[data-i18n]')) {
    const key = el.dataset.i18n;
    if (typeof d[key] === 'string') {
      el.textContent = d[key];
    }
  }
  for (const el of document.querySelectorAll('[data-i18n-title]')) {
    const key = el.dataset.i18nTitle;
    if (typeof d[key] === 'string') {
      el.title = d[key];
    }
  }
  for (const el of document.querySelectorAll('[data-i18n-placeholder]')) {
    const key = el.dataset.i18nPlaceholder;
    if (typeof d[key] === 'string') {
      el.placeholder = d[key];
    }
  }

  btnMute.textContent = audio.muted ? d.btnMuteOff : d.btnMuteOn;
  btnRecord.textContent = audio.isRecording ? d.btnRecordStop : d.btnRecord;

  renderDynamicLists();
  hintText.textContent = d.hints[currentTool] || '';

  if (announce) {
    showToast(d.toasts.langSwitched);
  }
}

function syncControlsFromWorld() {
  selectScale.value = world.settings.scaleId;
  selectRoot.value = String(world.settings.rootMidi);
  sliderBpm.value = String(world.settings.bpm);
  valBpm.textContent = String(Math.round(world.settings.bpm));
  sliderTime.value = String(world.settings.timeScale);
  valTime.textContent = `${Number(world.settings.timeScale).toFixed(2)}x`;
  sliderReverb.value = String(world.settings.reverbMix);
  valReverb.textContent = `${Math.round(world.settings.reverbMix * 100)}%`;
  sliderDelay.value = String(world.settings.delayMix);
  valDelay.textContent = `${Math.round(world.settings.delayMix * 100)}%`;

  audio.setReverbMix(world.settings.reverbMix);
  audio.setDelayMix(world.settings.delayMix);

  const g = world.settings.gravity;
  for (const btn of gravityButtonsEl.querySelectorAll('.pill-btn')) {
    const btnG = Number(btn.dataset.gravity);
    btn.classList.toggle('active', Math.abs(btnG - g) < 40);
  }
}

function setTool(tool) {
  currentTool = tool;
  interaction.tool = tool;
  interaction.pendingPortal = null;
  for (const btn of document.querySelectorAll('.tool-btn')) {
    btn.classList.toggle('active', btn.dataset.tool === tool);
  }
  hintText.textContent = dict().hints[tool] || '';
  canvas.style.cursor = tool === 'move' ? 'grab' : tool === 'erase' ? 'not-allowed' : 'crosshair';
}

function setInstrument(instId) {
  currentInstrument = instId;
  interaction.instrument = instId;
  for (const btn of instrumentButtonsEl.querySelectorAll('.inst-btn')) {
    btn.classList.toggle('active', btn.dataset.inst === instId);
  }
}

function loadPresetById(id, silent = false) {
  if (!silent) pushUndoSnapshot();
  currentPresetId = id;
  const scene = buildPreset(id, world.width, world.height);
  world.loadScene(scene);
  syncControlsFromWorld();
  for (const chip of presetButtonsEl.querySelectorAll('.preset-chip')) {
    chip.classList.toggle('active', chip.dataset.preset === id);
  }
  const found = PRESET_LIST.find((p) => p.id === id);
  if (found && !silent) {
    showToast(dict().toasts.loadedPreset(localizedName(found), localizedTag(found)));
  }
}

function initUI() {
  // Language switch
  btnLang.addEventListener('click', () => {
    applyLanguage(currentLang === 'en' ? 'zh' : 'en', true);
  });

  // Tool dock clicks
  for (const btn of document.querySelectorAll('.tool-btn')) {
    btn.addEventListener('click', () => {
      unlockAudio();
      setTool(btn.dataset.tool);
    });
  }

  // Sound & Physics Controls
  selectScale.addEventListener('change', () => {
    world.settings.scaleId = selectScale.value;
    showToast(dict().toasts.scaleChanged(localizedName(SCALES[selectScale.value])));
  });
  selectRoot.addEventListener('change', () => {
    world.settings.rootMidi = Number(selectRoot.value);
  });
  sliderBpm.addEventListener('input', () => {
    world.settings.bpm = Number(sliderBpm.value);
    valBpm.textContent = String(world.settings.bpm);
  });
  sliderTime.addEventListener('input', () => {
    world.settings.timeScale = Number(sliderTime.value);
    valTime.textContent = `${world.settings.timeScale.toFixed(2)}x`;
  });
  sliderReverb.addEventListener('input', () => {
    world.settings.reverbMix = Number(sliderReverb.value);
    valReverb.textContent = `${Math.round(world.settings.reverbMix * 100)}%`;
    audio.setReverbMix(world.settings.reverbMix);
  });
  sliderDelay.addEventListener('input', () => {
    world.settings.delayMix = Number(sliderDelay.value);
    valDelay.textContent = `${Math.round(world.settings.delayMix * 100)}%`;
    audio.setDelayMix(world.settings.delayMix);
  });
  sliderVolume.addEventListener('input', () => {
    const v = Number(sliderVolume.value);
    valVolume.textContent = `${Math.round(v * 100)}%`;
    audio.setVolume(v);
  });
  btnMute.addEventListener('click', () => {
    unlockAudio();
    audio.setMuted(!audio.muted);
    btnMute.textContent = audio.muted ? dict().btnMuteOff : dict().btnMuteOn;
  });

  // Gravity preset pills
  for (const btn of gravityButtonsEl.querySelectorAll('.pill-btn')) {
    btn.addEventListener('click', () => {
      world.settings.gravity = Number(btn.dataset.gravity);
      syncControlsFromWorld();
    });
  }

  btnToggleRack.addEventListener('click', () => {
    const collapsed = rackBody.classList.toggle('collapsed');
    btnToggleRack.textContent = collapsed ? '▸' : '▾';
  });

  // Top Actions
  btnPlayPause.addEventListener('click', togglePlayPause);
  btnInspire.addEventListener('click', () => {
    unlockAudio();
    pushUndoSnapshot();
    currentPresetId = '';
    const scene = generateProceduralScene(world.width, world.height);
    world.loadScene(scene);
    syncControlsFromWorld();
    for (const chip of presetButtonsEl.querySelectorAll('.preset-chip')) {
      chip.classList.remove('active');
    }
    showToast(dict().toasts.inspired(localizedMood(SCALES[scene.settings.scaleId]), scene.settings.bpm));
  });

  btnUndo.addEventListener('click', undo);
  btnClearOrbs.addEventListener('click', () => {
    world.clearDynamic();
    showToast(dict().toasts.clearedOrbs);
  });
  btnClearAll.addEventListener('click', () => {
    pushUndoSnapshot();
    world.clearAll();
    showToast(dict().toasts.clearedAll);
  });

  // Record Web Audio
  btnRecord.addEventListener('click', () => {
    unlockAudio();
    if (!audio.isRecording) {
      const ok = audio.startRecording((blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `gravity-synth-${Date.now()}.webm`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 5000);
        btnRecord.classList.remove('recording');
        btnRecord.textContent = dict().btnRecord;
        showToast(dict().toasts.recordingSaved);
      });
      if (ok) {
        btnRecord.classList.add('recording');
        btnRecord.textContent = dict().btnRecordStop;
        showToast(dict().toasts.recordingStarted);
      } else {
        showToast(dict().toasts.recordingUnsupported);
      }
    } else {
      audio.stopRecording();
    }
  });

  // PNG Snapshot
  btnSnapshot.addEventListener('click', () => {
    const link = document.createElement('a');
    link.download = `gravity-synth-${Date.now()}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
    showToast(dict().toasts.snapshotSaved);
  });

  // URL Share
  btnShare.addEventListener('click', async () => {
    const hash = encodeSceneToHash(serializeScene(world));
    const shareUrl = `${window.location.origin}${window.location.pathname}${hash}`;
    window.history.replaceState(null, '', hash);
    try {
      await navigator.clipboard.writeText(shareUrl);
      showToast(dict().toasts.shareCopied);
    } catch {
      showToast(dict().toasts.shareHashUpdated);
    }
  });

  // Stage / Presentation Mode
  btnStageMode.addEventListener('click', () => toggleStageMode(true));
  exitStageBtn.addEventListener('click', () => toggleStageMode(false));

  // Audio Banner
  audioBanner.addEventListener('click', unlockAudio);
  startAudioBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    unlockAudio();
  });

  // Gallery Modal
  btnGallery.addEventListener('click', openGallery);
  btnCloseGallery.addEventListener('click', () => galleryModal.classList.add('hidden'));
  galleryModal.addEventListener('click', (e) => {
    if (e.target === galleryModal) galleryModal.classList.add('hidden');
  });
  savePresetForm.addEventListener('submit', handleSavePreset);
}

function togglePlayPause() {
  isPlaying = !isPlaying;
  btnPlayPause.textContent = isPlaying ? '⏸' : '▶';
  showToast(isPlaying ? dict().toasts.playing : dict().toasts.paused);
}

function toggleStageMode(forceVal) {
  const active = typeof forceVal === 'boolean' ? forceVal : !appEl.classList.contains('stage-mode');
  appEl.classList.toggle('stage-mode', active);
  exitStageBtn.classList.toggle('hidden', !active);
  if (active) showToast(dict().toasts.stageEntered, 1800);
}

const LOCAL_GALLERY_KEY = 'gravity-synth-local-gallery';

function readLocalGallery() {
  try {
    const raw = window.localStorage.getItem(LOCAL_GALLERY_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLocalGallery(items) {
  try {
    window.localStorage.setItem(LOCAL_GALLERY_KEY, JSON.stringify(items.slice(0, 30)));
  } catch {
    // ignore quota errors
  }
}

async function openGallery() {
  galleryModal.classList.remove('hidden');
  galleryList.innerHTML = `<div class="gallery-empty">${escapeHtml(dict().galleryLoading)}</div>`;
  try {
    const res = await fetch('/api/presets');
    if (!res.ok) throw new Error('API unavailable');
    const data = await res.json();
    renderGalleryList(data.presets || [], false);
  } catch {
    renderGalleryList(readLocalGallery(), true);
  }
}

function renderGalleryList(presets, useLocalStorage = false) {
  const d = dict();
  if (!presets.length) {
    galleryList.innerHTML = `<div class="gallery-empty">${escapeHtml(d.galleryEmpty)}</div>`;
    return;
  }
  galleryList.innerHTML = '';
  for (const item of presets) {
    const row = document.createElement('div');
    row.className = 'gallery-item';
    const locale = currentLang === 'zh' ? 'zh-CN' : 'en-US';
    const dateStr = new Date(item.createdAt).toLocaleString(locale, { hour12: false });
    row.innerHTML = `
      <div class="gallery-meta">
        <strong>${escapeHtml(item.name)}</strong>
        <span>by ${escapeHtml(item.author || 'Creator')} · ${dateStr}</span>
      </div>
      <div class="gallery-actions">
        <button class="btn btn-primary" data-action="load" type="button">${escapeHtml(d.galleryLoad)}</button>
        <button class="btn btn-ghost" data-action="delete" type="button">${escapeHtml(d.galleryDelete)}</button>
      </div>
    `;
    row.querySelector('[data-action="load"]').addEventListener('click', () => {
      unlockAudio();
      pushUndoSnapshot();
      world.loadScene(item.scene);
      syncControlsFromWorld();
      galleryModal.classList.add('hidden');
      showToast(dict().toasts.galleryLoaded(item.name));
    });
    row.querySelector('[data-action="delete"]').addEventListener('click', async () => {
      if (useLocalStorage) {
        writeLocalGallery(readLocalGallery().filter((p) => p.id !== item.id));
      } else {
        await fetch(`/api/presets/${encodeURIComponent(item.id)}`, { method: 'DELETE' }).catch(() => {});
      }
      openGallery();
    });
    galleryList.appendChild(row);
  }
}

async function handleSavePreset(e) {
  e.preventDefault();
  const name = inputPresetName.value.trim();
  if (!name) return;
  const author = inputPresetAuthor.value.trim() || 'Hackathon Creator';
  const scene = serializeScene(world);
  try {
    const res = await fetch('/api/presets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, author, scene }),
    });
    if (!res.ok) throw new Error('Save failed');
    inputPresetName.value = '';
    showToast(dict().toasts.gallerySaved(name));
    openGallery();
  } catch {
    const list = readLocalGallery();
    list.unshift({
      id: `local-${Date.now().toString(36)}`,
      name,
      author,
      createdAt: new Date().toISOString(),
      scene,
    });
    writeLocalGallery(list);
    inputPresetName.value = '';
    showToast(dict().toasts.gallerySaved(name));
    openGallery();
  }
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Canvas Pointer Interactions
function getPointerPos(e) {
  const rect = canvas.getBoundingClientRect();
  return { x: e.clientX - rect.left, y: e.clientY - rect.top };
}

canvas.addEventListener('contextmenu', (e) => e.preventDefault());

canvas.addEventListener('pointerdown', (e) => {
  unlockAudio();
  const pos = getPointerPos(e);
  interaction.startX = pos.x;
  interaction.startY = pos.y;
  interaction.curX = pos.x;
  interaction.curY = pos.y;

  // Right-click always erases immediately for fluid UX
  if (e.button === 2) {
    pushUndoSnapshot();
    world.eraseAt(pos.x, pos.y);
    interaction.isErasingDrag = true;
    return;
  }

  if (currentTool === 'erase') {
    pushUndoSnapshot();
    world.eraseAt(pos.x, pos.y);
    interaction.isErasingDrag = true;
    return;
  }

  if (currentTool === 'move') {
    const picked = world.pickAt(pos.x, pos.y);
    if (picked) {
      pushUndoSnapshot();
      interaction.draggingTarget = picked;
      canvas.style.cursor = 'grabbing';
    }
    return;
  }

  if (currentTool === 'well') {
    pushUndoSnapshot();
    const strength = e.shiftKey ? -95000 : 105000;
    world.addWell(pos.x, pos.y, strength);
    showToast(e.shiftKey ? dict().toasts.wellRepel : dict().toasts.wellAttract, 1400);
    return;
  }

  if (currentTool === 'prism') {
    pushUndoSnapshot();
    world.addPrism(pos.x, pos.y, { instrument: currentInstrument });
    return;
  }

  if (currentTool === 'portal') {
    if (!interaction.pendingPortal) {
      const color = PORTAL_COLORS[portalColorIndex % PORTAL_COLORS.length];
      portalColorIndex += 1;
      const pairId = genId('pair');
      pushUndoSnapshot();
      const first = world.addPortal(pos.x, pos.y, pairId, color, 12);
      interaction.pendingPortal = first;
      showToast(dict().toasts.portalFirst, 1800);
    } else {
      world.addPortal(
        pos.x,
        pos.y,
        interaction.pendingPortal.pairId,
        interaction.pendingPortal.color,
        12
      );
      interaction.pendingPortal = null;
      showToast(dict().toasts.portalPaired, 1400);
    }
    return;
  }

  // Drag-based tools: string, bumper, emitter, orb
  interaction.isDrawing = true;
  interaction.tool = currentTool;
  interaction.instrument = currentInstrument;
});

canvas.addEventListener('pointermove', (e) => {
  const pos = getPointerPos(e);
  interaction.curX = pos.x;
  interaction.curY = pos.y;

  if (interaction.isErasingDrag) {
    world.eraseAt(pos.x, pos.y, 24);
    return;
  }

  if (interaction.draggingTarget) {
    const { type, item, offsetX, offsetY } = interaction.draggingTarget;
    if (type === 'stringEnd1') {
      item.x1 = pos.x;
      item.y1 = pos.y;
    } else if (type === 'stringEnd2') {
      item.x2 = pos.x;
      item.y2 = pos.y;
    } else if (type === 'stringBody') {
      const dx = item.x2 - item.x1;
      const dy = item.y2 - item.y1;
      item.x1 = pos.x - offsetX;
      item.y1 = pos.y - offsetY;
      item.x2 = item.x1 + dx;
      item.y2 = item.y1 + dy;
    } else {
      item.x = pos.x;
      item.y = pos.y;
    }
  }
});

window.addEventListener('pointerup', () => {
  interaction.isErasingDrag = false;
  if (interaction.draggingTarget) {
    interaction.draggingTarget = null;
    canvas.style.cursor = currentTool === 'move' ? 'grab' : 'crosshair';
  }

  if (!interaction.isDrawing) return;
  interaction.isDrawing = false;

  const { tool, startX, startY, curX, curY, instrument } = interaction;
  const dragDist = dist(startX, startY, curX, curY);

  if (tool === 'string') {
    if (dragDist >= 22) {
      pushUndoSnapshot();
      world.addString(startX, startY, curX, curY, { instrument });
    }
  } else if (tool === 'bumper') {
    pushUndoSnapshot();
    const r = dragDist > 12 ? Math.max(14, Math.min(54, dragDist)) : 26;
    world.addBumper(startX, startY, r, { instrument });
  } else if (tool === 'emitter') {
    pushUndoSnapshot();
    const angle = dragDist > 10 ? Math.atan2(curY - startY, curX - startX) : Math.PI / 2;
    const speed = dragDist > 10 ? Math.max(110, Math.min(420, dragDist * 2.2)) : 200;
    world.addEmitter(startX, startY, { angle, speed, instrument, beatDiv: 1 });
  } else if (tool === 'orb') {
    const vx = dragDist > 8 ? (curX - startX) * 2.8 : (Math.random() - 0.5) * 60;
    const vy = dragDist > 8 ? (curY - startY) * 2.8 : 40;
    world.spawnOrb(startX, startY, vx, vy, { color: INSTRUMENTS[instrument]?.color || '#38bdf8' });
  }
});

// Keyboard Shortcuts
window.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') {
    return;
  }
  const key = e.key.toLowerCase();
  if ((e.metaKey || e.ctrlKey) && key === 'z') {
    e.preventDefault();
    undo();
    return;
  }
  if (key === '1') setTool('string');
  else if (key === '2') setTool('bumper');
  else if (key === '3') setTool('emitter');
  else if (key === '4') setTool('well');
  else if (key === '5') setTool('portal');
  else if (key === '6') setTool('prism');
  else if (key === '7') setTool('orb');
  else if (key === 'v') setTool('move');
  else if (key === 'e') setTool('erase');
  else if (key === 'p') togglePlayPause();
  else if (key === 'h') toggleStageMode();
  else if (key === ' ' && bulletTimeSavedScale === null) {
    e.preventDefault();
    bulletTimeSavedScale = world.settings.timeScale;
    world.settings.timeScale = 0.25;
    sliderTime.value = '0.25';
    valTime.textContent = '0.25x';
  }
});

window.addEventListener('keyup', (e) => {
  if (e.key === ' ' && bulletTimeSavedScale !== null) {
    world.settings.timeScale = bulletTimeSavedScale;
    sliderTime.value = String(bulletTimeSavedScale);
    valTime.textContent = `${bulletTimeSavedScale.toFixed(2)}x`;
    bulletTimeSavedScale = null;
  }
});

// Wire note trigger callback -> Web Audio + floating pitch tags
world.onTriggerNote = (ev) => {
  if (audioUnlocked) {
    audio.triggerNote(ev);
  }
  if (world.floatingNotes.length < 28) {
    world.floatingNotes.push({
      x: ev.x,
      y: ev.y - 8,
      label: ev.instrument === 'drum' ? '●' : midiToLabel(ev.midi),
      color: ev.color,
      alpha: 0.95,
    });
  }
};

// Responsive Resize
function handleResize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  world.resize(w, h);
  renderer.resize(w, h);
}
window.addEventListener('resize', handleResize);

// Bootstrap
initUI();
handleResize();
applyLanguage(currentLang, false);

// Check URL hash first; otherwise load flagship Cyberpunk Rain preset
const sharedScene = decodeSceneFromHash(window.location.hash);
if (sharedScene) {
  world.loadScene(sharedScene);
  syncControlsFromWorld();
  showToast(dict().toasts.sharedLoaded);
} else {
  loadPresetById(currentPresetId, true);
}

// Main 60fps Animation Loop
let lastTs = performance.now();
let uiStatAccum = 0;

function frame(ts) {
  const dt = Math.min(0.05, (ts - lastTs) / 1000);
  lastTs = ts;

  if (isPlaying) {
    world.step(dt);
  }

  renderer.render(world, audio, interaction, ts / 1000);

  uiStatAccum += dt;
  if (uiStatAccum >= 0.12) {
    uiStatAccum = 0;
    statOrbs.textContent = String(world.orbs.length);
    statHits.textContent = String(world.totalHits);
  }

  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
