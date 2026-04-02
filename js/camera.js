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
const bufferCanvas = document.createElement('canvas');
const bufferCtx = bufferCanvas.getContext('2d', { willReadFrequently: true });

const Camera = {
  // 1. Initialize Stream
  init: async (deviceId = null) => {
    try {
      const isSquare = App.settings.square;
      const constraints = {
        video: { 
          facingMode: facingMode,
          deviceId: deviceId ? { exact: deviceId } : undefined,
          width: { ideal: isSquare ? 1024 : 1024 },
          height: { ideal: isSquare ? 1024 : 768 }
        },
        audio: false
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      video.srcObject = stream;
      return new Promise((resolve) => {
        video.onloadedmetadata = () => {
          video.play();
          const resW = 1024, resH = isSquare ? 1024 : 768;
          canvas.width = resW; canvas.height = resH;
          bufferCanvas.width = resW; bufferCanvas.height = resH;
          window.video = bufferCanvas;
          document.getElementById('camera-viewport').style.aspectRatio = isSquare ? '1/1' : '4/3';
          isStreaming = true;
          Camera.render();
          
          // Get the actual device ID being used (important for 'default' vs specific)
          const actualId = stream.getVideoTracks()[0].getSettings().deviceId;
          resolve(actualId);
        };
      });
    } catch (err) {
      console.error("Camera access error:", err);
      alert("Gagal akses kamera. Coba izinkan atau ganti sumber kamera.");
      return null;
    }
  },

  // 2. High-Performance Render Loop
  render: () => {
    if (!isStreaming) return;

    // 1. Smart Center-Crop from raw stream to buffer
    const vW = video.videoWidth, vH = video.videoHeight;
    if (vW && vH) {
      const targetAspect = bufferCanvas.width / bufferCanvas.height;
      let sx=0, sy=0, sW=vW, sH=vH;
      if (vW / vH > targetAspect) {
        sW = vH * targetAspect; sx = (vW - sW) / 2;
      } else {
        sH = vW / targetAspect; sy = (vH - sH) / 2;
      }
      bufferCtx.drawImage(video, sx, sy, sW, sH, 0, 0, bufferCanvas.width, bufferCanvas.height);
    }

    // 2. Prepare Display
    ctx.save();
    ctx.clearRect(0,0, canvas.width, canvas.height);
    
    if (App.settings.mirror) {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }

    // 3. Draw Buffer to Screen
    ctx.drawImage(bufferCanvas, 0, 0);
    
    // 4. Apply Current Filter
    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
    if (currentFilter && currentFilter.method && currentFilter.id !== 'original') {
      currentFilter.method(pixels, ctx, canvas.width, canvas.height);
    }

    ctx.restore();
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
