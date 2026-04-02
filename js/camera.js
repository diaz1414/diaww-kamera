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
      const constraints = {
        video: { 
          facingMode: facingMode,
          width: { ideal: 1024 },
          height: { ideal: 768 }
        },
        audio: false
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      video.srcObject = stream;
      video.onloadedmetadata = () => {
        video.play();
        // Force 4:3 Internal Canvas Resolution (Universal Standard)
        canvas.width = 1024;
        canvas.height = 768;
        isStreaming = true;
        Camera.render();
      };
    } catch (err) {
      console.error("Camera access error:", err);
      alert("Uh oh! Gagal akses kamera.");
    }
  },

  // 2. High-Performance Render Loop
  render: () => {
    if (!isStreaming) return;

    // a. Standard 4:3 Center-Crop
    const vW = video.videoWidth;
    const vH = video.videoHeight;
    const targetAspect = 1024 / 768;
    let sx=0, sy=0, sW=vW, sH=vH;

    if (vW / vH > targetAspect) {
      sW = vH * targetAspect;
      sx = (vW - sW) / 2;
    } else {
      sH = vW / targetAspect;
      sy = (vH - sH) / 2;
    }

    ctx.drawImage(video, sx, sy, sW, sH, 0, 0, canvas.width, canvas.height);
    
    // b. Get Raw Data for effects that need it
    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
    
    // c. Apply Current Filter
    if (currentFilter && currentFilter.method) {
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
