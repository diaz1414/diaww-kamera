/**
 * Diaww Kamera — Pro Hyper-Edition (Filter Engine v5)
 * 500+ Industry-Standard Filters & Pro Combinations.
 */

const Effects = {
  buffer: [],
  maxBufferSize: 60,

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
          od[tIdx] = d[sIdx]; od[tIdx+1] = d[sIdx+1]; od[tIdx+2] = d[sIdx+2]; od[tIdx+3] = d[sIdx+3];
        }
      }
    }
    ctx.putImageData(out, 0, 0);
  },

  // NEW: Optimized convolution for sharpening, blurring, etc.
  convolve: (px, ctx, w, h, weights) => {
    const side = Math.round(Math.sqrt(weights.length));
    const halfSide = Math.floor(side/2);
    const src = px.data;
    const sw = w, sh = h;
    const output = ctx.createImageData(w, h);
    const dst = output.data;

    for (let y=0; y<h; y++) {
      for (let x=0; x<w; x++) {
        const sy = y, sx = x, dstOff = (y*w+x)*4;
        let r=0, g=0, b=0;
        for (let cy=0; cy<side; cy++) {
          for (let cx=0; cx<side; cx++) {
            const scy = sy + cy - halfSide;
            const scx = sx + cx - halfSide;
            if (scy >= 0 && scy < sh && scx >= 0 && scx < sw) {
              const srcOff = (scy * sw + scx) * 4;
              const wt = weights[cy * side + cx];
              r += src[srcOff] * wt;
              g += src[srcOff+1] * wt;
              b += src[srcOff+2] * wt;
            }
          }
        }
        dst[dstOff] = r; dst[dstOff+1] = g; dst[dstOff+2] = b; dst[dstOff+3] = 255;
      }
    }
    ctx.putImageData(output, 0, 0);
  },

  // --- 2. THE HYPER SUITE ---

  grid: (ctx, w, h, cols, rows) => {
    const tw = w / cols, th = h / rows;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        // Source whole 1024x768 buffer, draw into specific tile
        ctx.drawImage(video, 0, 0, video.width, video.height, c * tw, r * th, tw, th);
      }
    }
  },

  kaleidoscope: (ctx, w, h, slices = 4) => {
    const halfW = w / 2, halfH = h / 2;
    ctx.save();
    ctx.translate(halfW, halfH);
    for (let i = 0; i < slices; i++) {
        ctx.rotate((Math.PI * 2) / slices);
        ctx.drawImage(video, -halfW/2, -halfH/2, halfW, halfH);
    }
    ctx.restore();
  },

  underwater: (px, ctx, w, h, strength = 1) => {
    const time = Date.now() / 800;
    Effects.map(px, ctx, w, h, (x, y) => {
      const sx = x + Math.sin(y / 20 + time) * (15 * strength);
      const sy = y + Math.cos(x / 20 + time) * (10 * strength);
      return { sx, sy };
    });
  },

  delay: (ctx, w, h, frameOffset = 10) => {
    Effects.updateBuffer(ctx, w, h, 60);
    const targetFrame = Effects.buffer[Math.max(0, Effects.buffer.length - 1 - frameOffset)];
    if (targetFrame) ctx.drawImage(targetFrame, 0, 0);
  },

  updateBuffer: (ctx, w, h, size) => {
    const t = document.createElement('canvas');
    t.width = w; t.height = h;
    t.getContext('2d').drawImage(video, 0, 0, w, h);
    Effects.buffer.push(t);
    if (Effects.buffer.length > size) Effects.buffer.shift();
  },

  // NEW: Pinch / Punch
  pinch: (px, ctx, w, h, strength = 0.5) => {
    const cx = w / 2, cy = h / 2;
    const radius = Math.min(w, h) / 2;
    Effects.map(px, ctx, w, h, (x, y) => {
      let dx = x - cx, dy = y - cy;
      const d = Math.sqrt(dx*dx + dy*dy);
      if (d < radius) {
        const factor = Math.pow(d / radius, strength);
        return { sx: cx + dx * factor, sy: cy + dy * factor };
      }
      return { sx: x, sy: y };
    });
  },

  // NEW: Fisheye
  fisheye: (px, ctx, w, h, zoom = 1) => {
    const cx = w/2, cy = h/2;
    Effects.map(px, ctx, w, h, (x, y) => {
      let dx = (x - cx) / cx, dy = (y - cy) / cy;
      let r = Math.sqrt(dx*dx + dy*dy);
      if (r < 1) {
        let nr = (1 - Math.sqrt(1 - r*r)) / 2 + r / 2;
        nr *= zoom;
        return { sx: cx + (dx/r) * nr * cx, sy: cy + (dy/r) * nr * cy };
      }
      return { sx: x, sy: y };
    });
  },

  // NEW: Pixelate
  pixelate: (ctx, w, h, size = 10) => {
    ctx.drawImage(video, 0, 0, w / size, h / size);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(canvas, 0, 0, w / size, h / size, 0, 0, w, h);
    ctx.imageSmoothingEnabled = true;
  },

  // NEW: Dot Screen (Halftone)
  dotScreen: (px, ctx, w, h, size = 10) => {
    const d = px.data;
    ctx.fillStyle = '#000'; ctx.fillRect(0,0,w,h);
    for (let y = 0; y < h; y += size) {
      for (let x = 0; x < w; x += size) {
        const i = (y * w + x) * 4;
        const avg = (d[i] + d[i+1] + d[i+2]) / 3;
        const r = (avg / 255) * (size / 2);
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(x + size/2, y + size/2, r, 0, Math.PI * 2);
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
      const r = d[i], g = d[i+1], b = d[i+2];
      od[i] = r*m[0] + g*m[1] + b*m[2] + m[4]*255;
      od[i+1] = r*m[5] + g*m[6] + b*m[7] + m[9]*255;
      od[i+2] = r*m[10] + g*m[11] + b*m[12] + m[14]*255;
      od[i+3] = d[i+3];
    }
    ctx.putImageData(out, 0, 0);
  },

  twirl: (px, ctx, w, h, angle = 2) => {
    const cx = w / 2, cy = h / 2;
    const radius = Math.min(w, h) / 2;
    Effects.map(px, ctx, w, h, (x, y) => {
      let dx = x - cx, dy = y - cy;
      const d = Math.sqrt(dx*dx + dy*dy);
      if (d < radius) {
        const a = Math.atan2(dy, dx) + angle * (radius - d) / radius;
        return { sx: cx + d * Math.cos(a), sy: cy + d * Math.sin(a) };
      }
      return { sx: x, sy: y };
    });
  },

  // NEW: Liquid Wave Engine
  liquid: (px, ctx, w, h, strength = 10, freq = 0.05) => {
    const time = Date.now() / 1000;
    Effects.map(px, ctx, w, h, (x, y) => {
      const sx = x + Math.sin(y * freq + time) * strength;
      const sy = y + Math.cos(x * freq + time) * strength;
      return { sx, sy };
    });
  },

  // NEW: Spherical Bubble Refraction
  bubble: (px, ctx, w, h, size = 0.4, intensity = 0.15) => {
    const cx = w/2, cy = h/2;
    const radius = Math.min(w, h) * size;
    Effects.map(px, ctx, w, h, (x, y) => {
      const dx = x - cx, dy = y - cy;
      const d = Math.sqrt(dx*dx + dy*dy);
      if (d < radius) {
        const f = 1 + (Math.sin((d/radius) * Math.PI/2) * intensity);
        return { sx: cx + dx * f, sy: cy + dy * f };
      }
      return { sx: x, sy: y };
    });
  }
};



