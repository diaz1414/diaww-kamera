/**
 * Camera & Canvas Management Engine
 * Handles stream lifecycle and high-FPS rendering loop.
 */

let video = document.createElement('video');
let canvas = document.getElementById('camera-canvas');
let ctx = canvas.getContext('2d', { willReadFrequently: true });
let currentFilter = FILTER_CONFIG[0]; // Default: Original
let isStreaming = false;
let animationFrameId = null;

let facingMode = 'user';

const Camera = {
  // 1. Initialize Stream
  init: async () => {
    try {
      const isMobile = window.innerWidth < 768;
      const constraints = {
        video: { 
          facingMode: facingMode,
          width: isMobile ? { ideal: 720 } : { ideal: 1280 },
          height: isMobile ? { ideal: 1280 } : { ideal: 720 }
        },
        audio: false
      };

      // Set CSS variable based on chosen layout
      document.documentElement.style.setProperty('--camera-aspect', isMobile ? '9/16' : '16/9');

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      video.srcObject = stream;
      video.onloadedmetadata = () => {
        video.play();
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        isStreaming = true;
        Camera.render();
      };
    } catch (err) {
      console.error("Camera access error:", err);
      alert("Uh oh! Gagal akses kamera. Pastikan izin sudah diberikan.");
    }
  },

  // 2. High-Performance Render Loop
  render: () => {
    if (!isStreaming) return;

    // a. Draw raw video to canvas first (for pixel manipulation)
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    // b. Get Raw Data for effects that need it
    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
    
    // c. Apply Current Filter
    if (currentFilter && currentFilter.method) {
      // Clean canvas before effect if it's a composite one
      if (currentFilter.id === 'quad' || currentFilter.id === 'split') {
        ctx.clearRect(0,0, canvas.width, canvas.height);
      }
      currentFilter.method(pixels, ctx, canvas.width, canvas.height);
    }

    animationFrameId = requestAnimationFrame(Camera.render);
  },

  // 3. Stop Stream
  stop: () => {
    isStreaming = false;
    cancelAnimationFrame(animationFrameId);
    if (video.srcObject) {
      video.srcObject.getTracks().forEach(track => track.stop());
    }
  },

  // 4. Change Effect
  setEffect: (filterId) => {
    const filter = FILTER_CONFIG.find(f => f.id === filterId);
    if (filter) {
      currentFilter = filter;
      // Clear buffer for motion effects when switching
      Effects.buffer = []; 
    }
  },

  // 5. Capture Static Image
  capture: () => {
    // Returns a base64 DataURL of the current canvas state
    return canvas.toDataURL('image/jpeg', 0.95);
  },

  // 6. Flip Camera
  flip: () => {
    facingMode = (facingMode === 'user') ? 'environment' : 'user';
    Camera.stop();
    Camera.init();
  }
};
