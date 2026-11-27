import test from 'node:test';
import assert from 'node:assert/strict';

import { midiToFreq, midiToLabel, lengthToMidi, radiusToMidi, SCALES, INSTRUMENTS } from '../public/src/harmony.js';
import { PhysicsWorld } from '../public/src/physics.js';
import { serializeScene, encodeSceneToHash, decodeSceneFromHash } from '../public/src/serializer.js';
import { PRESET_LIST, buildPreset, generateProceduralScene } from '../public/src/presets.js';
import { detectInitialLang, getDict, TRANSLATIONS } from '../public/src/i18n.js';
import { handleRequest } from '../server.mjs';

test('harmony engine computes accurate pitch frequencies and scale quantization', () => {
  assert.ok(Math.abs(midiToFreq(69) - 440) < 0.001, 'A4 (MIDI 69) should be 440Hz');
  assert.equal(midiToLabel(60), 'C4');

  // Shorter strings produce higher MIDI notes than longer strings
  const shortNote = lengthToMidi(60, 'pentatonic', 48);
  const longNote = lengthToMidi(340, 'pentatonic', 48);
  assert.ok(shortNote > longNote, 'Shorter string should map to higher pitch');

  // Every generated note belongs to the selected scale's pitch classes
  const scaleIntervals = new Set(SCALES.hirajoshi.intervals);
  for (let len = 50; len <= 360; len += 25) {
    const midi = lengthToMidi(len, 'hirajoshi', 48);
    assert.ok(scaleIntervals.has((midi - 48) % 12), `Note ${midi} must be in Hirajoshi scale`);
  }

  const smallBumper = radiusToMidi(16, 'cyberpunk', 48);
  const bigBumper = radiusToMidi(50, 'cyberpunk', 48);
  assert.ok(smallBumper > bigBumper, 'Smaller bumper should map to higher pitch');
});

test('physics world triggers string collision, bumper bounce, portal teleport, and prism split', () => {
  const world = new PhysicsWorld(1000, 700);
  world.settings.gravity = 0;

  const triggered = [];
  world.onTriggerNote = (ev) => triggered.push(ev);

  // 1. String collision
  world.addString(200, 300, 400, 300, { instrument: 'pluck' });
  const orb = world.spawnOrb(300, 270, 0, 240);
  for (let i = 0; i < 20; i++) world.step(0.016);
  assert.ok(orb.vy < 0, 'Orb should bounce upward off horizontal string');
  assert.ok(triggered.length >= 1, 'String collision should trigger note event');
  assert.equal(triggered[0].instrument, 'pluck');

  // 2. Wormhole portal teleportation
  world.clearAll();
  world.addPortal(200, 200, 'p1', '#22d3ee', 12);
  world.addPortal(700, 500, 'p1', '#22d3ee', 12);
  const pOrb = world.spawnOrb(170, 200, 200, 0);
  for (let i = 0; i < 15; i++) world.step(0.016);
  assert.ok(pOrb.x > 650 && pOrb.y > 450, 'Orb should teleport to partner portal');
  assert.equal(pOrb.pitchOffset, 12, 'Portal should apply octave pitch shift');

  // 3. Prism harmonic splitter
  world.clearAll();
  world.addPrism(400, 300, { instrument: 'crystal' });
  world.spawnOrb(350, 300, 220, 0);
  for (let i = 0; i < 20; i++) world.step(0.016);
  assert.ok(world.orbs.length >= 2, 'Prism should split orb into a harmonic pair');
});

test('scene serialization and URL hash encoding roundtrip cleanly', () => {
  const scene = buildPreset('cyberpunk-rain', 1280, 720);
  const world = new PhysicsWorld(1280, 720);
  world.loadScene(scene);

  const serialized = serializeScene(world);
  const hash = encodeSceneToHash(serialized);
  assert.ok(hash.startsWith('#scene='));

  const decoded = decodeSceneFromHash(hash);
  assert.ok(decoded);
  assert.equal(decoded.settings.scaleId, 'cyberpunk');
  assert.equal(decoded.strings.length, world.strings.length);
  assert.equal(decoded.portals.length, world.portals.length);
});

