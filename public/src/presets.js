/**
 * Curated Hackathon Demo Presets & Procedural "Inspire Me" Machine Generator.
 * All presets adapt dynamically to canvas (W, H) so trajectories stay centered on any display.
 */

import { ROOT_NOTES, SCALES } from './harmony.js';

export const PRESET_LIST = [
  { id: 'cyberpunk-rain', name: 'Cyberpunk Rain', nameZh: '赛博雨夜', tag: 'Looping Arp', tagZh: '循环琶音' },
  { id: 'orbital-clockwork', name: 'Orbital Clockwork', nameZh: '星轨钟摆', tag: 'Zero-G Gravity', tagZh: '失重引力' },
  { id: 'zen-bamboo', name: 'Zen Bamboo', nameZh: '竹林禅音', tag: 'Hirajoshi Zen', tagZh: '东方五声' },
  { id: 'neon-pinball', name: 'Neon Pinball', nameZh: '霓虹弹珠', tag: '808 Arcade', tagZh: '电音鼓点' },
  { id: 'quantum-cascade', name: 'Quantum Cascade', nameZh: '量子分形', tag: 'Prism Split', tagZh: '棱镜裂变' },
];

export function buildPreset(presetId, W, H) {
  const w = Math.max(760, W);
  const h = Math.max(520, H);
  const cx = w * 0.5;
  const cy = h * 0.5;

  switch (presetId) {
    case 'cyberpunk-rain':
      return {
        version: 1,
        settings: {
          scaleId: 'cyberpunk',
          rootMidi: 48,
          bpm: 118,
          gravity: 430,
          timeScale: 1.0,
          reverbMix: 0.42,
          delayMix: 0.34,
        },
        emitters: [
          { x: cx - 190, y: h * 0.14, angle: Math.PI * 0.44, speed: 120, beatDiv: 1, instrument: 'synth', spread: 0.04, enabled: true },
          { x: cx + 190, y: h * 0.14, angle: Math.PI * 0.56, speed: 120, beatDiv: 1.5, instrument: 'crystal', spread: 0.04, enabled: true },
        ],
        strings: [
          // Terraced cascading synth strings
          { x1: cx - 250, y1: h * 0.31, x2: cx - 90, y2: h * 0.38, instrument: 'pluck', restitution: 0.96 },
          { x1: cx + 90, y1: h * 0.38, x2: cx + 250, y2: h * 0.31, instrument: 'crystal', restitution: 0.96 },
          { x1: cx - 140, y1: h * 0.56, x2: cx + 10, y2: h * 0.62, instrument: 'synth', restitution: 0.98 },
          { x1: cx - 10, y1: h * 0.62, x2: cx + 145, y2: h * 0.55, instrument: 'pluck', restitution: 0.98 },
          // Lower catch harp
          { x1: cx - 240, y1: h * 0.77, x2: cx - 65, y2: h * 0.84, instrument: 'synth', restitution: 0.95 },
          { x1: cx + 65, y1: h * 0.84, x2: cx + 240, y2: h * 0.77, instrument: 'crystal', restitution: 0.95 },
        ],
        bumpers: [
          { x: cx, y: h * 0.42, radius: 24, instrument: 'crystal', boost: 1.15 },
          { x: cx - 185, y: h * 0.58, radius: 34, instrument: 'drum', boost: 1.18 },
          { x: cx + 185, y: h * 0.58, radius: 22, instrument: 'drum', boost: 1.18 },
        ],
        wells: [],
        portals: [
          { pairId: 'loop1', x: cx, y: h * 0.84, radius: 26, color: '#22d3ee', pitchShift: 12 },
          { pairId: 'loop1', x: cx, y: h * 0.16, radius: 26, color: '#22d3ee', pitchShift: 12 },
        ],
        prisms: [
          { x: cx, y: h * 0.28, radius: 21, instrument: 'crystal' },
        ],
      };

    case 'orbital-clockwork':
      return {
        version: 1,
        settings: {
          scaleId: 'lydian',
          rootMidi: 50,
          bpm: 96,
          gravity: 0,
          timeScale: 1.0,
          reverbMix: 0.52,
          delayMix: 0.36,
        },
        emitters: [
          { x: cx - 195, y: cy - 10, angle: -Math.PI * 0.48, speed: 190, beatDiv: 1.5, instrument: 'crystal', spread: 0.04, enabled: true },
          { x: cx + 195, y: cy + 10, angle: Math.PI * 0.52, speed: 190, beatDiv: 1.5, instrument: 'pluck', spread: 0.04, enabled: true },
        ],
        strings: [
          // Orbital crystal resonator chords around the gravity star
          { x1: cx - 110, y1: cy - 205, x2: cx + 110, y2: cy - 205, instrument: 'crystal', restitution: 0.98 },
          { x1: cx - 120, y1: cy + 205, x2: cx + 120, y2: cy + 205, instrument: 'pluck', restitution: 0.98 },
          { x1: cx - 260, y1: cy - 95, x2: cx - 260, y2: cy + 95, instrument: 'synth', restitution: 0.98 },
          { x1: cx + 260, y1: cy - 85, x2: cx + 260, y2: cy + 85, instrument: 'kalimba', restitution: 0.98 },
        ],
        bumpers: [
          { x: cx - 115, y: cy - 105, radius: 22, instrument: 'crystal', boost: 1.05 },
          { x: cx + 115, y: cy - 105, radius: 26, instrument: 'pluck', boost: 1.05 },
          { x: cx - 115, y: cy + 105, radius: 30, instrument: 'kalimba', boost: 1.05 },
          { x: cx + 115, y: cy + 105, radius: 20, instrument: 'crystal', boost: 1.05 },
        ],
        wells: [
          { x: cx, y: cy, strength: 155000, radius: 28 },
        ],
        portals: [],
        prisms: [
          { x: cx, y: cy - 135, radius: 20, instrument: 'crystal' },
        ],
      };

    case 'zen-bamboo':
      return {
        version: 1,
        settings: {
          scaleId: 'hirajoshi',
          rootMidi: 52,
          bpm: 86,
          gravity: 250,
          timeScale: 1.0,
          reverbMix: 0.56,
          delayMix: 0.32,
        },
        emitters: [
          { x: cx - 150, y: h * 0.14, angle: Math.PI * 0.47, speed: 95, beatDiv: 1.5, instrument: 'kalimba', spread: 0.03, enabled: true },
          { x: cx + 135, y: h * 0.17, angle: Math.PI * 0.53, speed: 95, beatDiv: 2, instrument: 'crystal', spread: 0.03, enabled: true },
        ],
        strings: [
          // Gently sloping bamboo xylophone bars of varying lengths
          { x1: cx - 230, y1: h * 0.34, x2: cx - 75, y2: h * 0.41, instrument: 'kalimba', restitution: 0.9 },
          { x1: cx + 25, y1: h * 0.40, x2: cx + 215, y2: h * 0.33, instrument: 'kalimba', restitution: 0.9 },
          { x1: cx - 115, y1: h * 0.57, x2: cx + 5, y2: h * 0.62, instrument: 'pluck', restitution: 0.92 },
          { x1: cx - 245, y1: h * 0.72, x2: cx - 115, y2: h * 0.78, instrument: 'kalimba', restitution: 0.92 },
          { x1: cx + 70, y1: h * 0.75, x2: cx + 230, y2: h * 0.67, instrument: 'crystal', restitution: 0.92 },
        ],
        bumpers: [
          { x: cx - 20, y: h * 0.78, radius: 22, instrument: 'crystal', boost: 1.08 },
          { x: cx + 55, y: h * 0.56, radius: 19, instrument: 'kalimba', boost: 1.08 },
        ],
        wells: [
          { x: cx, y: h * 0.46, strength: 36000, radius: 22 },
        ],
        portals: [
          { pairId: 'zen1', x: cx - 15, y: h * 0.87, radius: 24, color: '#34d399', pitchShift: 12 },
          { pairId: 'zen1', x: cx, y: h * 0.14, radius: 24, color: '#34d399', pitchShift: 12 },
        ],
        prisms: [
          { x: cx - 55, y: h * 0.48, radius: 20, instrument: 'kalimba' },
        ],
      };

    case 'neon-pinball':
      return {
        version: 1,
        settings: {
          scaleId: 'pentatonic',
          rootMidi: 48,
          bpm: 128,
          gravity: 480,
          timeScale: 1.0,
          reverbMix: 0.28,
          delayMix: 0.25,
        },
        emitters: [
          { x: cx - 220, y: h * 0.16, angle: Math.PI * 0.35, speed: 240, beatDiv: 1, instrument: 'synth', spread: 0.07, enabled: true },
          { x: cx + 220, y: h * 0.16, angle: Math.PI * 0.65, speed: 240, beatDiv: 1, instrument: 'crystal', spread: 0.07, enabled: true },
        ],
        strings: [
          // Pinball flippers & side walls
          { x1: cx - 300, y1: h * 0.26, x2: cx - 260, y2: h * 0.68, instrument: 'pluck', restitution: 1.02 },
          { x1: cx + 300, y1: h * 0.26, x2: cx + 260, y2: h * 0.68, instrument: 'pluck', restitution: 1.02 },
          { x1: cx - 250, y1: h * 0.72, x2: cx - 55, y2: h * 0.84, instrument: 'synth', restitution: 1.08 },
          { x1: cx + 250, y1: h * 0.72, x2: cx + 55, y2: h * 0.84, instrument: 'synth', restitution: 1.08 },
        ],
        bumpers: [
          { x: cx, y: h * 0.36, radius: 36, instrument: 'drum', boost: 1.25 },
          { x: cx - 120, y: h * 0.45, radius: 24, instrument: 'drum', boost: 1.22 },
          { x: cx + 120, y: h * 0.45, radius: 17, instrument: 'drum', boost: 1.22 },
          { x: cx - 80, y: h * 0.60, radius: 22, instrument: 'crystal', boost: 1.18 },
          { x: cx + 80, y: h * 0.60, radius: 28, instrument: 'synth', boost: 1.18 },
        ],
        wells: [
          { x: cx, y: h * 0.56, strength: -65000, radius: 24 },
        ],
        portals: [
          { pairId: 'pin1', x: cx, y: h * 0.86, radius: 26, color: '#f43f5e', pitchShift: 12 },
          { pairId: 'pin1', x: cx, y: h * 0.16, radius: 26, color: '#f43f5e', pitchShift: 12 },
        ],
        prisms: [
          { x: cx, y: h * 0.24, radius: 20, instrument: 'crystal' },
        ],
      };

    case 'quantum-cascade':
    default:
      return {
        version: 1,
        settings: {
          scaleId: 'lofi',
          rootMidi: 53,
          bpm: 108,
          gravity: 390,
          timeScale: 1.0,
          reverbMix: 0.45,
          delayMix: 0.35,
        },
        emitters: [
          { x: cx, y: h * 0.11, angle: Math.PI * 0.5, speed: 120, beatDiv: 1.5, instrument: 'crystal', spread: 0.05, enabled: true },
        ],
        strings: [
          // Fan harp catches all split harmonic children
          { x1: cx - 285, y1: h * 0.62, x2: cx - 175, y2: h * 0.72, instrument: 'pluck', restitution: 0.96 },
          { x1: cx - 155, y1: h * 0.74, x2: cx - 35, y2: h * 0.80, instrument: 'crystal', restitution: 0.96 },
          { x1: cx + 35, y1: h * 0.80, x2: cx + 155, y2: h * 0.74, instrument: 'synth', restitution: 0.96 },
          { x1: cx + 175, y1: h * 0.72, x2: cx + 285, y2: h * 0.62, instrument: 'kalimba', restitution: 0.96 },
        ],
        bumpers: [
          { x: cx, y: h * 0.58, radius: 26, instrument: 'kalimba', boost: 1.15 },
          { x: cx - 190, y: h * 0.46, radius: 22, instrument: 'crystal', boost: 1.15 },
          { x: cx + 190, y: h * 0.46, radius: 22, instrument: 'pluck', boost: 1.15 },
        ],
        wells: [],
        portals: [
          { pairId: 'q1', x: cx - 245, y: h * 0.82, radius: 24, color: '#a855f7', pitchShift: 12 },
          { pairId: 'q1', x: cx + 115, y: h * 0.18, radius: 24, color: '#a855f7', pitchShift: 12 },
          { pairId: 'q2', x: cx + 245, y: h * 0.82, radius: 24, color: '#38bdf8', pitchShift: -12 },
          { pairId: 'q2', x: cx - 115, y: h * 0.18, radius: 24, color: '#38bdf8', pitchShift: -12 },
        ],
        prisms: [
          { x: cx, y: h * 0.25, radius: 21, instrument: 'crystal' },
          { x: cx - 95, y: h * 0.40, radius: 19, instrument: 'pluck' },
          { x: cx + 95, y: h * 0.40, radius: 19, instrument: 'synth' },
        ],
      };
  }
}

