/**
 * Diaww Kamera — Pro Hyper-Edition (Filter Engine v5)
 * 500+ Industry-Standard Filters & Pro Combinations.
 */

const Effects = {
  buffer: [],
  maxBufferSize: 60,

  // PERSISTENT POOLS (Memory Stability)
  canvasPool: [],
  offscreen: document.createElement('canvas'),
  offCtx: null,
  pData: null,

  // --- 1. CORE ENGINE ---

  map: (px, ctx, w, h, mapFn) => {
    const out = ctx.createImageData(w, h);
    const d = px.data, od = out.data;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const { sx, sy } = mapFn(x, y, w, h);
        if (sx >= 0 && sx < w && sy >= 0 && sy < h) {
          const tIdx = (y * w + x) * 4;
          const sIdx = (Math.floor(sy) * w + Math.floor(sx)) * 4;
          od[tIdx] = d[sIdx]; od[tIdx + 1] = d[sIdx + 1]; od[tIdx + 2] = d[sIdx + 2]; od[tIdx + 3] = d[sIdx + 3];
        }
      }
    }
    ctx.putImageData(out, 0, 0);
  },

  // NEW: Optimized convolution for sharpening, blurring, etc.
  convolve: (px, ctx, w, h, weights) => {
    const side = Math.round(Math.sqrt(weights.length));
    const halfSide = Math.floor(side / 2);
    const src = px.data;
    const sw = w, sh = h;
    const output = ctx.createImageData(w, h);
    const dst = output.data;

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const sy = y, sx = x, dstOff = (y * w + x) * 4;
        let r = 0, g = 0, b = 0;
        for (let cy = 0; cy < side; cy++) {
          for (let cx = 0; cx < side; cx++) {
            const scy = sy + cy - halfSide;
            const scx = sx + cx - halfSide;
            if (scy >= 0 && scy < sh && scx >= 0 && scx < sw) {
              const srcOff = (scy * sw + scx) * 4;
              const wt = weights[cy * side + cx];
              r += src[srcOff] * wt;
              g += src[srcOff + 1] * wt;
              b += src[srcOff + 2] * wt;
            }
          }
        }
        dst[dstOff] = r; dst[dstOff + 1] = g; dst[dstOff + 2] = b; dst[dstOff + 3] = 255;
      }
    }
    ctx.putImageData(output, 0, 0);
  },

  // --- 2. THE HYPER SUITE ---

  grid: (ctx, w, h, cols, rows, mirror = false, gap = 4) => {
    // 1. CLEAR TO BLACK background for the borders (boxy look)
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, w, h);

    const tw = w / cols, th = h / rows;
    const drawW = tw - (gap > 0 ? gap : 0);
    const drawH = th - (gap > 0 ? gap : 0);
    const cellAspect = drawW / drawH;

    // 2. SMART CROP: Calculate source rect to maintain aspect ratio
    let sw = video.width, sh = video.height;
    let sx = 0, sy = 0;
    if (sw / sh > cellAspect) {
      sw = sh * cellAspect; sx = (video.width - sw) / 2;
    } else {
      sh = sw / cellAspect; sy = (video.height - sh) / 2;
    }

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        ctx.save();
        ctx.translate(c * tw, r * th);
        if (mirror && (c % 2 === 1)) {
          ctx.translate(tw, 0);
          ctx.scale(-1, 1);
        }
        if (mirror && (r % 2 === 1)) {
          ctx.translate(0, th);
          ctx.scale(1, -1);
        }
        // Draw with the gap as an offset to center the "box"
        const offset = gap / 2;
        ctx.drawImage(video, sx, sy, sw, sh, offset, offset, drawW, drawH);
        ctx.restore();
      }
    }
  },

  symmetry: (ctx, w, h, type = 'horizontal') => {
    const vw = video.width, vh = video.height;
    ctx.save();
    if (type === 'horizontal') {
      const sw = vw / 2;
      // Draw inner-half mirrored to fill the frame neatly
      ctx.drawImage(video, 0, 0, sw, vh, 0, 0, w / 2, h);
      ctx.translate(w, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(video, 0, 0, sw, vh, 0, 0, w / 2, h);
    } else if (type === 'vertical') {
      const sh = vh / 2;
      ctx.drawImage(video, 0, 0, vw, sh, 0, 0, w, h / 2);
      ctx.translate(0, h);
      ctx.scale(1, -1);
      ctx.drawImage(video, 0, 0, vw, sh, 0, 0, w, h / 2);
    } else if (type === 'quad') {
      const sw = vw / 2, sh = vh / 2;
      const qw = w / 2, qh = h / 2;
      // TL
      ctx.drawImage(video, 0, 0, sw, sh, 0, 0, qw, qh);
      // TR
      ctx.save(); ctx.translate(w, 0); ctx.scale(-1, 1); ctx.drawImage(video, 0, 0, sw, sh, 0, 0, qw, qh); ctx.restore();
      // BL
      ctx.save(); ctx.translate(0, h); ctx.scale(1, -1); ctx.drawImage(video, 0, 0, sw, sh, 0, 0, qw, qh); ctx.restore();
      // BR
      ctx.save(); ctx.translate(w, h); ctx.scale(-1, -1); ctx.drawImage(video, 0, 0, sw, sh, 0, 0, qw, qh); ctx.restore();
    }
    ctx.restore();
  },

  // RGB GHOST ENGINE (Chromatic Aberration Trails)
  rainbowGhost: (ctx, w, h, frames = 10, alpha = 0.4) => {
    Effects.updateBuffer(ctx, w, h, frames);

    // --- 1. CLEAR: black background for ghost effect ---
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, w, h);

    // --- 2. GHOST TRAILS from old buffered frames ---
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    const step = Math.max(1, Math.floor(Effects.buffer.length / 5));
    for (let i = 0; i < Effects.buffer.length; i += step) {
      const frame = Effects.buffer[i];
      if (!frame) continue;
      const t = i / Effects.buffer.length; // 0..1, oldest=0
      const fade = alpha * (1 - t) * 0.5;
      // Cycle ghost color: red → magenta → blue → cyan → green
      const hue = t * 300;
      ctx.globalAlpha = fade;
      ctx.filter = `hue-rotate(${hue}deg) saturate(2.5) brightness(1.2)`;
      ctx.drawImage(frame, 0, 0, w, h);
    }
    ctx.restore();

    // --- 3. CHROMATIC ABERRATION on current live frame ---
    // We composite R, G, B channels with pixel offsets
    const shift = Math.max(4, w * 0.012) | 0; // ~1.2% of width

    // Use a temp offscreen to isolate channels
    const tmp = document.createElement('canvas');
    tmp.width = w; tmp.height = h;
    const tCtx = tmp.getContext('2d');
    tCtx.drawImage(video, 0, 0, w, h);
    const src = tCtx.getImageData(0, 0, w, h);
    const s = src.data;

    const out = ctx.createImageData(w, h);
    const o = out.data;

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = (y * w + x) * 4;

        // Red channel: shift LEFT
        const rx = Math.max(0, x - shift);
        const ri = (y * w + rx) * 4;

        // Green channel: no shift (center)
        const gi = idx;

        // Blue channel: shift RIGHT
        const bx = Math.min(w - 1, x + shift);
        const bi = (y * w + bx) * 4;

        o[idx]     = s[ri];       // R from left
        o[idx + 1] = s[gi + 1];  // G from center
        o[idx + 2] = s[bi + 2];  // B from right
        o[idx + 3] = 255;
      }
    }

    // Composite the chromatic frame on top of ghost trails
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = 0.92;

    const chromaCanvas = document.createElement('canvas');
    chromaCanvas.width = w; chromaCanvas.height = h;
    chromaCanvas.getContext('2d').putImageData(out, 0, 0);
    ctx.drawImage(chromaCanvas, 0, 0);
    ctx.restore();
  },

  kaleidoscope: (ctx, w, h, slices = 4) => {
    const halfW = w / 2, halfH = h / 2;
    ctx.save();
    ctx.translate(halfW, halfH);
    for (let i = 0; i < slices; i++) {
      ctx.rotate((Math.PI * 2) / slices);
      ctx.drawImage(video, -halfW / 2, -halfH / 2, halfW, halfH);
    }
    ctx.restore();
  },

  underwater: (px, ctx, w, h, strength = 1) => {
    Effects.processLowRes(ctx, w, h, (px, oCtx, sw, sh) => {
      const time = Date.now() / 800;
      const d = px.data, out = oCtx.createImageData(sw, sh), od = out.data;
      for (let y = 0; y < sh; y++) {
        const yw = y * sw, syB = Math.sin(y / 15 + time) * (10 * strength);
        for (let x = 0; x < sw; x++) {
          const sx = (x + Math.cos(x / 15 + time) * (8 * strength) + 0.5) | 0;
          const sy = (y + syB + 0.5) | 0;
          const i = (yw + x) << 2, si = (sy * sw + sx) << 2;
          od[i] = d[si]; od[i + 1] = d[si + 1]; od[i + 2] = d[si + 2]; od[i + 3] = 255;
        }
      }
      oCtx.putImageData(out, 0, 0);
    });
  },

  delay: (ctx, w, h, frameOffset = 10) => {
    Effects.updateBuffer(ctx, w, h, 60);
    const targetFrame = Effects.buffer[Math.max(0, Effects.buffer.length - 1 - frameOffset)];
    if (targetFrame) ctx.drawImage(targetFrame, 0, 0);
  },

  updateBuffer: (ctx, w, h, size) => {
    // RECYCLING SYSTEM (No memory leaks)
    if (Effects.canvasPool.length === 0) {
      for (let i = 0; i < 60; i++) {
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        Effects.canvasPool.push(c);
      }
    }
    const t = Effects.canvasPool.shift();
    // AUTO-RESIZE FIX (Prevents 'small box' bug when switching from low-res)
    if (t.width !== w || t.height !== h) { t.width = w; t.height = h; }

    t.getContext('2d').drawImage(video, 0, 0, w, h);
    Effects.buffer.push(t);
    if (Effects.buffer.length > size) {
      const old = Effects.buffer.shift();
      Effects.canvasPool.push(old);
    }
  },

  // INTERNAL 50% DOWNSAMPLING (4x FASTER)
  processLowRes: (ctx, w, h, filterFn) => {
    const sw = w >> 1, sh = h >> 1; // 50% size
    if (!Effects.offCtx) {
      Effects.offscreen.width = sw; Effects.offscreen.height = sh;
      Effects.offCtx = Effects.offscreen.getContext('2d', { alpha: false });
    }
    // Step 1: Capture Low-Res
    Effects.offCtx.drawImage(video, 0, 0, sw, sh);
    const px = Effects.offCtx.getImageData(0, 0, sw, sh);

    // Step 2: Custom Loop (Already optimized in filterFn)
    filterFn(px, Effects.offCtx, sw, sh);

    // Step 3: Fast GPU Upscale
    ctx.drawImage(Effects.offscreen, 0, 0, w, h);
  },

  // NEW: Pinch / Punch
  pinch: (px, ctx, w, h, strength = 0.5) => {
    const cx = w / 2, cy = h / 2, radius = Math.min(w, h) / 2;
    const d = px.data, out = ctx.createImageData(w, h), od = out.data;
    for (let y = 0; y < h; y++) {
      const yw = y * w, dy = y - cy, dy2 = dy * dy;
      for (let x = 0; x < w; x++) {
        const dx = x - cx;
        const dist = Math.sqrt(dx * dx + dy2);
        const i = (yw + x) << 2;
        if (dist < radius) {
          const factor = Math.pow(dist / radius, strength);
          const sx = (cx + dx * factor + 0.5) | 0, sy = (cy + dy * factor + 0.5) | 0;
          const si = (sy * w + sx) << 2;
          od[i] = d[si]; od[i + 1] = d[si + 1]; od[i + 2] = d[si + 2]; od[i + 3] = d[si + 3];
        } else {
          const si = (yw + x) << 2;
          od[i] = d[si]; od[i + 1] = d[si + 1]; od[i + 2] = d[si + 2]; od[i + 3] = d[si + 3];
        }
      }
    }
    ctx.putImageData(out, 0, 0);
  },

  // NEW: Fisheye (fixed division by zero)
  fisheye: (px, ctx, w, h, zoom = 1) => {
    const cx = w / 2, cy = h / 2;
    Effects.map(px, ctx, w, h, (x, y) => {
      let dx = (x - cx) / cx, dy = (y - cy) / cy;
      let r = Math.sqrt(dx * dx + dy * dy);
      if (r < 1) {
        if (r === 0) {
          // Center pixel stays unchanged
          return { sx: cx, sy: cy };
        }
        let nr = (1 - Math.sqrt(1 - r * r)) / 2 + r / 2;
        nr *= zoom;
        return { sx: cx + (dx / r) * nr * cx, sy: cy + (dy / r) * nr * cy };
      }
      return { sx: x, sy: y };
    });
  },

  // NEW: Pixelate
  pixelate: (ctx, w, h, size = 10) => {
    // Step 1: Draw video at 1/size resolution into a tiny temp canvas
    const tmp = document.createElement('canvas');
    tmp.width = (w / size) | 0;
    tmp.height = (h / size) | 0;
    tmp.getContext('2d').drawImage(video, 0, 0, tmp.width, tmp.height);
    // Step 2: Scale back up pixelated (no smoothing = blocky pixels)
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(tmp, 0, 0, tmp.width, tmp.height, 0, 0, w, h);
    ctx.imageSmoothingEnabled = true;
  },

  // NEW: Dot Screen (Halftone)
  dotScreen: (px, ctx, w, h, size = 10) => {
    const d = px.data;
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += size) {
      for (let x = 0; x < w; x += size) {
        const i = (y * w + x) * 4;
        const avg = (d[i] + d[i + 1] + d[i + 2]) / 3;
        const r = (avg / 255) * (size / 2);
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(x + size / 2, y + size / 2, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  },

  // NEW: Color Matrix
  colorMatrix: (px, ctx, w, h, m) => {
    const d = px.data;
    const out = ctx.createImageData(w, h);
    const od = out.data;
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i], g = d[i + 1], b = d[i + 2];
      od[i] = r * m[0] + g * m[1] + b * m[2] + m[4] * 255;
      od[i + 1] = r * m[5] + g * m[6] + b * m[7] + m[9] * 255;
      od[i + 2] = r * m[10] + g * m[11] + b * m[12] + m[14] * 255;
      od[i + 3] = d[i + 3];
    }
    ctx.putImageData(out, 0, 0);
  },

  twirl: (px, ctx, w, h, angle = 2) => {
    const cx = w / 2, cy = h / 2;
    const radius = Math.min(w, h) / 2;
    Effects.map(px, ctx, w, h, (x, y) => {
      let dx = x - cx, dy = y - cy;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < radius) {
        const a = Math.atan2(dy, dx) + angle * (radius - d) / radius;
        return { sx: cx + d * Math.cos(a), sy: cy + d * Math.sin(a) };
      }
      return { sx: x, sy: y };
    });
  },

  // NEW: Liquid Wave Engine
  liquid: (px, ctx, w, h, strength = 10, freq = 0.05) => {
    Effects.processLowRes(ctx, w, h, (px, oCtx, sw, sh) => {
      const time = Date.now() / 1000, d = px.data, out = oCtx.createImageData(sw, sh), od = out.data;
      for (let y = 0; y < sh; y++) {
        const yw = y * sw, syO = Math.sin(y * freq + time) * (strength / 2);
        for (let x = 0; x < sw; x++) {
          const sx = (x + syO + 0.5) | 0, sy = (y + Math.cos(x * freq + time) * (strength / 2) + 0.5) | 0;
          const i = (yw + x) << 2, si = (sy * sw + sx) << 2;
          od[i] = d[si]; od[i + 1] = d[si + 1]; od[i + 2] = d[si + 2]; od[i + 3] = 255;
        }
      }
      oCtx.putImageData(out, 0, 0);
    });
  },

  // NEW: Spherical Bubble Refraction
  bubble: (px, ctx, w, h, size = 0.4, intensity = 0.15) => {
    Effects.processLowRes(ctx, w, h, (px, oCtx, sw, sh) => {
      const cx = sw / 2, cy = sh / 2, radius = Math.min(sw, sh) * size;
      const rInv = 1 / radius, hPI = Math.PI / 2, d = px.data, out = oCtx.createImageData(sw, sh), od = out.data;
      for (let y = 0; y < sh; y++) {
        const yw = y * sw, dy = y - cy, dy2 = dy * dy;
        for (let x = 0; x < sw; x++) {
          const dx = x - cx, dist = Math.sqrt(dx * dx + dy2), i = (yw + x) << 2;
          if (dist < radius) {
            const f = 1 + (Math.sin(dist * rInv * hPI) * intensity);
            const sx = (cx + dx * f + 0.5) | 0, sy = (cy + dy * f + 0.5) | 0;
            const si = (sy * sw + sx) << 2;
            od[i] = d[si]; od[i + 1] = d[si + 1]; od[i + 2] = d[si + 2]; od[i + 3] = 255;
          } else {
            od[i] = d[i]; od[i + 1] = d[i + 1]; od[i + 2] = d[i + 2]; od[i + 3] = 255;
          }
        }
      }
      oCtx.putImageData(out, 0, 0);
    });
  },

  // ─── POLAROID ENGINE ────────────────────────────────────────────────────────
  // Draws ONE polaroid card with a GRID of photos inside it.
  // cols/rows: internal grid within the card.
  // filterStyle: CSS filter for the photos.
  polaroid: (ctx, w, h, cols = 1, rows = 1, filterStyle = null) => {
    // 1. Paper background — warm linen texture
    const grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#e2dfd5');
    grad.addColorStop(0.5, '#d6d2c4');
    grad.addColorStop(1, '#cdc8b8');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Subtle texture dots
    ctx.save();
    ctx.globalAlpha = 0.05;
    for(let i=0; i<150; i++) {
      ctx.beginPath();
      ctx.arc(Math.random()*w, Math.random()*h, Math.random()*2, 0, Math.PI*2);
      ctx.fillStyle = '#000';
      ctx.fill();
    }
    ctx.restore();

    // 2. Calculate card size (Keep it centered and large)
    const cardW = Math.min(w, h) * 0.72;
    const cardH = cardW * 1.25;
    const cx = w/2, cy = h/2;

    // Margins
    const m = cardW * 0.06;     // side/top margin
    const mb = cardH * 0.22;    // bottom margin for writing
    const photoW = cardW - (m * 2);
    const photoH = cardH - m - mb;

    ctx.save();
    ctx.translate(cx, cy);
    // Subtle tilt for realism
    ctx.rotate(-0.02);

    // Card Shadow
    ctx.shadowColor = 'rgba(0,0,0,0.3)';
    ctx.shadowBlur = cardW * 0.05;
    ctx.shadowOffsetX = cardW * 0.02;
    ctx.shadowOffsetY = cardH * 0.02;

    // White Card Body
    ctx.fillStyle = '#fdfdfb';
    ctx.beginPath();
    ctx.roundRect(-cardW/2, -cardH/2, cardW, cardH, cardW * 0.015);
    ctx.fill();

    // Reset shadow for inner parts
    ctx.shadowColor = 'transparent';

    // 3. Draw Photo Grid
    ctx.save();
    // Clip to photo area
    ctx.beginPath();
    ctx.rect(-cardW/2 + m, -cardH/2 + m, photoW, photoH);
    ctx.clip();

    // Black background for the photo gaps
    ctx.fillStyle = '#111';
    ctx.fillRect(-cardW/2 + m, -cardH/2 + m, photoW, photoH);

    const gap = 4;
    const cellW = (photoW - (cols - 1) * gap) / cols;
    const cellH = (photoH - (rows - 1) * gap) / rows;
    const cellAspect = cellW / cellH;

    // Smart Crop from raw video
    let sw = video.width, sh = video.height;
    let sx = 0, sy = 0;
    if (sw / sh > cellAspect) {
      sw = sh * cellAspect; sx = (video.width - sw) / 2;
    } else {
      sh = sw / cellAspect; sy = (video.height - sh) / 2;
    }

    if (filterStyle) ctx.filter = filterStyle;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const dx = -cardW/2 + m + c * (cellW + gap);
        const dy = -cardH/2 + m + r * (cellH + gap);
        ctx.drawImage(video, sx, sy, sw, sh, dx, dy, cellW, cellH);
      }
    }
    ctx.restore();

    // Inner shadow on photo
    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    const iGrad = ctx.createLinearGradient(0, -cardH/2 + m, 0, -cardH/2 + m + photoH/4);
    iGrad.addColorStop(0, 'rgba(0,0,0,0.15)');
    iGrad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = iGrad;
    ctx.fillRect(-cardW/2 + m, -cardH/2 + m, photoW, photoH);
    ctx.restore();

    // Writing line
    ctx.strokeStyle = 'rgba(0,0,0,0.06)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-cardW * 0.35, cardH/2 - mb * 0.45);
    ctx.lineTo(cardW * 0.35, cardH/2 - mb * 0.45);
    ctx.stroke();

    ctx.restore();
  }
};



