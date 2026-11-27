/**
 * 2D Kinetic Physics & Musical Trigger Engine
 * Handles orbs, tempo-synced emitters, vibrating strings, bouncy bumpers,
 * gravity wells (attractors/repulsors), wormhole portals, and harmonic prism splitters.
 */

import { lengthToMidi, radiusToMidi, pitchToColor } from './harmony.js';

let nextIdCounter = 1;
export function genId(prefix = 'obj') {
  return `${prefix}_${nextIdCounter++}_${Math.random().toString(36).slice(2, 6)}`;
}

export function dist(x1, y1, x2, y2) {
  return Math.hypot(x2 - x1, y2 - y1);
}

/**
 * Find closest point on segment AB to point P.
 * Returns { x, y, t, distance }.
 */
export function closestPointOnSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq < 1e-6) {
    return { x: x1, y: y1, t: 0, distance: Math.hypot(px - x1, py - y1) };
  }
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lenSq));
  const cx = x1 + t * dx;
  const cy = y1 + t * dy;
  return { x: cx, y: cy, t, distance: Math.hypot(px - cx, py - cy) };
}

export class PhysicsWorld {
  constructor(width = 1200, height = 720) {
    this.width = width;
    this.height = height;

    this.settings = {
      scaleId: 'pentatonic',
      rootMidi: 48,
      bpm: 112,
      gravity: 420,      // px / s^2
      timeScale: 1.0,    // 0.2 .. 2.0
      reverbMix: 0.34,
      delayMix: 0.28,
      maxOrbs: 90,
      orbMaxAge: 16,
    };

    this.emitters = [];
    this.strings = [];
    this.bumpers = [];
    this.wells = [];
    this.portals = [];
    this.prisms = [];
    this.orbs = [];

    // Transient visual FX queues (rendered by Renderer)
    this.ripples = [];
    this.sparks = [];
    this.floatingNotes = [];

    this.totalHits = 0;
    this.simTime = 0;
    this.onTriggerNote = null; // callback(event)
  }

  resize(width, height) {
    this.width = Math.max(320, width);
    this.height = Math.max(240, height);
  }

  clearAll() {
    this.emitters = [];
    this.strings = [];
    this.bumpers = [];
    this.wells = [];
    this.portals = [];
    this.prisms = [];
    this.clearDynamic();
  }

  clearDynamic() {
    this.orbs = [];
    this.ripples = [];
    this.sparks = [];
    this.floatingNotes = [];
  }

  loadScene(scene) {
    this.clearAll();
    if (scene.settings) {
      this.settings = { ...this.settings, ...scene.settings };
    }
    this.emitters = (scene.emitters || []).map((e) => ({
      id: e.id || genId('em'),
      x: e.x,
      y: e.y,
      angle: e.angle ?? Math.PI / 2,
      speed: e.speed ?? 220,
      beatDiv: e.beatDiv ?? 1, // beats per emission (0.5 = 8th note, 1 = quarter, 2 = half)
      instrument: e.instrument || 'crystal',
      spread: e.spread ?? 0.06,
      enabled: e.enabled !== false,
      timer: 0,
      pulse: 0,
    }));

    this.strings = (scene.strings || []).map((s) => ({
      id: s.id || genId('str'),
      x1: s.x1,
      y1: s.y1,
      x2: s.x2,
      y2: s.y2,
      instrument: s.instrument || 'pluck',
      restitution: s.restitution ?? 0.94,
      vibration: 0,
      vibPhase: 0,
      hitFlash: 0,
      hitT: 0.5,
    }));

    this.bumpers = (scene.bumpers || []).map((b) => ({
      id: b.id || genId('bmp'),
      x: b.x,
      y: b.y,
      radius: b.radius ?? 26,
      instrument: b.instrument || 'crystal',
      boost: b.boost ?? 1.12,
      hitFlash: 0,
      scalePulse: 0,
    }));

    this.wells = (scene.wells || []).map((w) => ({
      id: w.id || genId('well'),
      x: w.x,
      y: w.y,
      strength: w.strength ?? 95000, // positive = attract, negative = repel
      radius: w.radius ?? 26,
      spin: 0,
    }));

    this.portals = (scene.portals || []).map((p) => ({
      id: p.id || genId('prt'),
      pairId: p.pairId || 'pair_1',
      x: p.x,
      y: p.y,
      radius: p.radius ?? 24,
      color: p.color || '#22d3ee',
      pitchShift: p.pitchShift ?? 12,
      pulse: 0,
    }));

    this.prisms = (scene.prisms || []).map((pr) => ({
      id: pr.id || genId('prs'),
      x: pr.x,
      y: pr.y,
      radius: pr.radius ?? 22,
      instrument: pr.instrument || 'synth',
      hitFlash: 0,
      angle: 0,
    }));
  }