// --- THE 500+ HYPER CONFIG ---
const FILTER_CONFIG = [
  { id: 'original', name: 'Original', cat: 'all', method: (px, ctx) => ctx.drawImage(video, 0,0) }
];

// A. CATEGORIZED BASE
const BASE_MODES = [
  { id: 'grid-2',     name: 'Double Take',   cat: 'mirror', params: [2, 1] },
  { id: 'grid-v',     name: 'Top Bottom',    cat: 'mirror', params: [1, 2] },
  { id: 'grid-4',     name: 'Quad Cam',      cat: 'mirror', params: [2, 2] },
  { id: 'grid-9',     name: 'Film Strip',    cat: 'mirror', params: [3, 3] },
  { id: 'grid-16',    name: '16-Bits Pro',   cat: 'mirror', params: [4, 4] },
  { id: 'grid-100',   name: 'INCEPTION',     cat: 'mirror', params: [6, 6] }
];

BASE_MODES.forEach(m => {
  FILTER_CONFIG.push({ id: m.id, name: m.name, cat: m.cat, method: (px, ctx, w, h) => Effects.grid(ctx, w, h, ...m.params) });
});

[4, 6, 8, 10, 12, 14, 16, 20, 24, 32].forEach(s => {
    FILTER_CONFIG.push({ id: `kaleido-${s}`, name: `Kaleido ${s}`, cat: 'mirror', method: (px, ctx, w, h) => Effects.kaleidoscope(ctx, w, h, s) });
});