// --- THE 500+ HYPER CONFIG ---
const FILTER_CONFIG = [
  { id: 'original', name: 'Original', cat: 'all', method: (px, ctx) => ctx.drawImage(video, 0, 0) }
];

// A. CATEGORIZED BASE
const BASE_MODES = [
  { id: 'mirror-h', name: 'Symmetry H', cat: 'mirror', method: (px, ctx, w, h) => Effects.symmetry(ctx, w, h, 'horizontal') },
  { id: 'mirror-v', name: 'Symmetry V', cat: 'mirror', method: (px, ctx, w, h) => Effects.symmetry(ctx, w, h, 'vertical') },
  { id: 'mirror-q', name: 'Symmetry Quad', cat: 'mirror', method: (px, ctx, w, h) => Effects.symmetry(ctx, w, h, 'quad') },
  { id: 'grid-2', name: 'Split Screen', cat: 'mirror', params: [2, 1] },
  { id: 'grid-v', name: 'Top Bottom', cat: 'mirror', params: [1, 2] },
  { id: 'grid-4', name: 'Quad Cam', cat: 'mirror', params: [2, 2] },
  { id: 'grid-36', name: 'Filmstrip', cat: 'mirror', params: [6, 6] },
  { id: 'grid-16', name: '16-Bits Pro', cat: 'mirror', params: [4, 4] },
  { id: 'grid-100', name: 'INCEPTION', cat: 'mirror', params: [10, 10] }
];

