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

const Camera = {
  // 1. Initialize Stream
  init: async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 720, facingMode: 'user' },
        audio: false
      });
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
      // Graceful error UI handling would go here
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
  }
};