test('all curated presets and procedural generator produce valid scenes', () => {
  for (const meta of PRESET_LIST) {
    const scene = buildPreset(meta.id, 1200, 700);
    assert.ok(scene.emitters.length >= 1, `${meta.id} should have emitters`);
    assert.ok(scene.strings.length + scene.bumpers.length >= 3, `${meta.id} should have instruments`);
  }

  for (let i = 0; i < 5; i++) {
    const generated = generateProceduralScene(1200, 700);
    assert.ok(generated.emitters.length >= 1);
    assert.ok(generated.strings.length >= 3);
    assert.ok(SCALES[generated.settings.scaleId]);
  }
});

async function invokeHandler(method, urlPath, bodyObj = null) {
  const chunks = bodyObj ? [Buffer.from(JSON.stringify(bodyObj))] : [];
  const req = {
    method,
    url: urlPath,
    headers: { host: '127.0.0.1:3456' },
    async *[Symbol.asyncIterator]() {
      for (const c of chunks) yield c;
    },
  };
  let statusCode = 200;
  let headers = {};
  let body = '';
  const res = {
    writeHead(code, hdrs = {}) {
      statusCode = code;
      headers = hdrs;
    },
    end(payload = '') {
      body = Buffer.isBuffer(payload) ? payload.toString('utf8') : String(payload);
    },
  };
  await handleRequest(req, res);
  return { statusCode, headers, body };
}

test('HTTP server handler serves app and persists gallery presets', async () => {
  const healthRes = await invokeHandler('GET', '/api/health');
  assert.equal(healthRes.statusCode, 200);
  assert.equal(JSON.parse(healthRes.body).status, 'ok');

  const htmlRes = await invokeHandler('GET', '/');
  assert.equal(htmlRes.statusCode, 200);
  assert.ok(htmlRes.body.includes('GravitySynth'));

  // Create -> List -> Delete preset
  const scene = buildPreset('zen-bamboo', 1000, 600);
  const postRes = await invokeHandler('POST', '/api/presets', {
    name: 'Test Machine',
    author: 'UnitTest',
    scene,
  });
  assert.equal(postRes.statusCode, 201);
  const created = JSON.parse(postRes.body);
  assert.ok(created.preset.id);

  const listRes = await invokeHandler('GET', '/api/presets');
  assert.equal(listRes.statusCode, 200);
  const listData = JSON.parse(listRes.body);
  assert.ok(listData.presets.some((p) => p.id === created.preset.id));

  const delRes = await invokeHandler('DELETE', `/api/presets/${created.preset.id}`);
  assert.equal(delRes.statusCode, 200);
});

test('i18n defaults to English and provides complete EN/ZH translations', () => {
  assert.equal(detectInitialLang(), 'en', 'Default language should be English');
  const en = getDict('en');
  const zh = getDict('zh');
  assert.equal(en.brandTitle, 'GravitySynth');
  assert.equal(en.bannerBtn, 'Enable Audio ▶');
  assert.equal(zh.bannerBtn, '开启声音 ▶');
  assert.deepEqual(Object.keys(TRANSLATIONS.en).sort(), Object.keys(TRANSLATIONS.zh).sort());

  for (const p of PRESET_LIST) {
    assert.ok(p.name && p.nameZh, `Preset ${p.id} must have EN and ZH names`);
  }
  for (const sc of Object.values(SCALES)) {
    assert.ok(sc.name && sc.nameZh, `Scale ${sc.id} must have EN and ZH names`);
  }
  for (const inst of Object.values(INSTRUMENTS)) {
    assert.ok(inst.name && inst.nameZh, `Instrument ${inst.id} must have EN and ZH names`);
  }
});