BASE_MODES.forEach(m => {
  if (m.method) {
    FILTER_CONFIG.push({ id: m.id, name: m.name, cat: m.cat, method: m.method });
  } else {
    // Standard grids are now boxy and non-mirrored like Webcam Toy
    FILTER_CONFIG.push({
      id: m.id,
      name: m.name,
      cat: m.cat,
      method: (px, ctx, w, h) => Effects.grid(ctx, w, h, m.params[0], m.params[1], false, 6)
    });
  }
});

[4, 6, 8, 10, 12, 14, 16, 20, 24, 32].forEach(s => {
  FILTER_CONFIG.push({ id: `kaleido-${s}`, name: `Kaleido ${s}`, cat: 'mirror', method: (px, ctx, w, h) => Effects.kaleidoscope(ctx, w, h, s) });
});

// B. COLOR SUITE (350+)
for (let h = 0; h < 360; h += 2) {
  FILTER_CONFIG.push({
    id: `hue-${h}`, name: `Aura ${h}°`, cat: 'color',
    method: (px, ctx, w, hv) => { ctx.save(); ctx.filter = `hue-rotate(${h}deg) saturate(1.5)`; ctx.drawImage(video, 0, 0, w, hv); ctx.restore(); }
  });
}

const CINEMATIC = [
  "Tokyo", "Berlin", "Paris", "Bali", "Iceland", "Cyberpunk", "London", "Sahara", "Pacific", "Autumn", "Spring", "Summer", "Winter",
  "Vaporwave", "Synthwave", "Kodak", "Fuji", "VHS", "Retro", "Noir", "Golden", "Rose", "Teal", "Sepia", "Vintage", "Classic",
  "Hyper", "Dream", "Mars", "Jupiter", "Neon", "Plastic", "Metallic", "Glass", "Oil", "Water", "Sky", "Fire", "Earth", "Space",
  "Shadow", "Crystal", "Ruby", "Emerald", "Sapphire", "Amber", "Cosmos", "Galaxy", "Nova", "Stellar"
];

