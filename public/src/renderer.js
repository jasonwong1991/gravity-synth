/**
 * High-DPI Neon Space Canvas Renderer
 * Renders spacetime-warped grid, starfield, vibrating musical strings,
 * glowing bumpers, black-hole gravity wells, linked portals, prisms, comet orbs,
 * floating note labels, and live FFT audio spectrum.
 */

import { INSTRUMENTS, lengthToMidi, radiusToMidi, midiToLabel, pitchToColor } from './harmony.js';
import { dist } from './physics.js';

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.width = 1200;
    this.height = 720;
    this.dpr = 1;
    this.stars = [];
    this.fftBins = new Uint8Array(128);
    this._generateStars();
  }

  _generateStars() {
    this.stars = [];
    for (let i = 0; i < 85; i++) {
      this.stars.push({
        x: Math.random(),
        y: Math.random(),
        r: 0.6 + Math.random() * 1.4,
        phase: Math.random() * Math.PI * 2,
        speed: 0.4 + Math.random() * 1.2,
      });
    }
  }

  resize(width, height) {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.width = Math.max(320, width);
    this.height = Math.max(240, height);
    this.canvas.width = Math.floor(this.width * this.dpr);
    this.canvas.height = Math.floor(this.height * this.dpr);
    this.canvas.style.width = `${this.width}px`;
    this.canvas.style.height = `${this.height}px`;
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  }

  render(world, audio, interaction, nowSec) {
    const ctx = this.ctx;
    const W = this.width;
    const H = this.height;

    // 1. Deep Cosmic Background
    const bgGrad = ctx.createRadialGradient(W * 0.5, H * 0.45, 40, W * 0.5, H * 0.5, Math.max(W, H) * 0.78);
    bgGrad.addColorStop(0, '#0f172a');
    bgGrad.addColorStop(0.55, '#090d1b');
    bgGrad.addColorStop(1, '#04060d');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, W, H);

    // 2. Subtle Twinkling Starfield
    for (const st of this.stars) {
      const alpha = 0.18 + 0.35 * (0.5 + 0.5 * Math.sin(nowSec * st.speed + st.phase));
      ctx.fillStyle = `rgba(186, 230, 253, ${alpha.toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(st.x * W, st.y * H, st.r, 0, Math.PI * 2);
      ctx.fill();
    }

    // 3. Spacetime Grid (warped gently by Gravity Wells!)
    this._drawWarpedGrid(ctx, world, W, H);

    // 4. Live Bottom Audio Spectrum Visualizer
    if (audio && audio.getFrequencyData(this.fftBins)) {
      this._drawSpectrum(ctx, W, H);
    }

    // 5. Portal Pair Tethers
    this._drawPortalLinks(ctx, world.portals, nowSec);

    // 6. Gravity Wells
    for (const w of world.wells) {
      this._drawWell(ctx, w, nowSec);
    }

    // 7. Portals
    for (const p of world.portals) {
      this._drawPortal(ctx, p, nowSec);
    }

    // 8. Prisms
    for (const pr of world.prisms) {
      this._drawPrism(ctx, pr);
    }

    // 9. Strings (vibrating physical sine wave!)
    for (const s of world.strings) {
      this._drawString(ctx, s, world.settings);
    }

    // 10. Bumpers
    for (const b of world.bumpers) {
      this._drawBumper(ctx, b, world.settings);
    }

    // 11. Emitters
    for (const em of world.emitters) {
      this._drawEmitter(ctx, em);
    }

    // 12. Ripples & Sparks
    for (const r of world.ripples) {
      ctx.save();
      ctx.strokeStyle = r.color;
      ctx.globalAlpha = Math.max(0, r.alpha);
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    for (const sp of world.sparks) {
      ctx.save();
      ctx.fillStyle = sp.color;
      ctx.globalAlpha = Math.max(0, sp.life / sp.maxLife);
      ctx.beginPath();
      ctx.arc(sp.x, sp.y, sp.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 13. Orbs & Luminous Comet Trails
    for (const orb of world.orbs) {
      this._drawOrb(ctx, orb);
    }

    // 14. Floating Note Labels
    ctx.save();
    ctx.font = '600 11px ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.textAlign = 'center';
    for (const fn of world.floatingNotes) {
      ctx.globalAlpha = Math.max(0, fn.alpha);
      ctx.fillStyle = fn.color;
      ctx.fillText(fn.label, fn.x, fn.y);
    }
    ctx.restore();

    // 15. Interactive Tool Ghost Preview
    if (interaction) {
      this._drawInteractionPreview(ctx, interaction, world.settings);
    }
  }

  _warpPoint(x, y, wells) {
    let wx = x;
    let wy = y;
    for (const w of wells) {
      const dx = w.x - wx;
      const dy = w.y - wy;
      const d = Math.hypot(dx, dy);
      if (d > 14 && d < 240) {
        const pull = (w.strength >= 0 ? 1 : -1) * Math.min(24, (1 - d / 240) * 28);
        wx += (dx / d) * pull;
        wy += (dy / d) * pull;
      }
    }
    return { x: wx, y: wy };
  }

  _drawWarpedGrid(ctx, world, W, H) {
    const spacing = 54;
    ctx.save();
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.055)';
    ctx.lineWidth = 1;

    const cols = Math.ceil(W / spacing);
    const rows = Math.ceil(H / spacing);
    const hasWells = world.wells.length > 0;

    if (!hasWells) {
      ctx.beginPath();
      for (let c = 1; c < cols; c++) {
        ctx.moveTo(c * spacing, 0);
        ctx.lineTo(c * spacing, H);
      }
      for (let r = 1; r < rows; r++) {
        ctx.moveTo(0, r * spacing);
        ctx.lineTo(W, r * spacing);
      }
      ctx.stroke();
    } else {
      for (let r = 1; r < rows; r++) {
        ctx.beginPath();
        for (let c = 0; c <= cols; c++) {
          const p = this._warpPoint(c * spacing, r * spacing, world.wells);
          if (c === 0) ctx.moveTo(p.x, p.y);
          else ctx.lineTo(p.x, p.y);
        }
        ctx.stroke();
      }
      for (let c = 1; c < cols; c++) {
        ctx.beginPath();
        for (let r = 0; r <= rows; r++) {
          const p = this._warpPoint(c * spacing, r * spacing, world.wells);
          if (r === 0) ctx.moveTo(p.x, p.y);
          else ctx.lineTo(p.x, p.y);
        }
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  _drawSpectrum(ctx, W, H) {
    const barCount = 56;
    const barW = W / barCount;
    ctx.save();
    for (let i = 0; i < barCount; i++) {
      const bin = this.fftBins[Math.floor((i / barCount) * 72)] || 0;
      const ratio = bin / 255;
      const barH = ratio * 92;
      if (barH < 1) continue;
      const hue = 195 + (i / barCount) * 125;
      ctx.fillStyle = `hsla(${hue}, 90%, 62%, ${(0.08 + ratio * 0.22).toFixed(3)})`;
      ctx.fillRect(i * barW + 2, H - barH, Math.max(2, barW - 4), barH);
    }
    ctx.restore();
  }

  _drawPortalLinks(ctx, portals, nowSec) {
    const drawn = new Set();
    ctx.save();
    for (const p of portals) {
      if (drawn.has(p.pairId)) continue;
      const partner = portals.find((o) => o.pairId === p.pairId && o.id !== p.id);
      if (!partner) continue;
      drawn.add(p.pairId);

      ctx.strokeStyle = p.color;
      ctx.globalAlpha = 0.22;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 8]);
      ctx.lineDashOffset = -nowSec * 28;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(partner.x, partner.y);
      ctx.stroke();
    }
    ctx.restore();
  }

  _drawWell(ctx, w, nowSec) {
    const isAttract = w.strength >= 0;
    const primary = isAttract ? '#c084fc' : '#fb923c';
    const glow = isAttract ? 'rgba(168, 85, 247, 0.25)' : 'rgba(251, 146, 60, 0.25)';

    ctx.save();
    // Outer gravity aura
    const aura = ctx.createRadialGradient(w.x, w.y, 4, w.x, w.y, 88);
    aura.addColorStop(0, glow);
    aura.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = aura;
    ctx.beginPath();
    ctx.arc(w.x, w.y, 88, 0, Math.PI * 2);
    ctx.fill();

    // Spinning accretion arcs
    ctx.strokeStyle = primary;
    ctx.lineWidth = 1.8;
    for (let ring = 0; ring < 3; ring++) {
      const r = 18 + ring * 13;
      const start = w.spin * (1 + ring * 0.35) + ring * 2.1;
      ctx.globalAlpha = 0.65 - ring * 0.16;
      ctx.beginPath();
      ctx.arc(w.x, w.y, r, start, start + Math.PI * 1.15);
      ctx.stroke();
    }

    // Event horizon core
    ctx.globalAlpha = 1;
    ctx.fillStyle = isAttract ? '#090616' : '#1f1008';
    ctx.beginPath();
    ctx.arc(w.x, w.y, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = primary;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Symbol (+/-)
    ctx.fillStyle = primary;
    ctx.font = 'bold 12px ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(isAttract ? '●' : '✦', w.x, w.y + 0.5);
    ctx.restore();
  }

  _drawPortal(ctx, p, nowSec) {
    const r = p.radius + p.pulse * 6;
    ctx.save();
    ctx.shadowColor = p.color;
    ctx.shadowBlur = 16 + p.pulse * 12;

    ctx.strokeStyle = p.color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.stroke();

    // Inner swirling vortex
    ctx.lineWidth = 1.6;
    ctx.globalAlpha = 0.75;
    for (let i = 0; i < 2; i++) {
      const a = nowSec * 3.2 + i * Math.PI;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r * 0.62, a, a + 1.8);
      ctx.stroke();
    }

    ctx.fillStyle = 'rgba(8, 15, 32, 0.72)';
    ctx.beginPath();
    ctx.arc(p.x, p.y, r * 0.48, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  _drawPrism(ctx, pr) {
    const r = pr.radius + pr.hitFlash * 5;
    ctx.save();
    ctx.translate(pr.x, pr.y);
    ctx.rotate(pr.angle);

    const color = pr.hitFlash > 0.1 ? '#ffffff' : '#67e8f9';
    ctx.shadowColor = '#22d3ee';
    ctx.shadowBlur = 12 + pr.hitFlash * 16;

    ctx.beginPath();
    for (let i = 0; i < 3; i++) {
      const a = (i * Math.PI * 2) / 3 - Math.PI / 2;
      const px = Math.cos(a) * r;
      const py = Math.sin(a) * r;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();

    ctx.fillStyle = `rgba(34, 211, 238, ${(0.18 + pr.hitFlash * 0.45).toFixed(2)})`;
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.4;
    ctx.stroke();
    ctx.restore();
  }

  _drawString(ctx, s, settings) {
    const len = dist(s.x1, s.y1, s.x2, s.y2);
    const midi = lengthToMidi(len, settings.scaleId, settings.rootMidi);
    const color = pitchToColor(midi, s.instrument);

    const dx = s.x2 - s.x1;
    const dy = s.y2 - s.y1;
    const invLen = 1 / Math.max(1, len);
    const nx = -dy * invLen;
    const ny = dx * invLen;

    const midT = s.hitT ?? 0.5;
    const amp = s.vibration * Math.sin(s.vibPhase);
    const cx = s.x1 + dx * midT + nx * amp * 1.9;
    const cy = s.y1 + dy * midT + ny * amp * 1.9;

    ctx.save();
    ctx.shadowColor = color;
    ctx.shadowBlur = 10 + s.hitFlash * 18;
    ctx.strokeStyle = s.hitFlash > 0.35 ? '#ffffff' : color;
    ctx.lineWidth = 3 + s.hitFlash * 2.5;
    ctx.lineCap = 'round';

    ctx.beginPath();
    ctx.moveTo(s.x1, s.y1);
    ctx.quadraticCurveTo(cx, cy, s.x2, s.y2);
    ctx.stroke();

    // Anchor pegs
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#0f172a';
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    for (const [px, py] of [[s.x1, s.y1], [s.x2, s.y2]]) {
      ctx.beginPath();
      ctx.arc(px, py, 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    // Subtle pitch tag at midpoint when glowing
    if (s.hitFlash > 0.15) {
      ctx.globalAlpha = Math.min(1, s.hitFlash * 1.2);
      ctx.fillStyle = '#f8fafc';
      ctx.font = '600 10px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.fillText(midiToLabel(midi), (s.x1 + s.x2) * 0.5, (s.y1 + s.y2) * 0.5 - 10);
    }
    ctx.restore();
  }

  _drawBumper(ctx, b, settings) {
    const midi = radiusToMidi(b.radius, settings.scaleId, settings.rootMidi);
    const color = pitchToColor(midi, b.instrument);
    const r = b.radius * (1 + b.scalePulse * 0.22);

    ctx.save();
    ctx.shadowColor = color;
    ctx.shadowBlur = 12 + b.hitFlash * 18;

    const grad = ctx.createRadialGradient(b.x, b.y, 2, b.x, b.y, r);
    grad.addColorStop(0, b.hitFlash > 0.3 ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.22)');
    grad.addColorStop(0.7, 'rgba(15, 23, 42, 0.72)');
    grad.addColorStop(1, color);

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(b.x, b.y, r, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = b.hitFlash > 0.35 ? '#ffffff' : color;
    ctx.lineWidth = 2.6;
    ctx.stroke();

    // Inner label
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(248, 250, 252, 0.85)';
    ctx.font = '600 10px ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const label = b.instrument === 'drum' ? (midi < 56 ? 'KICK' : midi < 68 ? 'SNR' : 'HAT') : midiToLabel(midi);
    ctx.fillText(label, b.x, b.y);
    ctx.restore();
  }

  _drawEmitter(ctx, em) {
    const inst = INSTRUMENTS[em.instrument] || INSTRUMENTS.crystal;
    const color = inst.color;
    const r = 14 + em.pulse * 4;

    ctx.save();
    ctx.translate(em.x, em.y);

    // Direction nozzle indicator
    const nx = Math.cos(em.angle) * (r + 13);
    const ny = Math.sin(em.angle) * (r + 13);
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.75;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(Math.cos(em.angle) * r, Math.sin(em.angle) * r);
    ctx.lineTo(nx, ny);
    ctx.stroke();

    // Arrow head
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(nx, ny, 3.2, 0, Math.PI * 2);
    ctx.fill();

    // Emitter body
    ctx.globalAlpha = 1;
    ctx.shadowColor = color;
    ctx.shadowBlur = 12 + em.pulse * 12;
    ctx.fillStyle = '#0b1224';
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = em.enabled ? color : '#64748b';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Beat division dot
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#f8fafc';
    ctx.font = '700 9px ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const divLabel = em.beatDiv === 0.5 ? '1/8' : em.beatDiv === 1 ? '1/4' : em.beatDiv === 2 ? '1/2' : `${em.beatDiv}x`;
    ctx.fillText(divLabel, 0, 0.5);
    ctx.restore();
  }

  _drawOrb(ctx, orb) {
    const trail = orb.trail;
    if (trail.length > 1) {
      ctx.save();
      ctx.lineCap = 'round';
      for (let i = 1; i < trail.length; i++) {
        const ratio = i / trail.length;
        ctx.strokeStyle = orb.color;
        ctx.globalAlpha = ratio * 0.52;
        ctx.lineWidth = orb.radius * 1.45 * ratio;
        ctx.beginPath();
        ctx.moveTo(trail[i - 1].x, trail[i - 1].y);
        ctx.lineTo(trail[i].x, trail[i].y);
        ctx.stroke();
      }
      ctx.restore();
    }

    ctx.save();
    ctx.shadowColor = orb.color;
    ctx.shadowBlur = 14;
    ctx.fillStyle = orb.color;
    ctx.beginPath();
    ctx.arc(orb.x, orb.y, orb.radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(orb.x, orb.y, orb.radius * 0.48, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  _drawInteractionPreview(ctx, inter, settings) {
    if (!inter.isDrawing && !inter.pendingPortal) return;

    ctx.save();
    ctx.setLineDash([5, 5]);

    if (inter.pendingPortal) {
      ctx.strokeStyle = inter.pendingPortal.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(inter.pendingPortal.x, inter.pendingPortal.y);
      ctx.lineTo(inter.curX, inter.curY);
      ctx.stroke();
    }

    if (inter.isDrawing) {
      const { tool, startX, startY, curX, curY, instrument } = inter;
      if (tool === 'string') {
        const len = dist(startX, startY, curX, curY);
        const midi = lengthToMidi(len, settings.scaleId, settings.rootMidi);
        const color = pitchToColor(midi, instrument);
        ctx.strokeStyle = color;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.lineTo(curX, curY);
        ctx.stroke();

        ctx.setLineDash([]);
        ctx.fillStyle = '#f8fafc';
        ctx.font = '600 12px ui-monospace, monospace';
        ctx.textAlign = 'center';
        ctx.fillText(midiToLabel(midi), (startX + curX) * 0.5, (startY + curY) * 0.5 - 12);
      } else if (tool === 'emitter') {
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.arc(startX, startY, 14, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.lineTo(curX, curY);
        ctx.stroke();
      } else if (tool === 'bumper') {
        const r = Math.max(14, Math.min(54, dist(startX, startY, curX, curY) || 26));
        const midi = radiusToMidi(r, settings.scaleId, settings.rootMidi);
        const color = pitchToColor(midi, instrument);
        ctx.strokeStyle = color;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(startX, startY, r, 0, Math.PI * 2);
        ctx.stroke();

        ctx.setLineDash([]);
        ctx.fillStyle = '#f8fafc';
        ctx.font = '600 11px ui-monospace, monospace';
        ctx.textAlign = 'center';
        ctx.fillText(midiToLabel(midi), startX, startY);
      } else if (tool === 'orb') {
        ctx.strokeStyle = '#f472b6';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.lineTo(curX, curY);
        ctx.stroke();
      }
    }
    ctx.restore();
  }
}
