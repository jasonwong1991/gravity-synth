#!/usr/bin/env python3
"""
GravitySynth HD Demo Video & Stereo Audio Renderer
1. Synthesizes studio-grade 44.1kHz stereo WAV from exact PhysicsWorld note triggers
   (FM Crystal, Pluck Harp, Cyberpunk Synth, Kalimba, 808 Drums + Ping-Pong Delay + Reverb + Limiter).
2. Computes frame-aligned FFT audio spectrum bars directly from the synthesized WAV.
3. Renders 1280x720 @ 30fps neon visuals with genuine additive Gaussian bloom, warped spacetime grid,
   vibrating strings, comet trails, glassmorphism HUD, bilingual subtitles, and Intro/Outro cards.
4. Pipes frames directly to ffmpeg (H.264 + AAC) -> demo/gravity-synth-demo.mp4.
"""

import json
import math
import os
import re
import subprocess
import sys
import colorsys
import numpy as np
from scipy.signal import fftconvolve, butter, lfilter
from scipy.io import wavfile
from PIL import Image, ImageDraw, ImageFilter, ImageFont

LANG = "en" if os.environ.get("DEMO_LANG", "zh").lower() == "en" else "zh"

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEMO_DIR = os.path.join(ROOT_DIR, "demo")
SIM_JSON = os.path.join(DEMO_DIR, "sim_data_en.json" if LANG == "en" else "sim_data.json")
WAV_OUT = os.path.join(DEMO_DIR, "demo_audio_en.wav" if LANG == "en" else "demo_audio.wav")
MP4_OUT = os.path.join(DEMO_DIR, "gravity-synth-demo-en.mp4" if LANG == "en" else "gravity-synth-demo.mp4")

PREVIEW_DIR = os.environ.get("PREVIEW_DIR", "")

SR = 44100

FONT_CJK_BOLD = "/System/Library/Fonts/STHeiti Medium.ttc"
FONT_CJK_REG = "/System/Library/Fonts/Hiragino Sans GB.ttc"
FONT_MONO = "/System/Library/Fonts/SFNSMono.ttf"
FONT_SANS = "/System/Library/Fonts/SFNS.ttf"


def load_font(path, size):
    try:
        return ImageFont.truetype(path, size)
    except Exception:
        return ImageFont.load_default()


def parse_color(c_str):
    """Convert hex (#rrggbb) or hsl(h, s%, l%) to (R, G, B) tuple."""
    if not c_str:
        return (56, 189, 248)
    c_str = c_str.strip()
    if c_str.startswith("#"):
        h = c_str[1:]
        if len(h) == 3:
            h = "".join(ch * 2 for ch in h)
        return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16))
    m = re.match(r"hsl\(\s*([\d.]+)\s*,\s*([\d.]+)%\s*,\s*([\d.]+)%\s*\)", c_str)
    if m:
        hue = (float(m.group(1)) % 360.0) / 360.0
        sat = float(m.group(2)) / 100.0
        lit = float(m.group(3)) / 100.0
        r, g, b = colorsys.hls_to_rgb(hue, lit, sat)
        return (int(r * 255), int(g * 255), int(b * 255))
    return (56, 189, 248)


def midi_to_freq(midi):
    return 440.0 * (2.0 ** ((midi - 69.0) / 12.0))


