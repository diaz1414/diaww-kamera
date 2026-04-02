/**
 * Diaww Kamera — Pro Edition (App Logic v7)
 * Clean, working Dark/Light Mode + Filter Grid + 500+ Filters
 */

const App = {
  isDark: true,
  currentFilterIndex: 0,
  currentCategory: 'all',
  searchQuery: '',
  favorites: JSON.parse(localStorage.getItem('diaww_favs') || '[]'),
  settings: JSON.parse(localStorage.getItem('diaww_settings') || `{
    "mirror": true,
    "countdown": true,
    "flash": true,
    "square": false,
    "deviceId": ""
  }`),

  // ─── INIT ────────────────────────────────────────────────────────────────────
  init() {
    App.applyTheme(localStorage.getItem('diaww_theme') !== 'light');
    lucide.createIcons();
    App.bindEvents();
    App.bindCategoryEvents();
    App.loadCameras();
    App.applySettingsUI();
    // Render grid in background so it's fast when opened
    setTimeout(() => App.renderFilterGrid(), 100);
  },

  // ─── THEME ───────────────────────────────────────────────────────────────────
  applyTheme(dark) {
    App.isDark = dark;
    const html = document.documentElement;
    const body = document.getElementById('app-body');
    const overlay = document.getElementById('filter-grid-overlay');
    const gridHeader = document.getElementById('grid-header');

    if (dark) {
      html.classList.add('dark');
      body.style.background = '#080808';
      body.style.color = '#F4F1E8';
      if (overlay) {
        overlay.style.setProperty('--grid-bg', 'rgba(8,8,8,0.97)');
        overlay.style.setProperty('--grid-header-bg', 'rgba(8,8,8,0.9)');
        overlay.style.setProperty('--grid-border', 'rgba(255,255,255,0.07)');
        overlay.style.setProperty('--grid-input-bg', 'rgba(255,255,255,0.06)');
        overlay.style.setProperty('--grid-input-focus', 'rgba(255,255,255,0.10)');
        overlay.style.setProperty('--grid-text', '#F4F1E8');
        overlay.style.setProperty('--grid-sub', 'rgba(255,255,255,0.30)');
        overlay.style.setProperty('--grid-placeholder', 'rgba(255,255,255,0.30)');
        overlay.style.setProperty('--grid-border-tab', 'rgba(255,255,255,0.12)');
        overlay.style.setProperty('--grid-tab-text', 'rgba(255,255,255,0.55)');
      }
    } else {
      html.classList.remove('dark');
      body.style.background = '#F4F1E8';
      body.style.color = '#111111';
      if (overlay) {
        overlay.style.setProperty('--grid-bg', 'rgba(244,241,232,0.97)');
        overlay.style.setProperty('--grid-header-bg', 'rgba(244,241,232,0.92)');
        overlay.style.setProperty('--grid-border', 'rgba(0,0,0,0.08)');
        overlay.style.setProperty('--grid-input-bg', 'rgba(0,0,0,0.04)');
        overlay.style.setProperty('--grid-input-focus', 'rgba(255,255,255,0.90)');
        overlay.style.setProperty('--grid-text', '#111111');
        overlay.style.setProperty('--grid-sub', 'rgba(0,0,0,0.40)');
        overlay.style.setProperty('--grid-placeholder', 'rgba(0,0,0,0.35)');
        overlay.style.setProperty('--grid-border-tab', 'rgba(0,0,0,0.12)');
        overlay.style.setProperty('--grid-tab-text', 'rgba(0,0,0,0.55)');
      }
    }

    localStorage.setItem('diaww_theme', dark ? 'dark' : 'light');
  },

  // ─── EVENTS ──────────────────────────────────────────────────────────────────
  bindEvents() {
    // Screen Navigation
    const $  = id => document.getElementById(id);
    $('start-btn').onclick   = () => App.goTo('camera-interface', () => Camera.init());
    $('back-btn').onclick    = () => App.goTo('camera-interface');

    // Filter Navigation
    document.querySelector('.prev-filter').onclick = () => App.shiftFilter(-1);
    document.querySelector('.next-filter').onclick = () => App.shiftFilter(1);
    $('random-filter').onclick = App.randomFilter;

    // Grid
    $('grid-toggle').onclick = () => { App.openGrid(); };
    $('close-grid').onclick  = () => App.closeGrid();

    // Search
    $('filter-search').oninput = e => {
      App.searchQuery = e.target.value.toLowerCase();
      App.renderFilterGrid();
    };

    // Capture
    $('capture-trigger').onclick = () => App.startCountdown();
    $('save-btn').onclick = App.saveImage;

    // Advanced Settings Toggle
    $('theme-toggle').onclick = () => App.toggleSettings(true);
    $('close-settings').onclick = () => App.toggleSettings(false);

    // Settings Inputs
    $('set-mirror').onchange = e => App.updateSetting('mirror', e.target.checked);
    $('set-countdown').onchange = e => App.updateSetting('countdown', e.target.checked);
    $('set-flash').onchange = e => App.updateSetting('flash', e.target.checked);
    $('set-square').onchange = e => {
      App.updateSetting('square', e.target.checked);
      Camera.stop();
      Camera.init(App.settings.deviceId);
    };

    $('camera-select').onchange = e => {
      App.updateSetting('deviceId', e.target.value);
      Camera.stop();
      Camera.init(e.target.value);
    };

    $('toggle-fullscreen').onclick = App.toggleFullscreen;

    // Flip Camera (Header alternative)
    const flipBtn = $('flip-camera');
    if (flipBtn) {
      flipBtn.onclick = () => {
        Camera.flip();
        gsap.to(flipBtn, { rotate: '+=180', duration: 0.4 });
      };
    }
  },

  bindCategoryEvents() {
    document.querySelectorAll('.cat-tab').forEach(btn => {
      btn.onclick = () => {
        document.querySelectorAll('.cat-tab').forEach(t => {
          t.classList.remove('bg-gold-500', 'text-dark-900', 'shadow-lg');
          t.style.color = 'var(--grid-tab-text, rgba(255,255,255,0.55))';
          t.style.border = '1px solid var(--grid-border-tab, rgba(255,255,255,0.12))';
        });
        btn.classList.add('bg-gold-500', 'text-dark-900', 'shadow-lg');
        btn.style.color = '';
        btn.style.border = 'none';
        App.currentCategory = btn.dataset.cat;
        App.renderFilterGrid();
      };
    });
  },

  // ─── SCREEN ROUTING ──────────────────────────────────────────────────────────
  goTo(id, callback) {
    document.querySelectorAll('section').forEach(s => {
      s.classList.remove('active');
      s.style.display = 'none';
    });
    const target = document.getElementById(id);
    if (target) {
      target.style.display = 'flex';
      target.classList.add('active');
    }
    if (callback) callback();
  },

  // ─── FILTER GRID ─────────────────────────────────────────────────────────────
  openGrid() {
    const overlay = document.getElementById('filter-grid-overlay');
    overlay.classList.remove('hidden');
    overlay.style.display = 'flex';
    App.applyTheme(App.isDark); // Re-apply CSS vars to ensure correct theme
    App.renderFilterGrid();
  },

  closeGrid() {
    const overlay = document.getElementById('filter-grid-overlay');
    overlay.classList.add('hidden');
    overlay.style.display = 'none';
  },

  renderFilterGrid() {
    const container = document.getElementById('grid-items-container');
    const searchInput = document.getElementById('filter-search');
    if (!container) return;

    let list = [...FILTER_CONFIG];

    // Search
    if (App.searchQuery) {
      list = list.filter(f =>
        f.name.toLowerCase().includes(App.searchQuery) ||
        f.id.toLowerCase().includes(App.searchQuery)
      );
    }

    // Category
    const cat = App.currentCategory;
    if (cat === 'fav') {
      list = list.filter(f => App.favorites.includes(f.id));
    } else if (cat === 'combo') {
      list = list.filter(f => f.id.startsWith('combo-'));
    } else if (cat !== 'all') {
      list = list.filter(f => f.cat === cat);
    }

    // Update count label
    const label = document.getElementById('filter-count-label');
    if (label) label.textContent = `${list.length} FILTER — TAILWIND v4`;

    // Render
    const frag = document.createDocumentFragment();
    list.forEach((f, i) => {
      const isFav = App.favorites.includes(f.id);
      const el = document.createElement('div');
      el.style.animationDelay = `${i * 0.01}s`;

      // Compute CSS filter for preview thumbnail
      let cssFilter = 'none';
      if (f.id.includes('hue-')) {
        const deg = f.id.split('-')[1] || '0';
        cssFilter = `hue-rotate(${deg}deg) saturate(2)`;
      } else if (f.id.includes('noir')) {
        cssFilter = 'grayscale(1) contrast(1.4)';
      } else if (f.id.includes('cyber')) {
        cssFilter = 'hue-rotate(186deg) saturate(2.5)';
      } else if (f.id.includes('neon')) {
        cssFilter = 'hue-rotate(270deg) saturate(3)';
      } else if (f.id.includes('lut-')) {
        const idx = parseInt(f.id.split('-')[1]) || 0;
        cssFilter = `sepia(0.4) hue-rotate(${idx * 14}deg) saturate(1.6)`;
      }

      const cardBg = App.isDark ? '#1a1a1a' : '#ffffff';
      const cardBorder = App.isDark ? '1px solid rgba(255,255,255,0.07)' : '1px solid rgba(0,0,0,0.08)';
      el.className = 'group relative rounded-2xl overflow-hidden cursor-pointer transition-all duration-300 hover:-translate-y-1.5 hover:shadow-[0_12px_40px_rgba(212,175,55,0.25)] fade-up';
      el.style.aspectRatio = '1/1.15';
      el.style.background = cardBg;
      el.style.border = cardBorder;
      el.innerHTML = `
        <img src="https://images.unsplash.com/photo-1542281286-9e0a16bb7366?auto=format&fit=crop&q=80&w=280&h=280"
             style="filter:${cssFilter};width:100%;height:75%;object-fit:cover;display:block;transition:transform 0.6s;"
             loading="eager">
        <div style="position:absolute;inset:0;background:linear-gradient(to top, rgba(0,0,0,0.75) 0%, transparent 55%);pointer-events:none;"></div>
        <button class="fav-icon" data-id="${f.id}" title="Favorit"
          style="position:absolute;top:8px;right:8px;width:32px;height:32px;border-radius:50%;background:rgba(0,0,0,0.45);backdrop-filter:blur(4px);border:none;color:${isFav ? '#D4AF37' : '#fff'};cursor:pointer;opacity:${isFav ? '1' : '0'};transition:opacity 0.2s;display:flex;align-items:center;justify-content:center;">
          <i data-lucide="star" style="width:14px;height:14px;${isFav ? 'fill:#D4AF37;' : ''}"></i>
        </button>
        <div style="position:absolute;bottom:0;left:0;right:0;padding:8px 10px;text-align:center;">
          <span style="font-size:0.6rem;font-weight:900;letter-spacing:0.15em;text-transform:uppercase;color:#fff;">${f.name}</span>
        </div>
      `;

      // Hover reveal fav btn
      el.addEventListener('mouseenter', () => {
        const btn = el.querySelector('.fav-icon');
        if (btn) btn.style.opacity = '1';
        const img = el.querySelector('img');
        if (img) img.style.transform = 'scale(1.08)';
      });
      el.addEventListener('mouseleave', () => {
        const btn = el.querySelector('.fav-icon');
        if (btn && !App.favorites.includes(f.id)) btn.style.opacity = '0';
        const img = el.querySelector('img');
        if (img) img.style.transform = 'scale(1)';
      });

      el.onclick = e => {
        if (e.target.closest('.fav-icon')) {
          App.toggleFav(f.id);
        } else {
          App.activateFilter(f);
          App.closeGrid();
        }
      };

      frag.appendChild(el);
    });

    container.innerHTML = '';
    container.appendChild(frag);
    lucide.createIcons();
  },

  // ─── FILTER CONTROL ──────────────────────────────────────────────────────────
  activateFilter(f) {
    Camera.setEffect(f.id);
    App.currentFilterIndex = FILTER_CONFIG.indexOf(f);
    const label = document.getElementById('active-filter-name');
    if (label) {
      label.textContent = f.name.toUpperCase();
      gsap.fromTo(label, { opacity: 0, y: 6 }, { opacity: 1, y: 0, duration: 0.35 });
    }
  },

  shiftFilter(dir) {
    App.currentFilterIndex = (App.currentFilterIndex + dir + FILTER_CONFIG.length) % FILTER_CONFIG.length;
    App.activateFilter(FILTER_CONFIG[App.currentFilterIndex]);
  },

  randomFilter() {
    const idx = Math.floor(Math.random() * FILTER_CONFIG.length);
    App.currentFilterIndex = idx;
    App.activateFilter(FILTER_CONFIG[idx]);
    confetti({ particleCount: 35, spread: 55, origin: { y: 0.85 }, colors: ['#D4AF37'] });
  },

  toggleFav(id) {
    if (App.favorites.includes(id)) {
      App.favorites = App.favorites.filter(x => x !== id);
    } else {
      App.favorites.push(id);
    }
    localStorage.setItem('diaww_favs', JSON.stringify(App.favorites));
    App.renderFilterGrid();
  },

  // ─── CAPTURE ─────────────────────────────────────────────────────────────────
  startCountdown() {
    if (!App.settings.countdown) {
      App.doCapture();
      return;
    }
    const overlay = document.getElementById('countdown-overlay');
    const num = document.getElementById('countdown-number');
    let count = 3;
    overlay.style.display = 'flex';
    overlay.classList.remove('hidden');
    num.textContent = count;
    App.Sound.tick();
    gsap.fromTo(num, { scale: 0.4, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.4 });

    const timer = setInterval(() => {
      count--;
      if (count > 0) {
        num.textContent = count;
        App.Sound.tick();
        gsap.fromTo(num, { scale: 0.4, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.4 });
      } else {
        clearInterval(timer);
        overlay.classList.add('hidden');
        overlay.style.display = 'none';
        App.doCapture();
      }
    }, 1000);
  },

  doCapture() {
    App.Sound.shutter();
    if (App.settings.flash) {
      const flash = document.getElementById('shutter-flash');
      gsap.fromTo(flash, { opacity: 1 }, { opacity: 0, duration: 0.5 });
    }

    const dataUrl = Camera.capture();
    if (!dataUrl) return;

    const rc = document.getElementById('result-canvas');
    const ctx = rc.getContext('2d');
    const img = new Image();
    img.onload = () => {
      rc.width = img.width;
      rc.height = img.height;
      ctx.drawImage(img, 0, 0);
      App.goTo('result-screen');
      setTimeout(() => {
        confetti({ particleCount: 200, spread: 90, origin: { y: 0.6 }, colors: ['#D4AF37', '#F4F1E8', '#B8962E'] });
      }, 200);
    };
    img.src = dataUrl;
  },

  saveImage() {
    const canvas = document.getElementById('result-canvas');
    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/jpeg', 0.96);
    a.download = `DIAWW-${Date.now()}.jpg`;
    a.click();
  },

  // ─── AUDIO ENGINE ────────────────────────────────────────────────────────────
  Sound: {
    ctx: null,
    init() {
      if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    },
    tick() {
      try {
        this.init();
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.frequency.setValueAtTime(880, this.ctx.currentTime);
        gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.08);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.1);
      } catch (e) {}
    },
    shutter() {
      try {
        this.init();
        // White noise burst for "click"
        const bufferSize = this.ctx.sampleRate * 0.12;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'highpass';
        filter.frequency.value = 800;

        const gain = this.ctx.createGain();
        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.ctx.destination);

        gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.12);
        noise.start();
      } catch (e) {}
    }
  },

  // ─── SETTINGS LOGIC ──────────────────────────────────────────────────────────
  toggleSettings(show) {
    const panel = document.getElementById('settings-panel');
    if (show) {
      panel.classList.remove('hidden');
      lucide.createIcons();
      gsap.fromTo(panel, { opacity: 0, x: -20 }, { opacity: 1, x: 0, duration: 0.4, ease: "power2.out" });
    } else {
      gsap.to(panel, { opacity: 0, x: -20, duration: 0.3, onComplete: () => panel.classList.add('hidden') });
    }
  },

  updateSetting(key, val) {
    App.settings[key] = val;
    localStorage.setItem('diaww_settings', JSON.stringify(App.settings));
  },

  applySettingsUI() {
    const s = App.settings;
    if (document.getElementById('set-mirror'))    document.getElementById('set-mirror').checked = s.mirror;
    if (document.getElementById('set-countdown')) document.getElementById('set-countdown').checked = s.countdown;
    if (document.getElementById('set-flash'))     document.getElementById('set-flash').checked = s.flash;
    if (document.getElementById('set-square'))    document.getElementById('set-square').checked = s.square;
  },

  async loadCameras() {
    const list = document.getElementById('camera-options-list');
    const trigger = document.getElementById('camera-select-trigger');
    const activeName = document.getElementById('camera-active-name');
    if (!list) return;

    // Toggle Dropdown
    trigger.onclick = (e) => {
      e.stopPropagation();
      const isOpen = !list.classList.contains('hidden');
      if (isOpen) {
        this.closeCameraDropdown();
      } else {
        this.openCameraDropdown();
      }
    };

    // Global Click Outside
    document.addEventListener('click', () => {
      this.closeCameraDropdown();
    });

    navigator.mediaDevices.enumerateDevices().then(devices => {
      const videoDevices = devices.filter(d => d.kind === 'videoinput');
      list.innerHTML = '';

      if (videoDevices.length === 0) {
        activeName.textContent = "No Camera Found";
        return;
      }

      videoDevices.forEach((device, index) => {
        const label = device.label || `Camera ${index + 1}`;
        const item = document.createElement('div');
        item.className = 'px-5 py-3.5 text-xs text-white/70 hover:bg-gold-500 hover:text-dark-950 transition-all cursor-pointer flex items-center justify-between group';
        item.innerHTML = `
          <span class="truncate">${label}</span>
          <i data-lucide="check" size="12" class="opacity-0 group-hover:opacity-100"></i>
        `;
        
        item.onclick = (e) => {
          e.stopPropagation();
          activeName.textContent = label;
          this.closeCameraDropdown();
          Camera.init(device.deviceId);
        };

        list.appendChild(item);
        if (index === 0) activeName.textContent = label;
      });
      
      lucide.createIcons();
    });
  },

  openCameraDropdown() {
    const list = document.getElementById('camera-options-list');
    const icon = document.querySelector('#camera-select-trigger i');
    list.classList.remove('hidden');
    gsap.fromTo(list, { opacity: 0, y: -10 }, { opacity: 1, y: 0, duration: 0.3, ease: 'power2.out' });
    gsap.to(icon, { rotate: 180, duration: 0.3 });
  },

  closeCameraDropdown() {
    const list = document.getElementById('camera-options-list');
    const icon = document.querySelector('#camera-select-trigger i');
    if (!list || list.classList.contains('hidden')) return;
    gsap.to(list, { opacity: 0, y: -10, duration: 0.2, onComplete: () => list.classList.add('hidden') });
    gsap.to(icon, { rotate: 0, duration: 0.3 });
  },

  toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => {
        alert(`Error attempting to enable fullscreen mode: ${err.message}`);
      });
    } else {
      if (document.exitFullscreen) document.exitFullscreen();
    }
  }
};

window.addEventListener('load', () => App.init());