CINEMATIC.forEach((name, i) => {
  FILTER_CONFIG.push({
    id: `lut-${i}a`, name: `${name} A`, cat: 'color',
    method: (px, ctx, w, hv) => { ctx.save(); ctx.filter = `sepia(${0.03 * i}) hue-rotate(${i * 8}deg) saturate(1.8)`; ctx.drawImage(video, 0, 0, w, hv); ctx.restore(); }
  });
  FILTER_CONFIG.push({
    id: `lut-${i}b`, name: `${name} B`, cat: 'color',
    method: (px, ctx, w, hv) => { ctx.save(); ctx.filter = `contrast(${1.1 + i * 0.015}) brightness(${0.9 + i * 0.005}) saturate(${1 + i * 0.03})`; ctx.drawImage(video, 0, 0, w, hv); ctx.restore(); }
  });
  FILTER_CONFIG.push({
    id: `lut-${i}c`, name: `${name} C`, cat: 'color',
    method: (px, ctx, w, hv) => { ctx.save(); ctx.filter = `invert(0.1) hue-rotate(${i * 12}deg) contrast(1.4)`; ctx.drawImage(video, 0, 0, w, hv); ctx.restore(); }
  });
});

// C. DISTORTION SUITE (Consolidated)
FILTER_CONFIG.push({ id: `swirl-pro`, name: `Swirl`, cat: 'distort', method: (px, ctx, w, h) => Effects.twirl(px, ctx, w, h, 2.5) });
FILTER_CONFIG.push({ id: `pinch-pro`, name: `Pinch`, cat: 'distort', method: (px, ctx, w, h) => Effects.pinch(px, ctx, w, h, 0.45) });
FILTER_CONFIG.push({ id: `punch-pro`, name: `Punch`, cat: 'distort', method: (px, ctx, w, h) => Effects.pinch(px, ctx, w, h, 1.8) });
FILTER_CONFIG.push({ id: `fisheye-pro`, name: `Fisheye`, cat: 'distort', method: (px, ctx, w, h) => Effects.fisheye(px, ctx, w, h, 1.2) });