  addEmitter(x, y, opts = {}) {
    const em = {
      id: genId('em'),
      x,
      y,
      angle: opts.angle ?? Math.PI / 2,
      speed: opts.speed ?? 210,
      beatDiv: opts.beatDiv ?? 1,
      instrument: opts.instrument || 'crystal',
      spread: opts.spread ?? 0.05,
      enabled: true,
      timer: 0,
      pulse: 1,
    };
    this.emitters.push(em);
    this.spawnFromEmitter(em);
    return em;
  }

  addString(x1, y1, x2, y2, opts = {}) {
    if (dist(x1, y1, x2, y2) < 18) return null;
    const str = {
      id: genId('str'),
      x1,
      y1,
      x2,
      y2,
      instrument: opts.instrument || 'pluck',
      restitution: opts.restitution ?? 0.94,
      vibration: 0,
      vibPhase: 0,
      hitFlash: 0.6,
      hitT: 0.5,
    };
    this.strings.push(str);
    return str;
  }

  addBumper(x, y, radius = 26, opts = {}) {
    const bmp = {
      id: genId('bmp'),
      x,
      y,
      radius: Math.max(14, Math.min(54, radius)),
      instrument: opts.instrument || 'crystal',
      boost: opts.boost ?? 1.12,
      hitFlash: 0.6,
      scalePulse: 0.4,
    };
    this.bumpers.push(bmp);
    return bmp;
  }

  addWell(x, y, strength = 105000) {
    const well = {
      id: genId('well'),
      x,
      y,
      strength,
      radius: 26,
      spin: 0,
    };
    this.wells.push(well);
    return well;
  }

  addPortal(x, y, pairId, color = '#22d3ee', pitchShift = 12) {
    const portal = {
      id: genId('prt'),
      pairId,
      x,
      y,
      radius: 24,
      color,
      pitchShift,
      pulse: 1,
    };
    this.portals.push(portal);
    return portal;
  }

  addPrism(x, y, opts = {}) {
    const prism = {
      id: genId('prs'),
      x,
      y,
      radius: opts.radius ?? 22,
      instrument: opts.instrument || 'synth',
      hitFlash: 0.6,
      angle: 0,
    };
    this.prisms.push(prism);
    return prism;
  }

  spawnOrb(x, y, vx, vy, opts = {}) {
    if (this.orbs.length >= this.settings.maxOrbs) {
      this.orbs.shift();
    }
    const orb = {
      id: genId('orb'),
      x,
      y,
      vx,
      vy,
      radius: opts.radius ?? 6.5,
      color: opts.color || '#38bdf8',
      pitchOffset: opts.pitchOffset ?? 0,
      generation: opts.generation ?? 0,
      age: 0,
      maxAge: opts.maxAge ?? this.settings.orbMaxAge,
      portalCooldown: opts.portalCooldown ?? 0,
      prismCooldown: opts.prismCooldown ?? 0,
      lastHitId: null,
      lastHitTimer: 0,
      trail: [{ x, y }],
    };
    this.orbs.push(orb);
    return orb;
  }

