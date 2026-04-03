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
    $('start-btn').onclick = () => App.requestCameraPermission();
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
          t.classList.remove('bg-gold-500', 'text-dark-900', 'shadow-[0_4px_15px_rgba(212,175,55,0.3)]');
          t.style.color = 'var(--grid-tab-text, rgba(255,255,255,0.55))';
          t.style.border = '1px solid var(--grid-border-tab, rgba(255,255,255,0.12))';
        });
        btn.classList.add('bg-gold-500', 'text-dark-900', 'shadow-[0_4px_15px_rgba(212,175,55,0.3)]');
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
      // Tidy card: 4:3 aspect, responsive max-width for desktop, glassmorphism info bar
      el.className = 'group relative rounded-3xl overflow-hidden cursor-pointer transition-all duration-500 bg-dark-900 border border-white/5 md:border-white/10 hover:border-gold-500/50 hover:shadow-[0_0_50px_rgba(212,175,55,0.2)] md:hover:shadow-[0_0_60px_rgba(212,175,55,0.25)] flex flex-col w-full max-w-sm md:max-w-md lg:max-w-[32rem] mx-auto active:scale-95 transform-gpu';
      el.innerHTML = `
        <div class="aspect-[4/3] relative overflow-hidden bg-black shrink-0">
          <canvas class="preview-canvas w-full h-full object-cover transition-all duration-1000 group-hover:scale-105 group-hover:blur-[2px]"></canvas>
          
          <!-- Subtle vignette + Gradient -->
          <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20 pointer-events-none opacity-50 group-hover:opacity-75 transition-opacity duration-700"></div>
          
          <!-- Favorite Button (Top Right) -->
          <button class="fav-icon-grid absolute top-5 right-5 w-12 h-12 rounded-full bg-black/40 backdrop-blur-xl border border-white/10 flex items-center justify-center transition-all duration-300 hover:scale-110 hover:bg-gold-500 hover:text-dark-950 ${isFav ? 'text-gold-500' : 'text-white/40'}" data-id="${f.id}">
             <i data-lucide="star" style="width:20px;height:20px;" class="${isFav ? 'fill-gold-500' : ''}"></i>
          </button>

          <!-- Info Bar: Always visible for names, extra details on hover -->
          <div class="absolute inset-x-0 bottom-0 p-5 md:p-6 flex items-end justify-between transition-all duration-500 z-10 pointer-events-none">
             <div class="flex flex-col">
               <span class="text-[0.6rem] font-black uppercase tracking-[0.4em] text-gold-500/90 mb-1.5 opacity-0 group-hover:opacity-100 transition-all duration-700 delay-75 transform -translate-y-1 group-hover:translate-y-0">${f.cat}</span>
               <span class="text-[0.8rem] md:text-[0.95rem] font-bold text-white uppercase tracking-[0.2em] leading-tight drop-shadow-2xl transition-transform duration-500 group-hover:scale-105 origin-left">${f.name}</span>
             </div>
             
             <!-- Corner Icon indicator -->
             <div class="w-8 h-8 rounded-full border border-white/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-700 transform scale-50 group-hover:scale-100">
               <i data-lucide="maximize" size="14" class="text-white/50"></i>
             </div>
          </div>
          
          <!-- Selection indicator Glow (Invisible until hover) -->
          <div class="absolute inset-0 border-2 border-gold-500/0 group-hover:border-gold-500/20 rounded-3xl pointer-events-none transition-all duration-500 scale-[0.98] group-hover:scale-100"></div>
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

  // ─── CAMERA PERMISSION ──────────────────────────────────────────────────────
  async requestCameraPermission() {
    // Show permission modal
    App.showPermissionModal();

    try {
      // Actually request camera permission
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 1024 },
          height: { ideal: 768 },
          aspectRatio: { ideal: 4 / 3 }
        },
        audio: false
      });
      // Stop the test stream immediately — Camera.init() will open its own
      stream.getTracks().forEach(t => t.stop());
      // Permission granted!
      App.hidePermissionModal('granted');
      setTimeout(() => {
        App.goTo('camera-interface');
        Camera.init(App.settings.deviceId).then(() => App.loadCameras());
      }, 600);
    } catch (err) {
      // Permission denied or device not found
      App.hidePermissionModal('denied', err);
    }
  },

  showPermissionModal() {
    // Create modal if not exists
    if (document.getElementById('perm-modal')) return;
    const modal = document.createElement('div');
    modal.id = 'perm-modal';
    modal.style.cssText = `
      position: fixed; inset: 0; z-index: 99999;
      display: flex; align-items: center; justify-content: center;
      background: rgba(8,8,8,0.85); backdrop-filter: blur(20px);
      opacity: 0; transition: opacity 0.4s ease;
    `;
    modal.innerHTML = `
      <div id="perm-card" style="
        background: linear-gradient(145deg, #111111, #0d0d0d);
        border: 1px solid rgba(212,175,55,0.2);
        border-radius: 28px;
        padding: 2.5rem 2rem;
        max-width: 360px;
        width: 90%;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 1.25rem;
        text-align: center;
        box-shadow: 0 40px 80px rgba(0,0,0,0.8), 0 0 0 1px rgba(212,175,55,0.05);
        transform: translateY(24px) scale(0.96);
        transition: transform 0.5s cubic-bezier(0.22,1,0.36,1), opacity 0.4s ease;
        opacity: 0;
        font-family: 'Outfit', sans-serif;
      ">
        <!-- Animated camera icon -->
        <div id="perm-icon-ring" style="
          width: 80px; height: 80px;
          border-radius: 50%;
          background: rgba(212,175,55,0.08);
          border: 2px solid rgba(212,175,55,0.25);
          display: flex; align-items: center; justify-content: center;
          position: relative;
          animation: perm-pulse 2s ease-in-out infinite;
        ">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#D4AF37" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
            <circle cx="12" cy="13" r="4"/>
          </svg>
        </div>

        <!-- Texts -->
        <div style="display:flex;flex-direction:column;gap:0.5rem;">
          <h3 style="font-family:'Cormorant Garamond',Georgia,serif; font-style:italic; font-size:1.75rem; color:#D4AF37; line-height:1; margin:0;">Izin Kamera</h3>
          <p style="font-size:0.8rem; color:rgba(255,255,255,0.45); line-height:1.6; margin:0;">
            Diaww Kamera butuh akses ke kamera kamu untuk menampilkan video dan mengambil foto dengan filter eksklusif.
          </p>
        </div>

        <!-- Status indicator -->
        <div id="perm-status" style="
          display: flex; align-items: center; gap: 0.5rem;
          background: rgba(212,175,55,0.08);
          border: 1px solid rgba(212,175,55,0.15);
          border-radius: 100px;
          padding: 0.5rem 1rem;
          font-size: 0.65rem;
          font-weight: 700;
          letter-spacing: 0.15em;
          text-transform: uppercase;
          color: rgba(212,175,55,0.7);
        ">
          <span id="perm-dot" style="width:7px;height:7px;border-radius:50%;background:#D4AF37;animation:perm-blink 1s ease-in-out infinite;"></span>
          <span id="perm-status-text">Menunggu izin browser...</span>
        </div>

        <!-- Tip -->
        <p style="font-size:0.68rem; color:rgba(255,255,255,0.2); margin:0; line-height:1.5;">
          Klik <strong style="color:rgba(255,255,255,0.4);">"Izinkan"</strong> pada dialog browser di atas untuk melanjutkan.
        </p>
      </div>
    `;

    // Inject keyframes
    if (!document.getElementById('perm-styles')) {
      const style = document.createElement('style');
      style.id = 'perm-styles';
      style.textContent = `
        @keyframes perm-pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(212,175,55,0.3); }
          50% { box-shadow: 0 0 0 14px rgba(212,175,55,0); }
        }
        @keyframes perm-blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
        @keyframes perm-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `;
      document.head.appendChild(style);
    }

    document.body.appendChild(modal);
    // Animate in
    requestAnimationFrame(() => {
      modal.style.opacity = '1';
      const card = document.getElementById('perm-card');
      if (card) {
        card.style.transform = 'translateY(0) scale(1)';
        card.style.opacity = '1';
      }
    });
  },

  hidePermissionModal(result, err) {
    const modal = document.getElementById('perm-modal');
    const statusEl = document.getElementById('perm-status-text');
    const dotEl = document.getElementById('perm-dot');
    const iconRing = document.getElementById('perm-icon-ring');

    if (result === 'granted') {
      if (statusEl) statusEl.textContent = 'Izin diberikan! Memuat kamera...';
      if (dotEl) { dotEl.style.background = '#22c55e'; dotEl.style.animation = 'none'; }
      if (iconRing) { iconRing.style.borderColor = 'rgba(34,197,94,0.5)'; iconRing.style.background = 'rgba(34,197,94,0.08)'; }
      setTimeout(() => {
        if (modal) {
          modal.style.opacity = '0';
          const card = document.getElementById('perm-card');
          if (card) { card.style.transform = 'translateY(-16px) scale(0.96)'; card.style.opacity = '0'; }
          setTimeout(() => modal.remove(), 400);
        }
      }, 500);
    } else {
      // Denied
      if (statusEl) statusEl.textContent = 'Izin ditolak!';
      if (dotEl) { dotEl.style.background = '#ef4444'; dotEl.style.animation = 'none'; }
      if (iconRing) { iconRing.style.borderColor = 'rgba(239,68,68,0.5)'; iconRing.style.background = 'rgba(239,68,68,0.08)'; }
      // Show denied message + retry button
      const card = document.getElementById('perm-card');
      if (card) {
        const msg = document.createElement('div');
        msg.style.cssText = 'display:flex;flex-direction:column;gap:0.75rem;width:100%;';
        msg.innerHTML = `
          <p style="font-size:0.75rem;color:rgba(239,68,68,0.8);line-height:1.5;margin:0;">
            ${ err && err.name === 'NotFoundError'
              ? '⚠️ Kamera tidak ditemukan. Pastikan kamera terhubung dan coba lagi.'
              : '⚠️ Kamu menolak akses kamera. Izinkan kamera di pengaturan browser, lalu coba lagi.' }
          </p>
          <button id="perm-retry-btn" style="
            background: #D4AF37; color: #080808;
            border: none; border-radius: 50px;
            padding: 0.75rem 1.5rem;
            font-family: 'Outfit',sans-serif;
            font-size: 0.75rem; font-weight: 800;
            letter-spacing: 0.1em; text-transform: uppercase;
            cursor: pointer; transition: all 0.2s;
          ">Coba Lagi</button>
        `;
        card.appendChild(msg);
        document.getElementById('perm-retry-btn').onclick = () => {
          modal.remove();
          App.requestCameraPermission();
        };
      }
    }
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
      // Brightness "Hold" + Longer Fade
      gsap.fromTo(flash, 
        { opacity: 1 }, 
        { opacity: 0, duration: 0.8, delay: 0.15, ease: "power2.out" }
      );
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
    a.download = `DIAWW-Kamera-${Date.now()}.jpg`;
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