def synthesize_audio(events, total_duration):
    """Synthesize lush 44.1kHz stereo audio with 5 voices, ping-pong delay, reverb & soft limiter."""
    n_samples = int(math.ceil((total_duration + 0.5) * SR))
    dry = np.zeros((n_samples, 2), dtype=np.float32)

    rng = np.random.default_rng(42)

    for ev in events:
        t0 = float(ev["t"])
        if t0 < 0 or t0 >= total_duration:
            continue
        start_idx = int(t0 * SR)
        midi = float(ev["midi"])
        inst = ev.get("instrument", "crystal")
        vel = max(0.15, min(1.0, float(ev.get("velocity", 0.7))))
        pan = max(-0.9, min(0.9, float(ev.get("pan", 0.0))))
        freq = midi_to_freq(midi)

        if inst == "drum":
            if midi < 56:
                dur = 0.36
                n = int(dur * SR)
                t = np.arange(n, dtype=np.float32) / SR
                f_curve = 42.0 + 108.0 * np.exp(-t * 28.0)
                phase = 2.0 * np.pi * np.cumsum(f_curve) / SR
                sig = np.sin(phase) * np.exp(-t * 9.5) * (0.48 * vel)
            elif midi < 68:
                dur = 0.22
                n = int(dur * SR)
                t = np.arange(n, dtype=np.float32) / SR
                noise = rng.standard_normal(n).astype(np.float32)
                b, a = butter(2, [900 / (SR / 2), 4500 / (SR / 2)], btype="band")
                snare_n = lfilter(b, a, noise) * np.exp(-t * 18.0) * (0.30 * vel)
                body = np.sin(2.0 * np.pi * (120.0 + 95.0 * np.exp(-t * 32.0)) * t) * np.exp(-t * 22.0) * (0.24 * vel)
                sig = snare_n + body
            else:
                dur = 0.10
                n = int(dur * SR)
                t = np.arange(n, dtype=np.float32) / SR
                noise = rng.standard_normal(n).astype(np.float32)
                b, a = butter(2, 6500 / (SR / 2), btype="high")
                sig = lfilter(b, a, noise) * np.exp(-t * 38.0) * (0.16 * vel)
        elif inst == "crystal":
            dur = 1.45
            n = int(dur * SR)
            t = np.arange(n, dtype=np.float32) / SR
            attack = np.minimum(1.0, t / 0.008)
            env = attack * np.exp(-t * 3.6)
            mod_idx = (1.1 * vel) * np.exp(-t * 9.0)
            sig = np.sin(2.0 * np.pi * freq * t + mod_idx * np.sin(2.0 * np.pi * (freq * 2.0) * t)) * env * (0.24 * vel)
        elif inst == "pluck":
            dur = 1.15
            n = int(dur * SR)
            t = np.arange(n, dtype=np.float32) / SR
            attack = np.minimum(1.0, t / 0.006)
            env = attack * np.exp(-t * 4.4)
            harm = (
                np.sin(2.0 * np.pi * freq * t)
                + 0.42 * np.exp(-t * 7.0) * np.sin(2.0 * np.pi * freq * 2.0 * t)
                + 0.22 * np.exp(-t * 12.0) * np.sin(2.0 * np.pi * freq * 3.004 * t)
                + 0.10 * np.exp(-t * 18.0) * np.sin(2.0 * np.pi * freq * 4.0 * t)
            )
            sig = harm * env * (0.22 * vel)
        elif inst == "synth":
            dur = 1.35
            n = int(dur * SR)
            t = np.arange(n, dtype=np.float32) / SR
            attack = np.minimum(1.0, t / 0.018)
            env = attack * np.exp(-t * 3.2)
            # Warm detuned supersaw-lite via additive harmonics
            s = np.zeros(n, dtype=np.float32)
            for k in range(1, 6):
                decay_k = np.exp(-t * (1.2 + k * 1.4))
                s += (1.0 / k) * decay_k * (
                    np.sin(2.0 * np.pi * freq * 0.996 * k * t)
                    + np.sin(2.0 * np.pi * freq * 1.005 * k * t)
                )
            sig = s * env * (0.12 * vel)
        else:  # kalimba
            dur = 0.85
            n = int(dur * SR)
            t = np.arange(n, dtype=np.float32) / SR
            attack = np.minimum(1.0, t / 0.005)
            env = attack * np.exp(-t * 5.2)
            sig = (
                np.sin(2.0 * np.pi * freq * t) * env
                + 0.26 * np.sin(2.0 * np.pi * freq * 2.98 * t) * np.exp(-t * 35.0)
            ) * (0.26 * vel)

        end_idx = min(n_samples, start_idx + len(sig))
        seg_len = end_idx - start_idx
        if seg_len <= 0:
            continue
        # Equal-power stereo panning
        ang = (pan + 1.0) * (np.pi / 4.0)
        gl = math.cos(ang)
        gr = math.sin(ang)
        dry[start_idx:end_idx, 0] += sig[:seg_len] * gl
        dry[start_idx:end_idx, 1] += sig[:seg_len] * gr

    # Stereo Ping-Pong Delay
    delay_buf = np.zeros_like(dry)
    d_l = int(0.265 * SR)
    d_r = int(0.395 * SR)
    tap_l = dry.copy()
    for step in range(4):
        gain = 0.30 * (0.48 ** step)
        shift_l = d_l + step * (d_l + d_r) // 2
        shift_r = d_r + step * (d_l + d_r) // 2
        if shift_l < n_samples:
            delay_buf[shift_l:, 0] += tap_l[: n_samples - shift_l, 1] * gain
        if shift_r < n_samples:
            delay_buf[shift_r:, 1] += tap_l[: n_samples - shift_r, 0] * gain

    # Algorithmic Stereo Convolution Reverb
    rev_len = int(2.1 * SR)
    t_rev = np.arange(rev_len, dtype=np.float32) / SR
    ir_env = ((1.0 - t_rev / 2.1) ** 2.7) * 0.14
    ir_l = rng.standard_normal(rev_len).astype(np.float32) * ir_env
    ir_r = rng.standard_normal(rev_len).astype(np.float32) * ir_env
    # Gently soften high frequencies in reverb tail
    b_lp, a_lp = butter(2, 4200 / (SR / 2), btype="low")
    ir_l = lfilter(b_lp, a_lp, ir_l)
    ir_r = lfilter(b_lp, a_lp, ir_r)

    rev_l = fftconvolve(dry[:, 0], ir_l, mode="full")[:n_samples]
    rev_r = fftconvolve(dry[:, 1], ir_r, mode="full")[:n_samples]

    mix = np.zeros_like(dry)
    mix[:, 0] = dry[:, 0] * 0.85 + delay_buf[:, 0] * 0.34 + rev_l * 0.42
    mix[:, 1] = dry[:, 1] * 0.85 + delay_buf[:, 1] * 0.34 + rev_r * 0.42

    # Trim exact duration & apply gentle fade-in / fade-out + soft tanh master limiter
    target_len = int(total_duration * SR)
    mix = mix[:target_len]
    fade_in = int(0.15 * SR)
    fade_out = int(1.4 * SR)
    mix[:fade_in] *= np.linspace(0, 1, fade_in, dtype=np.float32)[:, None]
    mix[-fade_out:] *= np.linspace(1, 0, fade_out, dtype=np.float32)[:, None]

    # Soft limiter for punchy loudness without clipping
    mix = np.tanh(mix * 1.35) * 0.90

    pcm = np.clip(mix * 32767.0, -32768, 32767).astype(np.int16)
    wavfile.write(WAV_OUT, SR, pcm)
    print(f"Synthesized stereo audio: {WAV_OUT} ({total_duration:.1f}s)")
    return mix


