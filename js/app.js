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
  gridPage: 0,
  itemsPerPage: 4,
  previewRunning: false,
  previewItems: [],

  // ─── INIT ────────────────────────────────────────────────────────────────────
  init() {
    App.applyTheme(localStorage.getItem('diaww_theme') !== 'light');
    lucide.createIcons();
    App.bindEvents();
    App.bindCategoryEvents();
    App.applySettingsUI();
    // loadCameras() now called after stream ready to ensure labels exist
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
    const $ = id => document.getElementById(id);
    $('start-btn').onclick = () => {
      App.goTo('camera-interface');
      Camera.init(App.settings.deviceId).then(() => App.loadCameras());
    };
    $('back-btn').onclick = () => App.goTo('camera-interface');

    // Filter Navigation
    document.querySelector('.prev-filter').onclick = () => App.shiftFilter(-1);
    document.querySelector('.next-filter').onclick = () => App.shiftFilter(1);
    $('random-filter').onclick = App.randomFilter;

    // Grid
    $('grid-toggle').onclick = () => { App.openGrid(); };
    $('close-grid').onclick = () => App.closeGrid();

    // Search
    $('filter-search').oninput = e => {
      App.searchQuery = e.target.value.toLowerCase();
      App.gridPage = 0; // Reset on search
      App.renderFilterGrid();
    };

    $('grid-prev').onclick = () => {
      if (App.gridPage > 0) {
        App.gridPage--;
        App.renderFilterGrid();
      }
    };
    $('grid-next').onclick = () => {
      const filtered = App.getFilteredList();
      if ((App.gridPage + 1) * App.itemsPerPage < filtered.length) {
        App.gridPage++;
        App.renderFilterGrid();
      }
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

    $('toggle-fullscreen').onclick = () => App.toggleFullscreen();

    // Flip Camera (Header alternative)
    const flipBtn = $('flip-camera');
    if (flipBtn) {
      flipBtn.onclick = () => {
        Camera.flip().then(() => App.loadCameras());
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
        App.gridPage = 0; // Reset on category change
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
    App.stopPreviewLoop();
  },

  getFilteredList() {
    let list = [...FILTER_CONFIG];
    if (App.searchQuery) {
      list = list.filter(f =>
        f.name.toLowerCase().includes(App.searchQuery) ||
        f.id.toLowerCase().includes(App.searchQuery)
      );
    }
    const cat = App.currentCategory;
    if (cat === 'fav') {
      list = list.filter(f => App.favorites.includes(f.id));
    } else if (cat === 'combo') {
      list = list.filter(f => f.id.startsWith('combo-'));
    } else if (cat !== 'all') {
      list = list.filter(f => f.cat === cat);
    }
    return list;
  },

  renderFilterGrid() {
    const container = document.getElementById('grid-items-container');
    if (!container) return;

    const list = App.getFilteredList();
    const totalPages = Math.ceil(list.length / App.itemsPerPage);
    const pageItems = list.slice(App.gridPage * App.itemsPerPage, (App.gridPage + 1) * App.itemsPerPage);

    // Update pagination UI
    const prevBtn = document.getElementById('grid-prev');
    const nextBtn = document.getElementById('grid-next');
    const info = document.getElementById('grid-page-info');
    const dotsContainer = document.getElementById('grid-dots');

    if (prevBtn) prevBtn.disabled = App.gridPage === 0;
    if (nextBtn) nextBtn.disabled = (App.gridPage + 1) >= totalPages;
    if (info) info.textContent = `Halaman ${App.gridPage + 1} dari ${totalPages || 1}`;

    // Update Dots
    if (dotsContainer) {
      dotsContainer.innerHTML = '';
      const maxDots = 5;
      const start = Math.max(0, Math.min(App.gridPage - 2, totalPages - maxDots));
      const end = Math.min(totalPages, start + maxDots);
      for (let i = start; i < end; i++) {
        const dot = document.createElement('div');
        dot.className = `w-1.5 h-1.5 rounded-full transition-all duration-300 ${i === App.gridPage ? 'bg-gold-500 w-4' : 'bg-white/20'}`;
        dotsContainer.appendChild(dot);
      }
    }

    // Render 4 items
    App.stopPreviewLoop();
    container.innerHTML = '';
    App.previewItems = [];

    pageItems.forEach((f, i) => {
      const isFav = App.favorites.includes(f.id);
      const el = document.createElement('div');
      el.className = 'group relative rounded-3xl overflow-hidden cursor-pointer transition-all duration-500 bg-white/5 border border-white/10 hover:border-gold-500 shadow-2xl flex flex-col';
      el.innerHTML = `
        <div class="flex-1 relative overflow-hidden bg-black">
          <canvas class="preview-canvas w-full h-full object-cover"></canvas>
          <div class="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/80 to-transparent pointer-events-none"></div>
          
          <!-- Favorite Button -->
          <button class="fav-icon-grid absolute top-4 right-4 w-10 h-10 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center transition-all duration-300 hover:scale-110 ${isFav ? 'text-gold-500' : 'text-white'}" data-id="${f.id}">
             <i data-lucide="star" style="width:20px;height:20px;" class="${isFav ? 'fill-gold-500' : ''}"></i>
          </button>
        </div>

        <div class="p-5 md:p-8 flex items-center justify-between">
           <div class="flex flex-col">
              <span class="text-xs uppercase tracking-[0.3em] font-black text-gold-500">${f.name}</span>
              <span class="text-[0.6rem] text-white/30 uppercase tracking-widest mt-1">${f.cat} EFFECT</span>
           </div>
           <i data-lucide="arrow-right-circle" class="text-white/20 group-hover:text-gold-500 group-hover:translate-x-1 transition-all"></i>
        </div>
      `;

      const canvas = el.querySelector('canvas');
      App.previewItems.push({ canvas, method: f.method, id: f.id });

      el.onclick = e => {
        if (e.target.closest('.fav-icon-grid')) {
          App.toggleFavGrid(f.id);
        } else {
          App.activateFilter(f);
          App.closeGrid();
        }
      };
      container.appendChild(el);
    });

    lucide.createIcons();
    App.startPreviewLoop();
  },

  toggleFavGrid(id) {
    if (App.favorites.includes(id)) {
      App.favorites = App.favorites.filter(x => x !== id);
    } else {
      App.favorites.push(id);
    }
    localStorage.setItem('diaww_favs', JSON.stringify(App.favorites));
    App.renderFilterGrid();
  },

  startPreviewLoop() {
    App.previewRunning = true;
    App.drawPreviews();
  },

  stopPreviewLoop() {
    App.previewRunning = false;
  },

  drawPreviews() {
    if (!App.previewRunning) return;
    
    const source = window.video; // Buffer canvas from camera.js
    if (source && source.width > 0) {
      App.previewItems.forEach(item => {
        const { canvas, method } = item;
        const ctx = canvas.getContext('2d');
        if (canvas.width !== 320) { // Set internal resolution for performance
           canvas.width = 320;
           canvas.height = 240;
        }
        
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Pass dummy pixels/ctx to the method if it expects them
        // Some effects use pixel manipulation, others use ctx.drawImage
        // Using temporary canvas or just delegating to the effect
        method(null, ctx, canvas.width, canvas.height);
      });
    }

    requestAnimationFrame(App.drawPreviews);
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
      } catch (e) { }
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
      } catch (e) { }
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
    if (document.getElementById('set-mirror')) document.getElementById('set-mirror').checked = s.mirror;
    if (document.getElementById('set-countdown')) document.getElementById('set-countdown').checked = s.countdown;
    if (document.getElementById('set-flash')) document.getElementById('set-flash').checked = s.flash;
    if (document.getElementById('set-square')) document.getElementById('set-square').checked = s.square;
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

      // Sync with currently active device
      let activeLabel = "Kamera Default";

      videoDevices.forEach((device, index) => {
        const label = device.label || `Camera ${index + 1}`;
        const isActive = (App.settings.deviceId === device.deviceId) || (index === 0 && !App.settings.deviceId);

        if (isActive) {
          activeLabel = label;
          App.settings.deviceId = device.deviceId; // Lock it in
        }

        const item = document.createElement('div');
        item.className = `px-5 py-3.5 text-xs ${isActive ? 'text-gold-500 bg-white/5' : 'text-white/70'} hover:bg-gold-500 hover:text-dark-950 transition-all cursor-pointer flex items-center justify-between group`;
        item.innerHTML = `
          <span class="truncate">${label}</span>
          <i data-lucide="check" style="width:12px;height:12px" class="${isActive ? 'opacity-100' : 'opacity-0'} group-hover:opacity-100 transition-opacity"></i>
        `;

        item.onclick = (e) => {
          e.stopPropagation();
          activeName.textContent = label;
          App.updateSetting('deviceId', device.deviceId);
          this.closeCameraDropdown();
          Camera.stop();
          Camera.init(device.deviceId).then(() => this.loadCameras());
        };

        list.appendChild(item);
      });

      activeName.textContent = activeLabel;
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
    const doc = document.documentElement;
    // Cross-browser fullScreenElement check
    const isFull = document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement;

    if (!isFull) {
      const enter = doc.requestFullscreen || doc.webkitRequestFullscreen || doc.mozRequestFullScreen || doc.msRequestFullscreen;
      if (enter) {
        enter.call(doc).catch(err => {
          console.error("Fullscreen error:", err);
          alert("Gagal masuk ke mode Fullscreen. Coba lagi!");
        });
      } else {
        alert("Browser lo nggak dukung mode Layar Penuh.");
      }
    } else {
      const exit = document.exitFullscreen || document.webkitExitFullscreen || document.mozCancelFullScreen || document.msExitFullscreen;
      if (exit) exit.call(document);
    }
  }
};

window.addEventListener('load', () => App.init());