// B. COLOR SUITE (350+)
for (let h = 0; h < 360; h += 2) {
  FILTER_CONFIG.push({ id: `hue-${h}`, name: `Aura ${h}°`, cat: 'color', 
    method: (px, ctx, w, hv) => { ctx.save(); ctx.filter = `hue-rotate(${h}deg) saturate(1.5)`; ctx.drawImage(video,0,0,w,hv); ctx.restore(); }
  });
}

const CINEMATIC = [
  "Tokyo", "Berlin", "Paris", "Bali", "Iceland", "Cyberpunk", "London", "Sahara", "Pacific", "Autumn", "Spring", "Summer", "Winter", 
  "Vaporwave", "Synthwave", "Kodak", "Fuji", "VHS", "Retro", "Noir", "Golden", "Rose", "Teal", "Sepia", "Vintage", "Classic", 
  "Hyper", "Dream", "Mars", "Jupiter", "Neon", "Plastic", "Metallic", "Glass", "Oil", "Water", "Sky", "Fire", "Earth", "Space",
  "Shadow", "Crystal", "Ruby", "Emerald", "Sapphire", "Amber", "Cosmos", "Galaxy", "Nova", "Stellar"
];

CINEMATIC.forEach((name, i) => {
    FILTER_CONFIG.push({ id: `lut-${i}a`, name: `${name} A`, cat: 'color', 
      method: (px, ctx, w, hv) => { ctx.save(); ctx.filter = `sepia(${0.03*i}) hue-rotate(${i*8}deg) saturate(1.8)`; ctx.drawImage(video,0,0,w,hv); ctx.restore(); }
    });
    FILTER_CONFIG.push({ id: `lut-${i}b`, name: `${name} B`, cat: 'color', 
      method: (px, ctx, w, hv) => { ctx.save(); ctx.filter = `contrast(${1.1+i*0.015}) brightness(${0.9+i*0.005}) saturate(${1+i*0.03})`; ctx.drawImage(video,0,0,w,hv); ctx.restore(); }
    });
    FILTER_CONFIG.push({ id: `lut-${i}c`, name: `${name} C`, cat: 'color', 
      method: (px, ctx, w, hv) => { ctx.save(); ctx.filter = `invert(0.1) hue-rotate(${i*12}deg) contrast(1.4)`; ctx.drawImage(video,0,0,w,hv); ctx.restore(); }
    });
});

// C. DISTORTION SUITE (200+)
for (let s = 1; s <= 20; s++) {
  FILTER_CONFIG.push({ id: `twirl-${s}`, name: `Swirl ${s}`, cat: 'distort', method: (px, ctx, w, h) => Effects.twirl(px, ctx, w, h, s * 0.3) });
  FILTER_CONFIG.push({ id: `pinch-${s}`, name: `Pinch ${s}`, cat: 'distort', method: (px, ctx, w, h) => Effects.pinch(px, ctx, w, h, 0.05 * s) });
  FILTER_CONFIG.push({ id: `punch-${s}`, name: `Punch ${s}`, cat: 'distort', method: (px, ctx, w, h) => Effects.pinch(px, ctx, w, h, 1 + s * 0.1) });
  FILTER_CONFIG.push({ id: `fisheye-${s}`, name: `Fisheye ${s}`, cat: 'distort', method: (px, ctx, w, h) => Effects.fisheye(px, ctx, w, h, 0.3 + s * 0.08) });
}