/**
 * Procedural "Inspire Me" generator: creates a fresh, harmonically balanced
 * kinetic music machine on every click!
 */
export function generateProceduralScene(W, H) {
  const w = Math.max(760, W);
  const h = Math.max(520, H);
  const cx = w * 0.5;
  const cy = h * 0.5;

  const scaleIds = Object.keys(SCALES);
  const scaleId = scaleIds[Math.floor(Math.random() * scaleIds.length)];
  const rootMidi = ROOT_NOTES[Math.floor(Math.random() * ROOT_NOTES.length)].midi;
  const bpm = 92 + Math.floor(Math.random() * 40);

  const palettes = [
    ['crystal', 'pluck', 'synth'],
    ['kalimba', 'crystal', 'drum'],
    ['synth', 'drum', 'pluck'],
  ];
  const insts = palettes[Math.floor(Math.random() * palettes.length)];
  const archetypes = ['waterfall', 'orbital', 'symmetrical'];
  const archetype = archetypes[Math.floor(Math.random() * archetypes.length)];

  if (archetype === 'orbital') {
    const numStrings = 4 + Math.floor(Math.random() * 2);
    const strings = [];
    const ringR = Math.min(w, h) * 0.34;
    for (let i = 0; i < numStrings; i++) {
      const a = (i / numStrings) * Math.PI * 2 + 0.3;
      const halfSpan = 55 + Math.random() * 55;
      const tx = -Math.sin(a);
      const ty = Math.cos(a);
      const mx = cx + Math.cos(a) * ringR;
      const my = cy + Math.sin(a) * ringR;
      strings.push({
        x1: mx - tx * halfSpan,
        y1: my - ty * halfSpan,
        x2: mx + tx * halfSpan,
        y2: my + ty * halfSpan,
        instrument: insts[i % insts.length],
        restitution: 0.98,
      });
    }
    const bumpers = [];
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + Math.random() * 0.5;
      bumpers.push({
        x: cx + Math.cos(a) * (ringR * 0.52),
        y: cy + Math.sin(a) * (ringR * 0.52),
        radius: 18 + Math.floor(Math.random() * 18),
        instrument: insts[(i + 1) % insts.length],
        boost: 1.08,
      });
    }
    return {
      version: 1,
      settings: { scaleId, rootMidi, bpm, gravity: 0, timeScale: 1.0, reverbMix: 0.48, delayMix: 0.34 },
      emitters: [
        { x: cx - ringR * 0.72, y: cy, angle: -Math.PI * 0.45, speed: 235, beatDiv: 1.5, instrument: insts[0], spread: 0.05, enabled: true },
        { x: cx + ringR * 0.72, y: cy, angle: Math.PI * 0.55, speed: 235, beatDiv: 2, instrument: insts[1], spread: 0.05, enabled: true },
      ],
      strings,
      bumpers,
      wells: [{ x: cx, y: cy, strength: 115000 + Math.random() * 35000, radius: 26 }],
      portals: [],
      prisms: [{ x: cx, y: cy - ringR * 0.52, radius: 20, instrument: insts[2] }],
    };
  }

  // Waterfall or Symmetrical gravity sculpture
  const strings = [];
  const tiers = 3;
  for (let t = 0; t < tiers; t++) {
    const yBase = h * (0.33 + t * 0.2);
    const spreadX = 110 + t * 55 + Math.random() * 35;
    const len = 95 + Math.random() * 90;
    const tilt = (t % 2 === 0 ? 1 : -1) * (22 + Math.random() * 24);
    strings.push({
      x1: cx - spreadX - len * 0.5,
      y1: yBase - tilt,
      x2: cx - spreadX + len * 0.5,
      y2: yBase + tilt,
      instrument: insts[t % insts.length],
      restitution: 0.95,
    });
    strings.push({
      x1: cx + spreadX - len * 0.5,
      y1: yBase + tilt,
      x2: cx + spreadX + len * 0.5,
      y2: yBase - tilt,
      instrument: insts[(t + 1) % insts.length],
      restitution: 0.95,
    });
  }

  const bumpers = [
    { x: cx, y: h * 0.46, radius: 20 + Math.floor(Math.random() * 16), instrument: insts[2], boost: 1.15 },
    { x: cx - 125, y: h * 0.62, radius: 18 + Math.floor(Math.random() * 14), instrument: insts[0], boost: 1.14 },
    { x: cx + 125, y: h * 0.62, radius: 18 + Math.floor(Math.random() * 14), instrument: insts[1], boost: 1.14 },
  ];

  const portalColors = ['#22d3ee', '#a855f7', '#f43f5e', '#34d399'];
  const pColor = portalColors[Math.floor(Math.random() * portalColors.length)];

  return {
    version: 1,
    settings: {
      scaleId,
      rootMidi,
      bpm,
      gravity: 320 + Math.floor(Math.random() * 170),
      timeScale: 1.0,
      reverbMix: 0.4,
      delayMix: 0.3,
    },
    emitters: [
      { x: cx - 150, y: h * 0.14, angle: Math.PI * 0.46, speed: 120, beatDiv: 1, instrument: insts[0], spread: 0.05, enabled: true },
      { x: cx + 150, y: h * 0.14, angle: Math.PI * 0.54, speed: 120, beatDiv: 1.5, instrument: insts[1], spread: 0.05, enabled: true },
    ],
    strings,
    bumpers,
    wells: Math.random() > 0.5 ? [{ x: cx, y: h * 0.66, strength: Math.random() > 0.5 ? 55000 : -55000, radius: 24 }] : [],
    portals: [
      { pairId: 'gen1', x: cx, y: h * 0.85, radius: 25, color: pColor, pitchShift: 12 },
      { pairId: 'gen1', x: cx, y: h * 0.15, radius: 25, color: pColor, pitchShift: 12 },
    ],
    prisms: [{ x: cx, y: h * 0.29, radius: 20, instrument: insts[0] }],
  };
}