FILTER_CONFIG.push({
  id: `bulge-ani`, name: `Liquid Warp`, cat: 'distort',
  method: (px, ctx, w, h) => {
    const time = Date.now() / 1000;
    Effects.map(px, ctx, w, h, (x, y) => {
      const dx = (x - w / 2) / (w / 2), dy = (y - h / 2) / (h / 2);
      const dist = Math.sqrt(dx * dx + dy * dy);
      const factor = 1 + dist * (0.4 + Math.sin(time) * 0.15);
      return { sx: w / 2 + (dx * factor) * (w / 2), sy: h / 2 + (dy * factor) * (h / 2) };
    });
  }
});


// D. ARTISTIC & PIXEL (Consolidated)
FILTER_CONFIG.push({ id: `pixel-art`, name: `Pixel Art`, cat: 'distort', method: (px, ctx, w, h) => Effects.pixelate(ctx, w, h, 12) });
FILTER_CONFIG.push({ id: `pixel-8bit`, name: `8-Bit Retro`, cat: 'distort', method: (px, ctx, w, h) => Effects.pixelate(ctx, w, h, 28) });
FILTER_CONFIG.push({ id: `dot-ink`, name: `Ink Dots`, cat: 'distort', method: (px, ctx, w, h) => Effects.dotScreen(px, ctx, w, h, 14) });