for (let s = -0.9; s <= 0.9; s += 0.05) {
  if (Math.abs(s) < 0.05) continue;
  FILTER_CONFIG.push({ id: `bulge-${s.toFixed(2)}`, name: `Warp ${s.toFixed(2)}`, cat: 'distort', 
    method: (px, ctx, w, h) => {
        const time = Date.now() / 1000;
        Effects.map(px, ctx, w, h, (x, y) => {
            const dx = (x - w/2)/(w/2), dy = (y - h/2)/(h/2);
            const dist = Math.sqrt(dx*dx + dy*dy);
            const factor = 1 + dist * (s + Math.sin(time)*0.1);
            return { sx: w/2 + (dx * factor) * (w/2), sy: h/2 + (dy * factor) * (h/2) };
        });
    }
  });
}


// D. ARTISTIC & PIXEL (50+)
[2, 4, 8, 12, 16, 24, 32, 48, 64].forEach(s => {
  FILTER_CONFIG.push({ id: `pixel-${s}`, name: `Pixel ${s}`, cat: 'distort', method: (px, ctx, w, h) => Effects.pixelate(ctx, w, h, s) });
  FILTER_CONFIG.push({ id: `dot-${s}`, name: `Dots ${s}`, cat: 'distort', method: (px, ctx, w, h) => Effects.dotScreen(px, ctx, w, h, s) });
});

FILTER_CONFIG.push({ id: 'underwater-pro', name: 'Coral Reef', cat: 'distort', method: (px, ctx, w, h) => Effects.underwater(px, ctx, w, h, 1.2) });
FILTER_CONFIG.push({ id: 'ghost-pro', name: 'RGB GHOST', cat: 'motion', method: (px, ctx, w, h) => {
    Effects.updateBuffer(ctx, w, h, 15);
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    if (Effects.buffer[0]) { ctx.globalAlpha = 0.5; ctx.filter = 'hue-rotate(0deg)'; ctx.drawImage(Effects.buffer[0], 0,0); }
    if (Effects.buffer[7]) { ctx.globalAlpha = 0.5; ctx.filter = 'hue-rotate(120deg)'; ctx.drawImage(Effects.buffer[7], 0,0); }
    if (Effects.buffer[14]) { ctx.globalAlpha = 0.5; ctx.filter = 'hue-rotate(240deg)'; ctx.drawImage(Effects.buffer[14], 0,0); }
    ctx.restore();
}});

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
BASE_MODES.filter(g => g.id !== 'grid-16' && g.id !== 'grid-100').forEach(grid => {
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

// G. LIQUID SUITE (50 NEW WAVES)
for (let s = 1; s <= 50; s++) {
  const strength = 5 + (s * 0.5);
  const freq = 0.02 + (s * 0.002);
  FILTER_CONFIG.push({ id: `wave-${s}`, name: `Wave ${s}`, cat: 'distort', method: (px, ctx, w, h) => Effects.liquid(px, ctx, w, h, strength, freq) });
}

// H. BUBBLE SUITE (50 NEW SPHERICAL)
for (let s = 1; s <= 50; s++) {
  const size = 0.2 + (s * 0.015);
  const intensity = 0.05 + (s * 0.005);
  FILTER_CONFIG.push({ id: `bubble-${s}`, name: `Bubble ${s}`, cat: 'distort', method: (px, ctx, w, h) => Effects.bubble(px, ctx, w, h, size, intensity) });
}

// I. SWEET COLLECTION (100 NEW CUTE FILTERS)
const SWEET_NAMES = ["Sakura", "Peach", "Candy", "Mint", "Bloom", "Sugar", "Honey", "Kawaii", "Dreamy", "Pastel", "Lush", "Velvet", "Glow", "Sparkle", "Sweet", "Cookie", "Berry", "Fluff", "Cloud", "Sunny"];
SWEET_NAMES.forEach((name, i) => {
  for (let variant = 1; variant <= 5; variant++) {
      const h = i * 18 + (variant * 5);
      const sat = 1.2 + (variant * 0.1);
      const b = 1 + (variant * 0.03);
      FILTER_CONFIG.push({ 
        id: `sweet-${i}-${variant}`, 
        name: `${name} ${variant}`, 
        cat: 'sweet', 
        method: (px, ctx, w, hv) => { 
          ctx.save(); 
          ctx.filter = `hue-rotate(${h}deg) saturate(${sat}) brightness(${b}) contrast(1.1) sepia(0.1)`; 
          ctx.drawImage(video,0,0,w,hv); 
          ctx.restore(); 
        }
      });
  }
});
