/**
 * Camera & Canvas Management Engine
 * Handles stream lifecycle and high-FPS rendering loop.
 */

let streamVideo = document.createElement('video');
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
      streamVideo.srcObject = stream;
      return new Promise((resolve) => {
        streamVideo.onloadedmetadata = () => {
          streamVideo.play();
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
    const vW = streamVideo.videoWidth, vH = streamVideo.videoHeight;
    if (vW && vH) {
      const targetAspect = bufferCanvas.width / bufferCanvas.height;
      let sx=0, sy=0, sW=vW, sH=vH;
      if (vW / vH > targetAspect) {
        sW = vH * targetAspect; sx = (vW - sW) / 2;
      } else {
        sH = vW / targetAspect; sy = (vH - sH) / 2;
      }
      bufferCtx.drawImage(streamVideo, sx, sy, sW, sH, 0, 0, bufferCanvas.width, bufferCanvas.height);
    }

    // 2. Prepare Display
    ctx.save();
    ctx.clearRect(0,0, canvas.width, canvas.height);
    
    if (App.settings.mirror) {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }

    // 3. Apply Current Filter
    if (currentFilter && currentFilter.method) {
      // PRO TIP: Most filters handle their own drawing to use ctx.filter or grids.
      // We only capture pixels if it's a pixel-level distortion.
      const isPixelDistortion = currentFilter.cat === 'distort' && !currentFilter.id.includes('pixel') && !currentFilter.id.includes('underwater');
      let pixels = null;
      
      if (isPixelDistortion) {
          ctx.drawImage(bufferCanvas, 0, 0);
          pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
      }
      
      currentFilter.method(pixels, ctx, canvas.width, canvas.height);
    } else {
      ctx.drawImage(bufferCanvas, 0, 0);
    }

    ctx.restore();
    animationFrameId = requestAnimationFrame(Camera.render);
  },

  // 3. Stop Stream
  stop: () => {
    isStreaming = false;
    cancelAnimationFrame(animationFrameId);
    if (streamVideo.srcObject) {
      streamVideo.srcObject.getTracks().forEach(track => track.stop());
    }
  },

  // 4. Change Effect
  setEffect: (filterId) => {
    const filter = FILTER_CONFIG.find(f => f.id === filterId);
    if (filter) {
      currentFilter = filter;
      // Clear buffer & state for motion/particle effects when switching
      Effects.buffer = []; 
      Effects.state = {};
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