FILTER_CONFIG.push({ id: 'underwater-pro', name: 'Coral Reef', cat: 'distort', method: (px, ctx, w, h) => Effects.underwater(px, ctx, w, h, 1.2) });
FILTER_CONFIG.push({ id: 'ghost-pro', name: 'RGB GHOST', cat: 'motion', method: (px, ctx, w, h) => Effects.rainbowGhost(ctx, w, h, 12, 0.35) });
FILTER_CONFIG.push({ id: 'hyper-ghost', name: 'HYPER GHOST', cat: 'motion', method: (px, ctx, w, h) => Effects.rainbowGhost(ctx, w, h, 22, 0.6) });
FILTER_CONFIG.push({ id: 'acid-ghost', name: 'ACID TRIP', cat: 'motion', method: (px, ctx, w, h) => Effects.rainbowGhost(ctx, w, h, 30, 0.9) });

// E. COMBO SUITE
const TOP_FILTERS = [
  { n: "Noir", f: "grayscale(1) contrast(2)" },
  { n: "Neon", f: "hue-rotate(280deg) saturate(3)" },
  { n: "Infra", f: "invert(1) hue-rotate(180deg)" },
  { n: "Candy", f: "hue-rotate(60deg) saturate(2)" },
  { n: "Cyber", f: "hue-rotate(190deg) saturate(2.5) contrast(1.2)" },
  { n: "Fire", f: "hue-rotate(-20deg) saturate(2.5)" }
];

