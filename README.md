# ✦ GravitySynth

> **Draw Physics, Play Music.**
> A **zero-dependency, 100% offline-ready** 2D astrophysics sandbox stitched together with a real-time **Web Audio modular synthesizer** — built for the **Frankenstein** Hackathon Track.

[🚀 Try It Live on GitHub Pages](https://jasonwong1991.github.io/gravity-synth/) · [中文文档 (Chinese README)](./README.zh-CN.md) · [3-Minute Stage Pitch Script](./PITCH.md) · [English Demo Video](./demo/gravity-synth-demo-en.mp4)

---

## ⚡ Why Frankenstein?

**GravitySynth** fuses two seemingly incompatible worlds into one living musical organism:
- **2D Astrophysics & Rigid-Body Sandbox**: gravity fields, black-hole orbital wells (with real-time Einstein spacetime grid warping), paired wormhole portals, harmonic optical prisms, and physically vibrating strings.
- **Zero-Asset Web Audio Modular Synthesizer**: 5 procedurally synthesized voices (FM Crystal Bell, Neon Harp, Cyber Synth, Zen Kalimba, 808 Pulse Drums), spatial stereo panning, ping-pong stereo delay, algorithmic convolution reverb, glue limiter, and real-time FFT spectrum visualization.

Because every string (length = pitch) and bumper (radius = pitch) is **automatically quantized to musical scales**, **it is impossible to play a wrong note** — anyone can draw physics and compose mesmerizing music in seconds.

---

## ✨ Key Features

1. **Zero Music-Theory Barrier**
   - 6 curated harmonic scales (`Major Pentatonic`, `Cyberpunk Minor`, `Dream Lydian`, `Zen Hirajoshi`, `Lo-Fi Maj9 Chill`, `Cosmic Whole-Tone`) + live root-key transposition.
2. **Playful Kinetic Instruments**
   - **Glowing Strings (`1`)**: damped sinusoidal physical vibration & note labels on impact.
   - **Elastic Bumpers (`2`)**: velocity-boosting melodic pads & synthesized 808 Kick/Snare/Hi-Hat drums.
   - **Tempo-Synced Emitters (`3`)**: BPM-locked orb launchers with directional aim.
   - **Gravity Wells (`4`)**: Black Hole attractors (or `Shift + Click` for Repulsor fields) that curve orb trajectories into Keplerian orbits while warping the cosmic background grid.
   - **Wormhole Portals (`5`)**: linked teleportation rings that preserve momentum and shift pitch by **+1 octave**.
   - **Harmonic Prisms (`6`)**: split incoming orbs into **perfect-fifth harmonic twins** for self-evolving cascades.
3. **Stage-Ready Live Performance Suite**
   - **5 Handcrafted Presets** (`Cyberpunk Rain`, `Orbital Clockwork`, `Zen Bamboo`, `Neon Pinball`, `Quantum Cascade`) + **🎲 Inspire Me** procedural machine generator.
   - **Bullet Time (`Hold Space`)**: instantly warps physics time to `0.25x` slow motion.
   - **Clean Stage Mode (`H`)**: hides all HUD panels for full-screen projector demos.
   - **1-Click `.webm` Audio Recording**, **HD PNG Snapshot**, **Serverless Base64URL Scene Sharing**, **Local Creations Gallery (`Node.js` REST API)**, and **Live EN / 中文 Language Switch**.

---

## 🚀 Quick Start (Zero `npm install`)

Requires only **Node.js v18+** — zero external packages to download:

```bash
cd gravity-synth
npm start
```

Open **http://127.0.0.1:3456** in your browser (opens in **English by default**; click `🌐 中文` in the top-right bar or visit `/?lang=zh` to switch to Chinese).

Run the automated test suite:

```bash
node --test --test-reporter=spec tests/engine.test.mjs
```

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
| --- | --- |
| `1` – `7` | Select Tool (String / Bumper / Emitter / Gravity Well / Portal / Prism / Drop Orb) |
| `V` / `E` | Move Elements / Eraser (**Right-click** erases instantly in any tool) |
| `Shift + Click` | Place a **Repulsor Field** while using the Gravity tool |
| `Hold Space` | **Bullet Time** (`0.25x` slow motion) |
| `P` | Play / Pause physics simulation |
| `H` | Toggle **Stage Presentation Mode** (hide/show HUD) |
| `Cmd / Ctrl + Z` | Undo last edit |

---

## 🏗 Architecture

```text
gravity-synth/
├── server.mjs                    # Zero-dependency Node HTTP server + Gallery REST API (/api/presets)
├── data/
│   └── community-presets.json    # Local persisted gallery creations
├── demo/
│   ├── gravity-synth-demo-en.mp4 # 48s HD English demo trailer (1280x720, real synced stereo audio)
│   └── gravity-synth-demo.mp4    # 48s HD Chinese demo trailer
├── public/
│   ├── index.html                # English-default glassmorphism studio UI with EN/ZH toggle
│   ├── styles.css                # Deep-space neon cyber-studio theme
│   └── src/
│       ├── i18n.js               # Full EN (default) & ZH dictionary + language persistence
│       ├── harmony.js            # Scale quantization, MIDI-to-Hz math, pitch-to-color engine
│       ├── physics.js            # Sub-stepped 2D physics (strings, bumpers, black holes, portals, prisms)
│       ├── audio.js              # 5-voice procedural Web Audio synth + reverb + delay + recorder
│       ├── renderer.js           # High-DPI Canvas 2D renderer (warped grid, bloom trails, live FFT)
│       ├── presets.js            # 5 responsive demo machines + procedural "Inspire Me" generator
│       ├── serializer.js         # JSON & Base64URL scene encoder/decoder
│       └── main.js               # Main loop, pointer state machine, shortcuts, gallery API
├── scripts/
│   ├── simulate_demo.mjs         # Deterministic physics & note event exporter for demo videos
│   └── build_demo_video.py       # Stereo DSP synthesizer + bloom video renderer (EN & ZH)
├── tests/
│   └── engine.test.mjs           # Native Node automated test suite
├── PITCH.md                      # 3-minute English Hackathon Pitch Playbook
├── PITCH.zh-CN.md                # 3-minute Chinese Hackathon Pitch Playbook
├── README.md                     # English Documentation (Primary)
└── README.zh-CN.md               # Chinese Documentation
```