  spawnFromEmitter(em) {
    const jitter = (Math.random() - 0.5) * 2 * (em.spread || 0);
    const a = em.angle + jitter;
    const vx = Math.cos(a) * em.speed;
    const vy = Math.sin(a) * em.speed;
    const startX = em.x + Math.cos(a) * 18;
    const startY = em.y + Math.sin(a) * 18;
    const color = pitchToColor(this.settings.rootMidi + 7, em.instrument);
    this.spawnOrb(startX, startY, vx, vy, { color });
    em.pulse = 1;
  }

  emitNoteTrigger(x, y, midi, instrument, velocity, color) {
    this.totalHits += 1;
    const pan = Math.max(-0.9, Math.min(0.9, (x / Math.max(1, this.width)) * 2 - 1));
    const normVel = Math.max(0.18, Math.min(1.0, velocity / 620));

    this.ripples.push({
      x,
      y,
      radius: 8,
      maxRadius: 34 + normVel * 54,
      alpha: 0.9,
      color,
    });

    const sparkCount = 5 + Math.floor(normVel * 8);
    for (let i = 0; i < sparkCount; i++) {
      const ang = Math.random() * Math.PI * 2;
      const spd = 45 + Math.random() * (140 * normVel + 60);
      this.sparks.push({
        x,
        y,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd,
        life: 0.45 + Math.random() * 0.3,
        maxLife: 0.75,
        color,
        size: 1.6 + Math.random() * 2.2,
      });
    }

    if (this.onTriggerNote) {
      this.onTriggerNote({
        x,
        y,
        midi,
        instrument,
        velocity: normVel,
        pan,
        color,
      });
    }
  }

  /**
   * Remove nearest interactive element within tolerance radius.
   * Returns true if something was deleted.
   */
  eraseAt(x, y, tolerance = 28) {
    // Check point entities first
    const lists = [
      { arr: this.emitters, r: 22 },
      { arr: this.bumpers, r: 0 },
      { arr: this.wells, r: 28 },
      { arr: this.portals, r: 26 },
      { arr: this.prisms, r: 26 },
    ];
    for (const { arr, r } of lists) {
      for (let i = arr.length - 1; i >= 0; i--) {
        const item = arr[i];
        const hitR = (item.radius || r) + 10;
        if (dist(x, y, item.x, item.y) <= Math.max(hitR, tolerance)) {
          if (arr === this.portals) {
            // Remove partner portal too for cleanliness if it exists
            const pairId = item.pairId;
            this.portals = this.portals.filter((p) => p.pairId !== pairId);
          } else {
            arr.splice(i, 1);
          }
          return true;
        }
      }
    }

    // Check strings
    for (let i = this.strings.length - 1; i >= 0; i--) {
      const s = this.strings[i];
      const cp = closestPointOnSegment(x, y, s.x1, s.y1, s.x2, s.y2);
      if (cp.distance <= tolerance * 0.75) {
        this.strings.splice(i, 1);
        return true;
      }
    }
    return false;
  }

  /**
   * Pick an interactive element at (x, y) for drag-moving or rotating.
   */
  pickAt(x, y, tolerance = 26) {
    for (const em of this.emitters) {
      if (dist(x, y, em.x, em.y) <= Math.max(22, tolerance)) return { type: 'emitter', item: em };
    }
    for (const b of this.bumpers) {
      if (dist(x, y, b.x, b.y) <= b.radius + 8) return { type: 'bumper', item: b };
    }
    for (const w of this.wells) {
      if (dist(x, y, w.x, w.y) <= w.radius + 10) return { type: 'well', item: w };
    }
    for (const p of this.portals) {
      if (dist(x, y, p.x, p.y) <= p.radius + 8) return { type: 'portal', item: p };
    }
    for (const pr of this.prisms) {
      if (dist(x, y, pr.x, pr.y) <= pr.radius + 8) return { type: 'prism', item: pr };
    }
    for (const s of this.strings) {
      if (dist(x, y, s.x1, s.y1) <= 16) return { type: 'stringEnd1', item: s };
      if (dist(x, y, s.x2, s.y2) <= 16) return { type: 'stringEnd2', item: s };
      const cp = closestPointOnSegment(x, y, s.x1, s.y1, s.x2, s.y2);
      if (cp.distance <= 14) return { type: 'stringBody', item: s, offsetX: x - s.x1, offsetY: y - s.y1 };
    }
    return null;
  }