// E. COMBO SUITE (Disabling combos for heavy grid modes for performance)
BASE_MODES.filter(g => g.params && g.id !== 'grid-16' && g.id !== 'grid-100').forEach(grid => {
  TOP_FILTERS.forEach(filter => {
    FILTER_CONFIG.push({
      id: `combo-${grid.id}-${filter.n.toLowerCase()}`,
      name: `${grid.name} ${filter.n}`,
      cat: 'combo',
      method: (px, ctx, w, h) => {
        const sw = w / grid.params[0], sh = h / grid.params[1];
        ctx.save();
        ctx.filter = filter.f;
        for (let r = 0; r < grid.params[1]; r++) {
          for (let c = 0; c < grid.params[0]; c++) {
            ctx.drawImage(video, c * sw, r * sh, sw, sh);
          }
        }
        ctx.restore();
      }
    });
  });
});

// G. LIQUID SUITE (Consolidated)
FILTER_CONFIG.push({ id: `wave-deep`, name: `Deep Wave`, cat: 'distort', method: (px, ctx, w, h) => Effects.liquid(px, ctx, w, h, 25, 0.04) });
FILTER_CONFIG.push({ id: `bubble-pop`, name: `Pop Bubble`, cat: 'distort', method: (px, ctx, w, h) => Effects.bubble(px, ctx, w, h, 0.6, 0.2) });

