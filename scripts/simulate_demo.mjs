/**
 * Deterministic Physics Simulation Exporter for GravitySynth Demo Video.
 * Runs the REAL PhysicsWorld + curated presets at 30fps and exports
 * every frame's geometry + exact note trigger timestamps to JSON.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PhysicsWorld, dist } from '../public/src/physics.js';
import { buildPreset } from '../public/src/presets.js';
import { lengthToMidi, radiusToMidi, midiToLabel, pitchToColor } from '../public/src/harmony.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const LANG = (process.env.DEMO_LANG || 'zh').toLowerCase() === 'en' ? 'en' : 'zh';
const OUT_FILE = path.join(__dirname, '..', 'demo', LANG === 'en' ? 'sim_data_en.json' : 'sim_data.json');

const WIDTH = 1280;
const HEIGHT = 720;
const FPS = 30;
const DT = 1 / FPS;

const SCENES = LANG === 'en'
  ? [
      {
        id: 'cyberpunk-rain',
        title: 'Cyberpunk Rain',
        subtitle: '01 / Zero Theory Barrier  |  Draw vibrating strings & loop through +1 octave wormholes',
        startSec: 4.0,
        durationSec: 11.0,
        warmupSec: 1.4,
      },
      {
        id: 'orbital-clockwork',
        title: 'Orbital Clockwork',
        subtitle: '02 / Zero-G Black Hole  |  Real-time warped spacetime grid & 0.25x bullet-time',
        startSec: 15.0,
        durationSec: 11.0,
        warmupSec: 1.6,
      },
      {
        id: 'quantum-cascade',
        title: 'Quantum Cascade',
        subtitle: '03 / Harmonic Prism Split  |  Fracture orbs into fifth-interval twins + live FFT',
        startSec: 26.0,
        durationSec: 10.0,
        warmupSec: 1.5,
      },
      {
        id: 'neon-pinball',
        title: 'Neon Pinball',
        subtitle: '04 / Pure Procedural Synth  |  5 voices, spatial reverb & 808 drums  |  100% offline',
        startSec: 36.0,
        durationSec: 8.0,
        warmupSec: 1.3,
      },
    ]
  : [
      {
        id: 'cyberpunk-rain',
        title: '赛博雨夜 · Cyberpunk Rain',
        subtitle: '01 / 零乐理门槛 · 随手画发光琴弦，虫洞跃迁触发 +1 八度泛音',
        startSec: 4.0,
        durationSec: 11.0,
        warmupSec: 1.4,
      },
      {
        id: 'orbital-clockwork',
        title: '星轨钟摆 · Orbital Clockwork',
        subtitle: '02 / 0g 黑洞引力偏折 · 时空网格实时扭曲 · 0.25x 子弹时间',
        startSec: 15.0,
        durationSec: 11.0,
        warmupSec: 1.6,
      },
      {
        id: 'quantum-cascade',
        title: '量子分形 · Quantum Cascade',
        subtitle: '03 / 和声棱镜裂变 · 一球分裂五度和声双子球 · 实时频谱共振',
        startSec: 26.0,
        durationSec: 10.0,
        warmupSec: 1.5,
      },
      {
        id: 'neon-pinball',
        title: '霓虹弹珠 · Neon Pinball',
        subtitle: '04 / 纯算法 5 音色合成 · 空间声像 + 卷积混响 · 零依赖全离线',
        startSec: 36.0,
        durationSec: 8.0,
        warmupSec: 1.3,
      },
    ];

const TOTAL_DURATION = 48.0; // 4s intro + 40s live scenes + 4s outro

function snapshotFrame(world, tGlobal, sceneMeta, extra = {}) {
  const settings = world.settings;
  return {
    t: Number(tGlobal.toFixed(4)),
    sceneId: sceneMeta.id,
    sceneTitle: sceneMeta.title,
    subtitle: sceneMeta.subtitle,
    bpm: settings.bpm,
    gravity: settings.gravity,
    timeScale: Number(settings.timeScale.toFixed(2)),
    scaleId: settings.scaleId,
    totalHits: world.totalHits,
    orbCount: world.orbs.length,
    bulletTime: !!extra.bulletTime,
    cursorDraw: extra.cursorDraw || null,
    emitters: world.emitters.map((e) => ({
      x: Math.round(e.x),
      y: Math.round(e.y),
      angle: Number(e.angle.toFixed(3)),
      beatDiv: e.beatDiv,
      instrument: e.instrument,
      pulse: Number(e.pulse.toFixed(2)),
    })),
    strings: world.strings.map((s) => {
      const len = dist(s.x1, s.y1, s.x2, s.y2);
      const midi = lengthToMidi(len, settings.scaleId, settings.rootMidi);
      return {
        x1: Math.round(s.x1),
        y1: Math.round(s.y1),
        x2: Math.round(s.x2),
        y2: Math.round(s.y2),
        vib: Number((s.vibration * Math.sin(s.vibPhase)).toFixed(2)),
        hitFlash: Number(s.hitFlash.toFixed(2)),
        hitT: Number((s.hitT ?? 0.5).toFixed(2)),
        color: pitchToColor(midi, s.instrument),
        label: midiToLabel(midi),
      };
    }),
    bumpers: world.bumpers.map((b) => {
      const midi = radiusToMidi(b.radius, settings.scaleId, settings.rootMidi);
      const label = b.instrument === 'drum' ? (midi < 56 ? 'KICK' : midi < 68 ? 'SNR' : 'HAT') : midiToLabel(midi);
      return {
        x: Math.round(b.x),
        y: Math.round(b.y),
        r: Number((b.radius * (1 + b.scalePulse * 0.22)).toFixed(1)),
        hitFlash: Number(b.hitFlash.toFixed(2)),
        color: pitchToColor(midi, b.instrument),
        label,
      };
    }),
    wells: world.wells.map((w) => ({
      x: Math.round(w.x),
      y: Math.round(w.y),
      strength: w.strength,
      spin: Number(w.spin.toFixed(3)),
    })),
    portals: world.portals.map((p) => ({
      pairId: p.pairId,
      x: Math.round(p.x),
      y: Math.round(p.y),
      r: Number((p.radius + p.pulse * 6).toFixed(1)),
      color: p.color,
    })),
    prisms: world.prisms.map((pr) => ({
      x: Math.round(pr.x),
      y: Math.round(pr.y),
      r: Number((pr.radius + pr.hitFlash * 5).toFixed(1)),
      angle: Number(pr.angle.toFixed(3)),
      hitFlash: Number(pr.hitFlash.toFixed(2)),
    })),
    orbs: world.orbs.map((o) => ({
      x: Math.round(o.x),
      y: Math.round(o.y),
      r: o.radius,
      color: o.color,
      trail: o.trail.filter((_, idx) => idx % 2 === 0 || idx === o.trail.length - 1).map((pt) => [Math.round(pt.x), Math.round(pt.y)]),
    })),
    ripples: world.ripples.map((r) => ({
      x: Math.round(r.x),
      y: Math.round(r.y),
      r: Number(r.radius.toFixed(1)),
      alpha: Number(r.alpha.toFixed(2)),
      color: r.color,
    })),
    sparks: world.sparks.map((sp) => ({
      x: Math.round(sp.x),
      y: Math.round(sp.y),
      size: Number(sp.size.toFixed(1)),
      alpha: Number(Math.max(0, sp.life / sp.maxLife).toFixed(2)),
      color: sp.color,
    })),
    notes: world.floatingNotes.map((fn) => ({
      x: Math.round(fn.x),
      y: Math.round(fn.y),
      label: fn.label,
      alpha: Number(fn.alpha.toFixed(2)),
      color: fn.color,
    })),
  };
}

async function main() {
  // Seeded pseudo-random for consistent lively demo
  let seed = 20261127;
  Math.random = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };

  const frames = [];
  const audioEvents = [];

  // Opening cinematic chord arpeggio (0.4s .. 3.0s)
  const introNotes = [
    { t: 0.35, midi: 48, instrument: 'synth', velocity: 0.65, pan: -0.35 },
    { t: 0.75, midi: 55, instrument: 'pluck', velocity: 0.72, pan: 0.25 },
    { t: 1.15, midi: 60, instrument: 'crystal', velocity: 0.8, pan: -0.15 },
    { t: 1.55, midi: 63, instrument: 'crystal', velocity: 0.78, pan: 0.35 },
    { t: 1.95, midi: 67, instrument: 'crystal', velocity: 0.85, pan: 0.0 },
    { t: 2.45, midi: 72, instrument: 'crystal', velocity: 0.9, pan: 0.15 },
  ];
  audioEvents.push(...introNotes);

  // Simulate each live scene
  for (const sc of SCENES) {
    const world = new PhysicsWorld(WIDTH, HEIGHT);
    const preset = buildPreset(sc.id, WIDTH, HEIGHT);
    world.loadScene(preset);

    // Warm up silently so orbs are already in motion when the scene opens!
    const warmupSteps = Math.round(sc.warmupSec * FPS);
    for (let i = 0; i < warmupSteps; i++) {
      world.step(DT);
    }

    let currentSceneTime = sc.startSec;
    world.onTriggerNote = (ev) => {
      audioEvents.push({
        t: Number(currentSceneTime.toFixed(4)),
        midi: ev.midi,
        instrument: ev.instrument,
        velocity: Number(ev.velocity.toFixed(3)),
        pan: Number(ev.pan.toFixed(3)),
      });
      if (world.floatingNotes.length < 24) {
        world.floatingNotes.push({
          x: ev.x,
          y: ev.y - 8,
          label: ev.instrument === 'drum' ? '●' : midiToLabel(ev.midi),
          color: ev.color,
          alpha: 0.95,
        });
      }
    };

    const sceneFrames = Math.round(sc.durationSec * FPS);
    let addedLiveString = false;

    for (let f = 0; f < sceneFrames; f++) {
      const localT = f * DT;
      currentSceneTime = sc.startSec + localT;

      const extra = {};

      // Scene 1 interactive highlight: live cursor draws a glowing neon string at localT 3.0..4.4s
      if (sc.id === 'cyberpunk-rain') {
        const sx1 = WIDTH * 0.5 - 88;
        const sy1 = HEIGHT * 0.49;
        const sx2 = WIDTH * 0.5 + 88;
        const sy2 = HEIGHT * 0.45;
        if (localT >= 2.8 && localT < 4.2) {
          const p = (localT - 2.8) / 1.4;
          const ease = 1 - Math.pow(1 - p, 3);
          const cx = sx1 + (sx2 - sx1) * ease;
          const cy = sy1 + (sy2 - sy1) * ease;
          extra.cursorDraw = {
            x1: Math.round(sx1),
            y1: Math.round(sy1),
            x2: Math.round(cx),
            y2: Math.round(cy),
            label: midiToLabel(lengthToMidi(dist(sx1, sy1, cx, cy), world.settings.scaleId, world.settings.rootMidi)),
          };
        } else if (localT >= 4.2 && !addedLiveString) {
          addedLiveString = true;
          world.addString(sx1, sy1, sx2, sy2, { instrument: 'crystal', restitution: 0.98 });
        }
      }

      // Scene 2 interactive highlight: Bullet-Time 0.25x from localT 5.5s .. 8.8s
      if (sc.id === 'orbital-clockwork') {
        if (localT >= 5.5 && localT <= 8.8) {
          world.settings.timeScale = 0.28;
          extra.bulletTime = true;
        } else {
          world.settings.timeScale = 1.0;
        }
      }

      world.step(DT);
      frames.push(snapshotFrame(world, currentSceneTime, sc, extra));
    }
  }

  // Closing warm chord shimmer (44.1s .. 46.2s)
  audioEvents.push(
    { t: 44.1, midi: 48, instrument: 'synth', velocity: 0.6, pan: -0.25 },
    { t: 44.35, midi: 55, instrument: 'pluck', velocity: 0.65, pan: 0.25 },
    { t: 44.65, midi: 60, instrument: 'crystal', velocity: 0.72, pan: -0.1 },
    { t: 44.95, midi: 64, instrument: 'crystal', velocity: 0.72, pan: 0.2 },
    { t: 45.3, midi: 67, instrument: 'crystal', velocity: 0.75, pan: 0.0 }
  );

  await fs.mkdir(path.dirname(OUT_FILE), { recursive: true });
  await fs.writeFile(
    OUT_FILE,
    JSON.stringify({
      width: WIDTH,
      height: HEIGHT,
      fps: FPS,
      totalDuration: TOTAL_DURATION,
      scenes: SCENES,
      frames,
      audioEvents,
    }),
    'utf8'
  );

  console.log(`Simulation complete: ${frames.length} live frames, ${audioEvents.length} musical note triggers -> ${OUT_FILE}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
