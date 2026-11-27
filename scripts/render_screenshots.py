#!/usr/bin/env python3
"""
Generates 4 crisp 3:2 (1500x1000) JPG showcase screenshots for Devpost / GitHub
directly from the real GravitySynth PhysicsWorld simulation & neon bloom renderer.
"""

import json
import math
import os
import subprocess
import sys
import numpy as np
from PIL import Image, ImageDraw

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SHOT_DIR = os.path.join(ROOT_DIR, "demo", "screenshots")
sys.path.insert(0, os.path.join(ROOT_DIR, "scripts"))

import build_demo_video as bv

W, H = 1500, 1000  # Exact 3:2 aspect ratio!


def run_node_sim():
    """Run a quick 1500x1000 simulation of 4 flagship scenes and return snapshots."""
    js_code = r"""
import { PhysicsWorld, dist } from './public/src/physics.js';
import { buildPreset } from './public/src/presets.js';
import { lengthToMidi, radiusToMidi, midiToLabel, pitchToColor } from './public/src/harmony.js';

let seed = 20261127;
Math.random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };

const W = 1500, H = 1000, DT = 1 / 60;
const targets = [
  { id: 'cyberpunk-rain', title: 'Cyberpunk Rain', sub: 'Draw vibrating strings & loop through +1 octave wormholes', steps: 260, bullet: false },
  { id: 'orbital-clockwork', title: 'Orbital Clockwork', sub: 'Zero-G Black Hole warps spacetime & bends harmonic orbits', steps: 340, bullet: true },
  { id: 'quantum-cascade', title: 'Quantum Cascade', sub: 'Harmonic prisms split orbs into perfect-fifth twins', steps: 255, bullet: false },
  { id: 'neon-pinball', title: 'Neon Pinball', sub: '808 procedural drums, repulsor fields & live FFT spectrum', steps: 245, bullet: false },
];

const out = [];
for (const tg of targets) {
  const world = new PhysicsWorld(W, H);
  world.loadScene(buildPreset(tg.id, W, H));
  world.onTriggerNote = (ev) => {
    if (world.floatingNotes.length < 24) {
      world.floatingNotes.push({
        x: ev.x, y: ev.y - 8,
        label: ev.instrument === 'drum' ? '●' : midiToLabel(ev.midi),
        color: ev.color, alpha: 0.95,
      });
    }
  };
  for (let i = 0; i < tg.steps; i++) {
    if (tg.bullet && i > tg.steps - 40) world.settings.timeScale = 0.28;
    world.step(DT);
  }
  const s = world.settings;
  out.push({
    t: 5.2,
    sceneId: tg.id,
    sceneTitle: tg.title,
    subtitle: tg.sub,
    bpm: s.bpm,
    gravity: s.gravity,
    timeScale: s.timeScale,
    totalHits: world.totalHits,
    orbCount: world.orbs.length,
    bulletTime: tg.bullet,
    emitters: world.emitters.map((e) => ({ x: Math.round(e.x), y: Math.round(e.y), angle: e.angle, beatDiv: e.beatDiv, instrument: e.instrument, pulse: e.pulse })),
    strings: world.strings.map((st) => {
      const midi = lengthToMidi(dist(st.x1, st.y1, st.x2, st.y2), s.scaleId, s.rootMidi);
      return { x1: Math.round(st.x1), y1: Math.round(st.y1), x2: Math.round(st.x2), y2: Math.round(st.y2), vib: st.vibration * Math.sin(st.vibPhase), hitFlash: st.hitFlash, hitT: st.hitT ?? 0.5, color: pitchToColor(midi, st.instrument), label: midiToLabel(midi) };
    }),
    bumpers: world.bumpers.map((b) => {
      const midi = radiusToMidi(b.radius, s.scaleId, s.rootMidi);
      const label = b.instrument === 'drum' ? (midi < 56 ? 'KICK' : midi < 68 ? 'SNR' : 'HAT') : midiToLabel(midi);
      return { x: Math.round(b.x), y: Math.round(b.y), r: b.radius * (1 + b.scalePulse * 0.22), hitFlash: b.hitFlash, color: pitchToColor(midi, b.instrument), label };
    }),
    wells: world.wells.map((w) => ({ x: Math.round(w.x), y: Math.round(w.y), strength: w.strength, spin: w.spin })),
    portals: world.portals.map((p) => ({ pairId: p.pairId, x: Math.round(p.x), y: Math.round(p.y), r: p.radius + p.pulse * 6, color: p.color })),
    prisms: world.prisms.map((pr) => ({ x: Math.round(pr.x), y: Math.round(pr.y), r: pr.radius + pr.hitFlash * 5, angle: pr.angle, hitFlash: pr.hitFlash })),
    orbs: world.orbs.map((o) => ({ x: Math.round(o.x), y: Math.round(o.y), r: o.radius * 1.15, color: o.color, trail: o.trail.map((pt) => [Math.round(pt.x), Math.round(pt.y)]) })),
    ripples: world.ripples.map((r) => ({ x: Math.round(r.x), y: Math.round(r.y), r: r.radius, alpha: r.alpha, color: r.color })),
    sparks: world.sparks.map((sp) => ({ x: Math.round(sp.x), y: Math.round(sp.y), size: sp.size * 1.2, alpha: Math.max(0, sp.life / sp.maxLife), color: sp.color })),
    notes: world.floatingNotes.map((fn) => ({ x: Math.round(fn.x), y: Math.round(fn.y), label: fn.label, alpha: fn.alpha, color: fn.color })),
  });
}
process.stdout.write(JSON.stringify(out));
"""
    res = subprocess.run(["node", "--input-type=module", "-e", js_code], cwd=ROOT_DIR, capture_output=True, text=True, check=True)
    return json.loads(res.stdout)