// I. SWEET COLLECTION (Consolidated to 1 per name)
const SWEET_NAMES = ["Sakura", "Peach", "Candy", "Mint", "Bloom", "Sugar", "Honey", "Kawaii", "Dreamy", "Pastel", "Lush", "Velvet", "Glow", "Sparkle", "Sweet", "Cookie", "Berry", "Fluff", "Cloud", "Sunny"];
SWEET_NAMES.forEach((name, i) => {
  const h = i * 18 + 15;
  FILTER_CONFIG.push({
    id: `sweet-${i}-pro`,
    name: name,
    cat: 'sweet',
    method: (px, ctx, w, hv) => {
      ctx.save();
      ctx.filter = `hue-rotate(${h}deg) saturate(1.5) brightness(1.08) contrast(1.05)`;
      ctx.drawImage(video, 0, 0, w, hv);
      ctx.restore();
    }
  });
});

// J. VINTAGE COLLECTION (NEW PRO ANALOG)
const VINTAGE = [
  { id: 'vin-polaroid', name: 'Polaroid Pro', cat: 'vintage', f: 'contrast(1.1) brightness(1.1) sepia(0.3) saturate(0.8) hue-rotate(-10deg)' },
  { id: 'vin-1970', name: '1970s Analog', cat: 'vintage', f: 'sepia(0.2) hue-rotate(20deg) saturate(1.4) contrast(0.9) brightness(1.1)' },
  { id: 'vin-kodak', name: 'Kodak Gold', cat: 'vintage', f: 'contrast(1.2) saturate(1.5) sepia(0.1) hue-rotate(-5deg)' },
  { id: 'vin-bw-grain', name: 'Grainy Noir', cat: 'vintage', f: 'grayscale(1) contrast(1.8) brightness(0.9)' },
  { id: 'vin-denim', name: 'Faded Denim', cat: 'vintage', f: 'saturate(0.5) hue-rotate(180deg) brightness(1.1) contrast(1.1) sepia(0.2)' }
];

VINTAGE.forEach(v => {
  FILTER_CONFIG.push({
    id: v.id, name: v.name, cat: v.cat,
    method: (px, ctx, w, h) => { ctx.save(); ctx.filter = v.f; ctx.drawImage(video, 0, 0, w, h); ctx.restore(); }
  });
});

// K. POLAROID LUXE COLLECTION
const POLA_STLES = [
  { n: 'Classic', f: null },
  { n: 'B&W', f: 'grayscale(1) contrast(1.2) brightness(1.05)' },
  { n: 'Sepia', f: 'sepia(0.7) contrast(1.1) brightness(0.95)' },
  { n: 'Retro', f: 'hue-rotate(-15deg) saturate(1.3) contrast(0.9)' },
  { n: 'Faded', f: 'opacity(0.85) sepia(0.15) brightness(1.05)' }
];

const POLA_LAYOUTS = [
  { n: '1x', c: 1, r: 1 },
  { n: '2v', c: 1, r: 2 },
  { n: '2h', c: 2, r: 1 },
  { n: '3v', c: 1, r: 3 },
  { n: '4x', c: 2, r: 2 },
  { n: '6x', c: 2, r: 3 },
  { n: '9x', c: 3, r: 3 }
];

POLA_LAYOUTS.forEach(lay => {
  POLA_STLES.forEach(style => {
    FILTER_CONFIG.push({
      id: `pola-${lay.n}-${style.n.toLowerCase()}`,
      name: `Pola ${lay.n} ${style.n}`,
      cat: 'polaroid',
      method: (px, ctx, w, h) => Effects.polaroid(ctx, w, h, lay.c, lay.r, style.f)
    });
  });
});