def compute_frame_spectrum(audio_stereo, frame_idx, fps, n_bars=48):
    """Compute smooth normalized FFT spectrum bars for a given video frame."""
    center = int((frame_idx / fps) * SR)
    win = 2048
    start = max(0, center - win // 2)
    end = min(len(audio_stereo), start + win)
    chunk = audio_stereo[start:end].mean(axis=1)
    if len(chunk) < win:
        chunk = np.pad(chunk, (0, win - len(chunk)))
    windowed = chunk * np.hanning(win)
    mag = np.abs(np.fft.rfft(windowed))
    # Focus on musical frequency range (bins 2 .. 220 -> ~43Hz .. ~4700Hz)
    bins = np.geomspace(2, 220, n_bars + 1).astype(int)
    bars = np.zeros(n_bars, dtype=np.float32)
    for i in range(n_bars):
        lo, hi = bins[i], max(bins[i] + 1, bins[i + 1])
        val = float(np.mean(mag[lo:hi]))
        bars[i] = min(1.0, math.log1p(val * 0.65) / 3.4)
    return bars


def create_cosmic_backdrop(W, H, wells):
    """Pre-render deep cosmic radial gradient + stars + Einstein-warped grid."""
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    dx = (xx - W * 0.5) / (W * 0.65)
    dy = (yy - H * 0.46) / (H * 0.72)
    dist_norm = np.clip(np.sqrt(dx * dx + dy * dy), 0.0, 1.0)

    c0 = np.array([17, 26, 48], dtype=np.float32)
    c1 = np.array([6, 9, 20], dtype=np.float32)
    bg = c0 * (1.0 - dist_norm[:, :, None]) + c1 * dist_norm[:, :, None]
    img = Image.fromarray(bg.astype(np.uint8), mode="RGB")
    draw = ImageDraw.Draw(img, "RGBA")

    # Subtle twinkling starfield
    rng = np.random.default_rng(108)
    for _ in range(95):
        sx = int(rng.uniform(0, W))
        sy = int(rng.uniform(0, H))
        sr = float(rng.uniform(0.8, 2.0))
        alpha = int(rng.uniform(55, 165))
        draw.ellipse([sx - sr, sy - sr, sx + sr, sy + sr], fill=(186, 230, 253, alpha))

    # Spacetime Grid warped around Gravity Wells
    spacing = 54
    cols = W // spacing + 2
    rows = H // spacing + 2

    def warp(px, py):
        wx, wy = float(px), float(py)
        for w in wells:
            ddx = w["x"] - wx
            ddy = w["y"] - wy
            d = math.hypot(ddx, ddy)
            if 14 < d < 245:
                pull = (1.0 if w["strength"] >= 0 else -1.0) * min(26.0, (1.0 - d / 245.0) * 30.0)
                wx += (ddx / d) * pull
                wy += (ddy / d) * pull
        return (wx, wy)

    grid_col = (148, 163, 184, 22)
    for r in range(1, rows):
        pts = [warp(c * spacing, r * spacing) for c in range(cols)]
        draw.line(pts, fill=grid_col, width=1)
    for c in range(1, cols):
        pts = [warp(c * spacing, r * spacing) for r in range(rows)]
        draw.line(pts, fill=grid_col, width=1)

    return img


def draw_star_icon(draw, cx, cy, r_outer, r_inner, fill):
    """Draw a crisp 4-point vector sparkle icon (avoids missing Unicode glyphs)."""
    pts = []
    for i in range(8):
        ang = i * math.pi / 4.0 - math.pi / 2.0
        r = r_outer if i % 2 == 0 else r_inner
        pts.append((cx + math.cos(ang) * r, cy + math.sin(ang) * r))
    draw.polygon(pts, fill=fill)


def draw_title_card(base_bg, W, H, t, mode="intro", fonts=None):
    """Render sleek cinematic Intro or Outro card with glowing orbital graphic."""
    img = base_bg.copy()
    glow = Image.new("RGB", (W, H), (0, 0, 0))
    gdraw = ImageDraw.Draw(glow)

    cx, cy = W // 2, H // 2 - 18
    # Animated glowing concentric orbital arcs
    for idx, (rad, col, spd) in enumerate([
        (170, (56, 189, 248), 0.7),
        (225, (168, 85, 247), -0.5),
        (280, (244, 63, 94), 0.35),
    ]):
        a0 = math.degrees(t * spd + idx * 1.4) % 360
        gdraw.arc([cx - rad, cy - rad, cx + rad, cy + rad], a0, a0 + 145, fill=col, width=3)
        ox = cx + math.cos(math.radians(a0 + 145)) * rad
        oy = cy + math.sin(math.radians(a0 + 145)) * rad
        gdraw.ellipse([ox - 6, oy - 6, ox + 6, oy + 6], fill=col)

    # Composite glow
    img = blend_glow(img, glow, strength=1.15)
    draw = ImageDraw.Draw(img, "RGBA")

    # Fade factor
    if mode == "intro":
        alpha = min(1.0, t / 0.65) * min(1.0, max(0.0, (4.0 - t) / 0.55))
    else:
        local = t - 44.0
        alpha = min(1.0, local / 0.55) * min(1.0, max(0.0, (4.0 - local) / 0.65))
    a_full = int(255 * alpha)
    a_sub = int(215 * alpha)

    if mode == "intro":
        badge_txt = "FRANKENSTEIN TRACK  |  HACKATHON DEMO"
        bbox = draw.textbbox((0, 0), badge_txt, font=fonts["mono_sm"])
        bw = bbox[2] - bbox[0] + 30
        draw.rounded_rectangle([cx - bw // 2, cy - 115, cx + bw // 2, cy - 83], radius=16,
                               fill=(15, 23, 42, int(205 * alpha)), outline=(56, 189, 248, int(195 * alpha)), width=2)
        draw.text((cx, cy - 99), badge_txt, font=fonts["mono_sm"], fill=(125, 211, 252, a_full), anchor="mm")

        title_txt = "GravitySynth"
        tb = draw.textbbox((0, 0), title_txt, font=fonts["hero_en"])
        tw = tb[2] - tb[0]
        draw_star_icon(draw, cx - tw // 2 - 28, cy - 28, 22, 7, (56, 189, 248, a_full))
        draw.text((cx + 16, cy - 28), title_txt, font=fonts["hero_en"], fill=(248, 250, 252, a_full), anchor="mm")
        if LANG == "en":
            draw.text((cx, cy + 38), "Draw Physics, Play Music", font=fonts["hero_en_sub"], fill=(192, 132, 252, a_full), anchor="mm")
            draw.text((cx, cy + 92), "2D Astrophysics Sandbox  x  Zero-Dependency Web Audio Synthesizer",
                      font=fonts["sub_en"], fill=(203, 213, 225, a_sub), anchor="mm")
        else:
            draw.text((cx, cy + 38), "引 力 音 轨  —  用 物 理 画 音 乐", font=fonts["hero_cn"], fill=(192, 132, 252, a_full), anchor="mm")
            draw.text((cx, cy + 92), "2D 天体引力物理引擎 × 零依赖实时 Web Audio 算法合成器",
                      font=fonts["sub_cn"], fill=(203, 213, 225, a_sub), anchor="mm")
    else:
        if LANG == "en":
            outro_txt = "GravitySynth"
            ob = draw.textbbox((0, 0), outro_txt, font=fonts["hero_en"])
            ow = ob[2] - ob[0]
            draw_star_icon(draw, cx - ow // 2 - 26, cy - 52, 20, 6, (56, 189, 248, a_full))
            draw.text((cx + 14, cy - 52), outro_txt, font=fonts["hero_en"], fill=(248, 250, 252, a_full), anchor="mm")
        else:
            outro_txt = "GravitySynth 引力音轨"
            ob = draw.textbbox((0, 0), outro_txt, font=fonts["hero_cn_lg"])
            ow = ob[2] - ob[0]
            draw_star_icon(draw, cx - ow // 2 - 26, cy - 50, 18, 6, (56, 189, 248, a_full))
            draw.text((cx + 12, cy - 50), outro_txt, font=fonts["hero_cn_lg"], fill=(248, 250, 252, a_full), anchor="mm")
        draw.text((cx, cy + 12), "Draw Physics, Play Music  |  Frankenstein Hackathon Entry",
                  font=fonts["sub_en"], fill=(125, 211, 252, a_full), anchor="mm")
        cmd_txt = "npm start   ->   http://127.0.0.1:3456"
        bbox = draw.textbbox((0, 0), cmd_txt, font=fonts["mono_md"])
        bw = bbox[2] - bbox[0] + 38
        draw.rounded_rectangle([cx - bw // 2, cy + 54, cx + bw // 2, cy + 98], radius=12,
                               fill=(15, 23, 42, int(220 * alpha)), outline=(168, 85, 247, int(200 * alpha)), width=2)
        draw.text((cx, cy + 76), cmd_txt, font=fonts["mono_md"], fill=(241, 245, 249, a_full), anchor="mm")
        footer_txt = (
            "Zero External Dependencies  |  100% Offline Ready  |  Pure Canvas + Web Audio + Node.js"
            if LANG == "en"
            else "零外部依赖 · 全离线稳跑 · 纯原生 Canvas + Web Audio + Node.js"
        )
        draw.text((cx, cy + 132), footer_txt,
                  font=fonts["sub_en"] if LANG == "en" else fonts["sub_cn"], fill=(148, 163, 184, a_sub), anchor="mm")

    return img


def blend_glow(base_img, glow_img, strength=0.95):
    """Fast cinema-grade additive bloom via downsampled Gaussian blur."""
    W, H = base_img.size
    small = glow_img.resize((W // 4, H // 4), Image.Resampling.BILINEAR)
    blurred = small.filter(ImageFilter.GaussianBlur(radius=5.5))
    bloom = blurred.resize((W, H), Image.Resampling.BILINEAR)

    base_arr = np.asarray(base_img, dtype=np.float32)
    glow_arr = np.asarray(glow_img, dtype=np.float32)
    bloom_arr = np.asarray(bloom, dtype=np.float32)

    out = np.clip(base_arr + glow_arr * 0.92 + bloom_arr * strength, 0, 255).astype(np.uint8)
    return Image.fromarray(out, mode="RGB")


def render_live_frame(base_bg, frame, spectrum_bars, fonts, fade_alpha=1.0):
    """Render one HD frame of GravitySynth live physics + spectrum + HUD + subtitles."""
    W, H = base_bg.size
    glow = Image.new("RGB", (W, H), (0, 0, 0))
    gdraw = ImageDraw.Draw(glow)

    # 1. Live bottom FFT audio spectrum
    n_bars = len(spectrum_bars)
    bar_w = W / n_bars
    for i, val in enumerate(spectrum_bars):
        bh = int(val * 105)
        if bh < 2:
            continue
        hue = (195 + (i / n_bars) * 125) / 360.0
        r, g, b = colorsys.hls_to_rgb(hue, 0.56, 0.90)
        col = (int(r * 255 * 0.42), int(g * 255 * 0.42), int(b * 255 * 0.42))
        x0 = int(i * bar_w + 3)
        x1 = int((i + 1) * bar_w - 3)
        gdraw.rectangle([x0, H - bh, max(x0 + 2, x1), H], fill=col)

    # 2. Portal pair link tethers
    drawn_pairs = set()
    portals = frame["portals"]
    for p in portals:
        pid = p["pairId"]
        if pid in drawn_pairs:
            continue
        partners = [o for o in portals if o["pairId"] == pid and o is not p]
        if partners:
            drawn_pairs.add(pid)
            other = partners[0]
            col = tuple(int(c * 0.32) for c in parse_color(p["color"]))
            # Dashed line
            steps = 18
            for k in range(0, steps, 2):
                t0 = k / steps
                t1 = min(1.0, (k + 1) / steps)
                x0 = p["x"] + (other["x"] - p["x"]) * t0
                y0 = p["y"] + (other["y"] - p["y"]) * t0
                x1 = p["x"] + (other["x"] - p["x"]) * t1
                y1 = p["y"] + (other["y"] - p["y"]) * t1
                gdraw.line([(x0, y0), (x1, y1)], fill=col, width=2)

    # 3. Gravity Wells
    for w in frame["wells"]:
        is_att = w["strength"] >= 0
        col = (192, 132, 252) if is_att else (251, 146, 60)
        for ring in range(3):
            rr = 19 + ring * 13
            a0 = math.degrees(w["spin"] * (1 + ring * 0.35) + ring * 2.1) % 360
            fade_c = tuple(int(c * (0.95 - ring * 0.22)) for c in col)
            gdraw.arc([w["x"] - rr, w["y"] - rr, w["x"] + rr, w["y"] + rr], a0, a0 + 205, fill=fade_c, width=3)
        gdraw.ellipse([w["x"] - 12, w["y"] - 12, w["x"] + 12, w["y"] + 12], fill=(12, 8, 24), outline=col, width=2)

    # 4. Portals
    for p in portals:
        col = parse_color(p["color"])
        r = p["r"]
        gdraw.ellipse([p["x"] - r, p["y"] - r, p["x"] + r, p["y"] + r], outline=col, width=4)
        ir = r * 0.62
        a0 = math.degrees(frame["t"] * 3.4) % 360
        gdraw.arc([p["x"] - ir, p["y"] - ir, p["x"] + ir, p["y"] + ir], a0, a0 + 130, fill=col, width=2)
        gdraw.arc([p["x"] - ir, p["y"] - ir, p["x"] + ir, p["y"] + ir], a0 + 180, a0 + 310, fill=col, width=2)

    # 5. Prisms
    for pr in frame["prisms"]:
        r = pr["r"]
        col = (255, 255, 255) if pr["hitFlash"] > 0.25 else (103, 232, 249)
        pts = []
        for i in range(3):
            a = pr["angle"] + i * (2 * math.pi / 3) - math.pi / 2
            pts.append((pr["x"] + math.cos(a) * r, pr["y"] + math.sin(a) * r))
        fill_c = tuple(int(c * (0.28 + pr["hitFlash"] * 0.45)) for c in (34, 211, 238))
        gdraw.polygon(pts, fill=fill_c, outline=col)
        gdraw.line(pts + [pts[0]], fill=col, width=3)

    # 6. Vibrating Musical Strings
    for s in frame["strings"]:
        col = (255, 255, 255) if s["hitFlash"] > 0.35 else parse_color(s["color"])
        x1, y1, x2, y2 = s["x1"], s["y1"], s["x2"], s["y2"]
        dx, dy = x2 - x1, y2 - y1
        seg_len = max(1.0, math.hypot(dx, dy))
        nx, ny = -dy / seg_len, dx / seg_len
        amp = s["vib"] * 1.9
        cx = x1 + dx * s["hitT"] + nx * amp
        cy = y1 + dy * s["hitT"] + ny * amp

        # Sample quadratic Bezier curve
        pts = []
        for k in range(13):
            u = k / 12.0
            inv = 1.0 - u
            px = inv * inv * x1 + 2 * inv * u * cx + u * u * x2
            py = inv * inv * y1 + 2 * inv * u * cy + u * u * y2
            pts.append((px, py))
        w_line = int(3 + s["hitFlash"] * 3)
        gdraw.line(pts, fill=col, width=w_line)
        for ex, ey in ((x1, y1), (x2, y2)):
            gdraw.ellipse([ex - 5, ey - 5, ex + 5, ey + 5], fill=(15, 23, 42), outline=col, width=2)

    # 7. Bumpers
    for b in frame["bumpers"]:
        col = (255, 255, 255) if b["hitFlash"] > 0.35 else parse_color(b["color"])
        r = b["r"]
        inner = tuple(int(c * (0.24 + b["hitFlash"] * 0.55)) for c in parse_color(b["color"]))
        gdraw.ellipse([b["x"] - r, b["y"] - r, b["x"] + r, b["y"] + r], fill=inner, outline=col, width=3)

    # 8. Emitters
    for em in frame["emitters"]:
        col = (56, 189, 248) if em["instrument"] == "crystal" else (244, 63, 94) if em["instrument"] == "synth" else (168, 85, 247)
        r = 14 + em["pulse"] * 4
        nx = em["x"] + math.cos(em["angle"]) * (r + 14)
        ny = em["y"] + math.sin(em["angle"]) * (r + 14)
        gdraw.line([(em["x"], em["y"]), (nx, ny)], fill=col, width=3)
        gdraw.ellipse([em["x"] - r, em["y"] - r, em["x"] + r, em["y"] + r], fill=(11, 18, 36), outline=col, width=3)

    # 9. Ripples & Sparks
    for rp in frame["ripples"]:
        col = tuple(int(c * max(0.0, min(1.0, rp["alpha"]))) for c in parse_color(rp["color"]))
        r = rp["r"]
        gdraw.ellipse([rp["x"] - r, rp["y"] - r, rp["x"] + r, rp["y"] + r], outline=col, width=2)

    for sp in frame["sparks"]:
        col = tuple(int(c * max(0.0, min(1.0, sp["alpha"]))) for c in parse_color(sp["color"]))
        r = sp["size"]
        gdraw.ellipse([sp["x"] - r, sp["y"] - r, sp["x"] + r, sp["y"] + r], fill=col)

    # 10. Luminous Orbs & Comet Trails
    for o in frame["orbs"]:
        col = parse_color(o["color"])
        trail = o["trail"]
        if len(trail) > 1:
            for i in range(1, len(trail)):
                ratio = i / len(trail)
                tcol = tuple(int(c * ratio * 0.8) for c in col)
                gdraw.line([tuple(trail[i - 1]), tuple(trail[i])], fill=tcol, width=max(1, int(o["r"] * 1.4 * ratio)))
        r = o["r"]
        gdraw.ellipse([o["x"] - r, o["y"] - r, o["x"] + r, o["y"] + r], fill=col)
        gdraw.ellipse([o["x"] - r * 0.48, o["y"] - r * 0.48, o["x"] + r * 0.48, o["y"] + r * 0.48], fill=(255, 255, 255))

    # 11. Simulated Live Cursor Drawing Ghost Preview (Scene 1)
    if frame.get("cursorDraw"):
        cd = frame["cursorDraw"]
        gdraw.line([(cd["x1"], cd["y1"]), (cd["x2"], cd["y2"])], fill=(103, 232, 249), width=3)
        gdraw.ellipse([cd["x2"] - 8, cd["y2"] - 8, cd["x2"] + 8, cd["y2"] + 8], outline=(255, 255, 255), width=2)

    # Composite true neon bloom over cosmic backdrop
    img = blend_glow(base_bg, glow, strength=1.12)
    draw = ImageDraw.Draw(img, "RGBA")

    # Crisp bumper/floating note labels on top of bloom
    for b in frame["bumpers"]:
        draw.text((b["x"], b["y"]), b["label"], font=fonts["mono_xs"], fill=(248, 250, 252, 235), anchor="mm")

    for fn in frame["notes"]:
        col = parse_color(fn["color"])
        a = int(max(0, min(1, fn["alpha"])) * 240)
        draw.text((fn["x"], fn["y"]), fn["label"], font=fonts["mono_xs"], fill=(col[0], col[1], col[2], a), anchor="mm")

    if frame.get("cursorDraw"):
        cd = frame["cursorDraw"]
        mx, my = (cd["x1"] + cd["x2"]) // 2, (cd["y1"] + cd["y2"]) // 2 - 18
        tip_txt = f"Drawing String  |  {cd['label']}" if LANG == "en" else f"正在绘制琴弦 · {cd['label']}"
        draw.rounded_rectangle([mx - 86, my - 13, mx + 86, my + 13], radius=8,
                               fill=(11, 18, 36, 215), outline=(56, 189, 248, 220), width=1)
        draw.text((mx, my), tip_txt, font=fonts["hud_xs"], fill=(241, 245, 249, 255), anchor="mm")

    # Top Glassmorphic Studio Bar
    draw.rounded_rectangle([18, 14, W - 18, 62], radius=14,
                           fill=(11, 18, 36, 195), outline=(148, 163, 184, 58), width=1)
    # Brand Badge
    draw.rounded_rectangle([28, 23, 56, 51], radius=8, fill=(56, 189, 248, 235))
    draw_star_icon(draw, 42, 37, 9, 3, (255, 255, 255, 255))
    draw.text((66, 30), "GravitySynth", font=fonts["hud_title"], fill=(248, 250, 252, 255), anchor="lm")
    brand_sub = "Physics Synth  |  Frankenstein Demo" if LANG == "en" else "引力音轨 · Frankenstein Demo"
    draw.text((66, 46), brand_sub, font=fonts["hud_xs"], fill=(148, 163, 184, 255), anchor="lm")

    # Center Active Scene Pill
    scene_pill = f"▶  {frame['sceneTitle']}"
    sb = draw.textbbox((0, 0), scene_pill, font=fonts["hud_md"])
    sw = sb[2] - sb[0] + 32
    draw.rounded_rectangle([W // 2 - sw // 2, 22, W // 2 + sw // 2, 54], radius=10,
                           fill=(56, 189, 248, 52), outline=(56, 189, 248, 185), width=1)
    draw.text((W // 2, 38), scene_pill, font=fonts["hud_md"], fill=(248, 250, 252, 255), anchor="mm")

    # Right Live Telemetry Pills
    g_label = "0.0g ZERO-G" if frame["gravity"] == 0 else f"{frame['gravity']/430:.1f}g"
    stats_txt = f"BPM {frame['bpm']}  |  {g_label}  |  {frame['orbCount']:02d} ORBS  |  {frame['totalHits']} NOTES"
    draw.text((W - 34, 38), stats_txt, font=fonts["mono_xs"], fill=(203, 213, 225, 240), anchor="rm")

    # Bullet-Time Highlight Pill
    if frame.get("bulletTime"):
        bt_txt = "BULLET TIME  0.25x  |  SLOW MOTION" if LANG == "en" else "BULLET TIME  0.25x  ·  子弹时间慢放"
        draw.rounded_rectangle([W // 2 - 178, 76, W // 2 + 178, 110], radius=17,
                               fill=(88, 28, 135, 215), outline=(192, 132, 252, 245), width=2)
        draw.text((W // 2, 93), bt_txt, font=fonts["hud_md"], fill=(250, 245, 255, 255), anchor="mm")

    # Bottom Subtitle Capsule
    sub = frame["subtitle"]
    sub_font = fonts["sub_bar_en"] if LANG == "en" else fonts["sub_bar"]
    sub_box = draw.textbbox((0, 0), sub, font=sub_font)
    sub_w = sub_box[2] - sub_box[0] + 44
    draw.rounded_rectangle([W // 2 - sub_w // 2, H - 56, W // 2 + sub_w // 2, H - 18], radius=19,
                           fill=(8, 13, 28, 212), outline=(148, 163, 184, 72), width=1)
    draw.text((W // 2, H - 37), sub, font=sub_font, fill=(241, 245, 249, 255), anchor="mm")

    if fade_alpha < 0.99:
        arr = (np.asarray(img, dtype=np.float32) * fade_alpha).astype(np.uint8)
        return Image.fromarray(arr, mode="RGB")
    return img


def main():
    with open(SIM_JSON, "r", encoding="utf-8") as f:
        sim = json.load(f)

    W = sim["width"]
    H = sim["height"]
    FPS = sim["fps"]
    total_dur = sim["totalDuration"]
    total_frames = int(round(total_dur * FPS))

    # 1. Synthesize real stereo audio
    audio_stereo = synthesize_audio(sim["audioEvents"], total_dur)

    # 2. Load fonts
    fonts = {
        "hero_en": load_font(FONT_SANS, 64),
        "hero_en_sub": load_font(FONT_SANS, 32),
        "hero_cn_lg": load_font(FONT_CJK_BOLD, 44),
        "hero_cn": load_font(FONT_CJK_BOLD, 30),
        "sub_cn": load_font(FONT_CJK_REG, 20),
        "sub_en": load_font(FONT_SANS, 20),
        "sub_bar": load_font(FONT_CJK_REG, 17),
        "sub_bar_en": load_font(FONT_SANS, 17),
        "hud_title": load_font(FONT_SANS, 16),
        "hud_md": load_font(FONT_CJK_BOLD, 15),
        "hud_xs": load_font(FONT_CJK_REG, 12),
        "mono_md": load_font(FONT_MONO, 19),
        "mono_sm": load_font(FONT_MONO, 13),
        "mono_xs": load_font(FONT_MONO, 12),
    }

    # 3. Pre-render cached backgrounds per scene (including warped spacetime grid!)
    plain_bg = create_cosmic_backdrop(W, H, [])
    scene_bgs = {}
    frames_by_idx = {}
    for fr in sim["frames"]:
        idx = int(round(fr["t"] * FPS))
        frames_by_idx[idx] = fr
        sid = fr["sceneId"]
        if sid not in scene_bgs:
            scene_bgs[sid] = create_cosmic_backdrop(W, H, fr["wells"])

    # Build scene boundary fade helper
    scene_ranges = [(sc["startSec"], sc["startSec"] + sc["durationSec"]) for sc in sim["scenes"]]

    # 4. Launch FFmpeg encoder pipe
    cmd = [
        "ffmpeg",
        "-y",
        "-f", "rawvideo",
        "-vcodec", "rawvideo",
        "-pix_fmt", "rgb24",
        "-s", f"{W}x{H}",
        "-r", str(FPS),
        "-i", "-",
        "-i", WAV_OUT,
        "-c:v", "libx264",
        "-preset", "fast",
        "-crf", "19",
        "-pix_fmt", "yuv420p",
        "-c:a", "aac",
        "-b:a", "192k",
        "-movflags", "+faststart",
        "-shortest",
        MP4_OUT,
    ]
    proc = subprocess.Popen(cmd, stdin=subprocess.PIPE, stderr=subprocess.PIPE)

    preview_targets = {
        int(2.0 * FPS): "preview_01_intro.png",
        int(7.6 * FPS): "preview_02_cyberpunk_draw.png",
        int(22.0 * FPS): "preview_03_orbital_bullettime.png",
        int(39.0 * FPS): "preview_04_pinball.png",
    }
    if PREVIEW_DIR:
        os.makedirs(PREVIEW_DIR, exist_ok=True)

    prev_bars = np.zeros(48, dtype=np.float32)

    for fi in range(total_frames):
        t = fi / FPS
        if t < 4.0:
            img = draw_title_card(plain_bg, W, H, t, mode="intro", fonts=fonts)
        elif t >= 44.0:
            img = draw_title_card(plain_bg, W, H, t, mode="outro", fonts=fonts)
        else:
            fr = frames_by_idx.get(fi)
            if fr is None:
                # Fallback to nearest frame
                fr = frames_by_idx.get(fi - 1) or sim["frames"][-1]

            raw_bars = compute_frame_spectrum(audio_stereo, fi, FPS, n_bars=48)
            smooth_bars = prev_bars * 0.65 + raw_bars * 0.35
            prev_bars = smooth_bars

            # Smooth 0.35s fade-in/fade-out at scene transitions
            fade = 1.0
            for s0, s1 in scene_ranges:
                if s0 <= t <= s1:
                    fade = min(1.0, (t - s0) / 0.35, (s1 - t) / 0.35)
                    break

            img = render_live_frame(scene_bgs[fr["sceneId"]], fr, smooth_bars, fonts, fade_alpha=max(0.05, fade))

        if PREVIEW_DIR and fi in preview_targets:
            img.save(os.path.join(PREVIEW_DIR, preview_targets[fi]))

        proc.stdin.write(img.tobytes())

        if (fi + 1) % 360 == 0 or fi == total_frames - 1:
            print(f"Rendered {fi + 1}/{total_frames} frames ({(fi + 1)/total_frames*100:.0f}%)")

    proc.stdin.close()
    stderr_out = proc.stderr.read().decode("utf-8", errors="ignore")
    ret = proc.wait()
    if ret != 0:
        print("FFmpeg failed:\n", stderr_out, file=sys.stderr)
        sys.exit(ret)

    # Clean up temporary intermediate WAV & JSON? Keep MP4 clean and delete huge sim_data/wav
    for tmp in (SIM_JSON, WAV_OUT):
        if os.path.exists(tmp):
            os.remove(tmp)

    print(f"SUCCESS: Demo video created at {MP4_OUT}")


if __name__ == "__main__":
    main()