def make_spectrum(seed, intensity=0.82):
    rng = np.random.default_rng(seed)
    x = np.linspace(0, 1, 56)
    shape = np.exp(-((x - 0.35) ** 2) / 0.14) * 0.72 + np.exp(-((x - 0.72) ** 2) / 0.08) * 0.55 + 0.15
    noise = rng.uniform(0.55, 1.05, size=56)
    return np.clip(shape * noise * intensity, 0.08, 0.96)


def main():
    os.makedirs(SHOT_DIR, exist_ok=True)
    bv.LANG = "en"

    fonts = {
        "hero_en": bv.load_font(bv.FONT_SANS, 78),
        "hero_en_sub": bv.load_font(bv.FONT_SANS, 34),
        "hero_cn_lg": bv.load_font(bv.FONT_CJK_BOLD, 48),
        "hero_cn": bv.load_font(bv.FONT_CJK_BOLD, 34),
        "sub_cn": bv.load_font(bv.FONT_CJK_REG, 24),
        "sub_en": bv.load_font(bv.FONT_SANS, 24),
        "sub_bar": bv.load_font(bv.FONT_CJK_REG, 20),
        "sub_bar_en": bv.load_font(bv.FONT_SANS, 20),
        "hud_title": bv.load_font(bv.FONT_SANS, 19),
        "hud_md": bv.load_font(bv.FONT_CJK_BOLD, 17),
        "hud_xs": bv.load_font(bv.FONT_CJK_REG, 14),
        "mono_md": bv.load_font(bv.FONT_MONO, 22),
        "mono_sm": bv.load_font(bv.FONT_MONO, 15),
        "mono_xs": bv.load_font(bv.FONT_MONO, 14),
    }

    frames = run_node_sim()
    filenames = [
        "01-cyberpunk-rain-3x2.jpg",
        "02-orbital-blackhole-3x2.jpg",
        "03-quantum-prisms-3x2.jpg",
        "04-neon-pinball-3x2.jpg",
    ]

    for idx, (fr, fname) in enumerate(zip(frames, filenames)):
        bg = bv.create_cosmic_backdrop(W, H, fr["wells"])
        spec = make_spectrum(100 + idx, intensity=0.88 if idx != 1 else 0.72)
        img = bv.render_live_frame(bg, fr, spec, fonts, fade_alpha=1.0)
        out_path = os.path.join(SHOT_DIR, fname)
        img.save(out_path, format="JPEG", quality=92, optimize=True)
        print(f"Saved {out_path} ({img.size[0]}x{img.size[1]})")

    # Also render a dedicated 00-hero-cover-3x2.jpg (3:2 thumbnail cover for Devpost!)
    plain_bg = bv.create_cosmic_backdrop(W, H, [])
    hero = bv.draw_title_card(plain_bg, W, H, 1.8, mode="intro", fonts=fonts)
    hero_path = os.path.join(SHOT_DIR, "00-hero-cover-3x2.jpg")
    hero.save(hero_path, format="JPEG", quality=93, optimize=True)
    print(f"Saved {hero_path} ({hero.size[0]}x{hero.size[1]})")


if __name__ == "__main__":
    main()