  step(rawDt) {
    const clampedDt = Math.min(rawDt, 0.05);
    const dt = clampedDt * this.settings.timeScale;
    this.simTime += dt;

    // 1. Update tempo-synced emitters
    const secPerBeat = 60 / Math.max(40, this.settings.bpm);
    for (const em of this.emitters) {
      em.pulse = Math.max(0, em.pulse - clampedDt * 3.2);
      if (!em.enabled) continue;
      em.timer += dt;
      const interval = secPerBeat * (em.beatDiv || 1);
      if (em.timer >= interval) {
        em.timer -= interval;
        this.spawnFromEmitter(em);
      }
    }

    // 2. Decay object animations
    for (const s of this.strings) {
      s.vibration *= Math.pow(0.03, clampedDt);
      s.vibPhase += clampedDt * 58;
      s.hitFlash = Math.max(0, s.hitFlash - clampedDt * 2.8);
    }
    for (const b of this.bumpers) {
      b.hitFlash = Math.max(0, b.hitFlash - clampedDt * 3.0);
      b.scalePulse = Math.max(0, b.scalePulse - clampedDt * 4.5);
    }
    for (const w of this.wells) {
      w.spin += dt * (w.strength >= 0 ? 1.8 : -2.2);
    }
    for (const p of this.portals) {
      p.pulse = Math.max(0, p.pulse - clampedDt * 2.6);
    }
    for (const pr of this.prisms) {
      pr.hitFlash = Math.max(0, pr.hitFlash - clampedDt * 3.0);
      pr.angle += dt * 0.85;
    }

    // 3. Sub-stepped orb physics for crisp fast collisions
    const subSteps = 2;
    const subDt = dt / subSteps;
    const maxSpeed = 1050;
    const newlySplitOrbs = [];

    for (let stepIdx = 0; stepIdx < subSteps; stepIdx++) {
      for (let i = this.orbs.length - 1; i >= 0; i--) {
        const orb = this.orbs[i];
        orb.age += subDt;
        orb.portalCooldown = Math.max(0, orb.portalCooldown - subDt);
        orb.prismCooldown = Math.max(0, orb.prismCooldown - subDt);
        if (orb.lastHitTimer > 0) {
          orb.lastHitTimer -= subDt;
          if (orb.lastHitTimer <= 0) orb.lastHitId = null;
        }

        // Global gravity
        orb.vy += this.settings.gravity * subDt;

        // Gravity wells (softened 2D orbital gravity for stable curving trajectories)
        for (const w of this.wells) {
          const dx = w.x - orb.x;
          const dy = w.y - orb.y;
          const distSq = dx * dx + dy * dy;
          const d = Math.sqrt(distSq);
          if (d > 10 && d < 540) {
            const softened = Math.max(distSq, 3600);
            const force = (w.strength * 52) / softened;
            orb.vx += (dx / d) * force * subDt;
            orb.vy += (dy / d) * force * subDt;
          }
        }

        // Subtle air drag & speed clamp
        const spd = Math.hypot(orb.vx, orb.vy);
        if (spd > maxSpeed) {
          const factor = maxSpeed / spd;
          orb.vx *= factor;
          orb.vy *= factor;
        }

        orb.x += orb.vx * subDt;
        orb.y += orb.vy * subDt;

        // Collide with Strings
        for (const s of this.strings) {
          const cp = closestPointOnSegment(orb.x, orb.y, s.x1, s.y1, s.x2, s.y2);
          const hitDist = orb.radius + 4;
          if (cp.distance <= hitDist) {
            let nx = orb.x - cp.x;
            let ny = orb.y - cp.y;
            const nLen = Math.hypot(nx, ny);
            if (nLen < 1e-4) {
              // Fallback normal perpendicular to segment
              const sdx = s.x2 - s.x1;
              const sdy = s.y2 - s.y1;
              const sl = Math.hypot(sdx, sdy) || 1;
              nx = -sdy / sl;
              ny = sdx / sl;
            } else {
              nx /= nLen;
              ny /= nLen;
            }

            const vn = orb.vx * nx + orb.vy * ny;
            if (vn < 0) {
              // Reflect velocity
              const rest = s.restitution ?? 0.94;
              orb.vx -= (1 + rest) * vn * nx;
              orb.vy -= (1 + rest) * vn * ny;
              // Push out of penetration
              orb.x = cp.x + nx * (hitDist + 0.5);
              orb.y = cp.y + ny * (hitDist + 0.5);

              if (orb.lastHitId !== s.id || orb.lastHitTimer <= 0) {
                const segLen = dist(s.x1, s.y1, s.x2, s.y2);
                const baseMidi = lengthToMidi(segLen, this.settings.scaleId, this.settings.rootMidi);
                const midi = Math.max(36, Math.min(96, baseMidi + (orb.pitchOffset || 0)));
                const color = pitchToColor(midi, s.instrument);
                const impactVel = Math.abs(vn);

                orb.color = color;
                orb.lastHitId = s.id;
                orb.lastHitTimer = 0.06;

                s.vibration = Math.min(18, 4 + impactVel * 0.032);
                s.vibPhase = 0;
                s.hitFlash = 1;
                s.hitT = cp.t;

                this.emitNoteTrigger(cp.x, cp.y, midi, s.instrument, impactVel, color);
              }
            }
          }
        }

        // Collide with Bumpers
        for (const b of this.bumpers) {
          const dx = orb.x - b.x;
          const dy = orb.y - b.y;
          const d = Math.hypot(dx, dy);
          const minDist = orb.radius + b.radius;
          if (d < minDist && d > 1e-4) {
            const nx = dx / d;
            const ny = dy / d;
            const vn = orb.vx * nx + orb.vy * ny;
            if (vn < 0) {
              const boost = b.boost ?? 1.12;
              orb.vx = (orb.vx - 2 * vn * nx) * boost;
              orb.vy = (orb.vy - 2 * vn * ny) * boost;
              // Ensure lively bounce even for slow orbs
              const postSpd = Math.hypot(orb.vx, orb.vy);
              if (postSpd < 190) {
                orb.vx = nx * 210;
                orb.vy = ny * 210;
              }
              orb.x = b.x + nx * (minDist + 0.5);
              orb.y = b.y + ny * (minDist + 0.5);

              if (orb.lastHitId !== b.id || orb.lastHitTimer <= 0) {
                const baseMidi = radiusToMidi(b.radius, this.settings.scaleId, this.settings.rootMidi);
                const midi = Math.max(36, Math.min(96, baseMidi + (orb.pitchOffset || 0)));
                const color = pitchToColor(midi, b.instrument);
                const impactVel = Math.abs(vn) + 120;

                orb.color = color;
                orb.lastHitId = b.id;
                orb.lastHitTimer = 0.06;

                b.hitFlash = 1;
                b.scalePulse = 1;

                this.emitNoteTrigger(b.x + nx * b.radius, b.y + ny * b.radius, midi, b.instrument, impactVel, color);
              }
            }
          }
        }

        // Wormhole Portals
        if (orb.portalCooldown <= 0) {
          for (const p of this.portals) {
            if (dist(orb.x, orb.y, p.x, p.y) <= p.radius * 0.88) {
              const partner = this.portals.find((other) => other.pairId === p.pairId && other.id !== p.id);
              if (partner) {
                orb.x = partner.x;
                orb.y = partner.y;
                orb.portalCooldown = 0.35;
                orb.trail = [{ x: partner.x, y: partner.y }];
                // Toggle octave shimmer on teleport
                orb.pitchOffset = orb.pitchOffset === 0 ? (p.pitchShift ?? 12) : 0;
                p.pulse = 1;
                partner.pulse = 1;
                this.ripples.push({
                  x: partner.x,
                  y: partner.y,
                  radius: partner.radius * 0.6,
                  maxRadius: partner.radius * 2.5,
                  alpha: 0.9,
                  color: partner.color,
                });
                break;
              }
            }
          }
        }

        // Harmonic Prism Splitters
        if (orb.prismCooldown <= 0 && orb.generation < 2) {
          for (const pr of this.prisms) {
            if (dist(orb.x, orb.y, pr.x, pr.y) <= pr.radius + orb.radius * 0.6) {
              pr.hitFlash = 1;
              const baseAngle = Math.atan2(orb.vy, orb.vx);
              const speed = Math.max(190, Math.hypot(orb.vx, orb.vy) * 1.03);
              const spreadAngle = 0.42;

              // Deflect current orb left and spawn a harmonic twin right
              orb.vx = Math.cos(baseAngle - spreadAngle) * speed;
              orb.vy = Math.sin(baseAngle - spreadAngle) * speed;
              orb.prismCooldown = 0.4;
              orb.generation += 1;

              const twinColor = pitchToColor(this.settings.rootMidi + 16, pr.instrument);
              newlySplitOrbs.push({
                x: pr.x + Math.cos(baseAngle + spreadAngle) * (pr.radius + 6),
                y: pr.y + Math.sin(baseAngle + spreadAngle) * (pr.radius + 6),
                vx: Math.cos(baseAngle + spreadAngle) * speed,
                vy: Math.sin(baseAngle + spreadAngle) * speed,
                color: twinColor,
                pitchOffset: 7, // Fifth harmony!
                generation: orb.generation,
                maxAge: Math.min(orb.maxAge - orb.age + 4, 10),
                prismCooldown: 0.4,
              });

              const midi = radiusToMidi(pr.radius, this.settings.scaleId, this.settings.rootMidi) + 7;
              this.emitNoteTrigger(pr.x, pr.y, midi, pr.instrument, speed, twinColor);
              break;
            }
          }
        }

        // Remove expired or far off-screen orbs
        const margin = 160;
        if (
          orb.age >= orb.maxAge ||
          orb.x < -margin ||
          orb.x > this.width + margin ||
          orb.y < -margin ||
          orb.y > this.height + margin
        ) {
          this.orbs.splice(i, 1);
        }
      }
    }

    // Add newly split orbs
    for (const o of newlySplitOrbs) {
      this.spawnOrb(o.x, o.y, o.vx, o.vy, o);
    }

    // Record orb trails once per frame
    for (const orb of this.orbs) {
      orb.trail.push({ x: orb.x, y: orb.y });
      if (orb.trail.length > 22) orb.trail.shift();
    }

    // Update transient FX
    for (let i = this.ripples.length - 1; i >= 0; i--) {
      const r = this.ripples[i];
      r.radius += (r.maxRadius - r.radius) * Math.min(1, clampedDt * 8.5);
      r.alpha -= clampedDt * 2.1;
      if (r.alpha <= 0.02) this.ripples.splice(i, 1);
    }

    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const sp = this.sparks[i];
      sp.x += sp.vx * clampedDt;
      sp.y += sp.vy * clampedDt;
      sp.vx *= 0.94;
      sp.vy *= 0.94;
      sp.life -= clampedDt;
      if (sp.life <= 0) this.sparks.splice(i, 1);
    }

    for (let i = this.floatingNotes.length - 1; i >= 0; i--) {
      const fn = this.floatingNotes[i];
      fn.y -= clampedDt * 34;
      fn.alpha -= clampedDt * 1.35;
      if (fn.alpha <= 0.02) this.floatingNotes.splice(i, 1);
    }
  }
}
