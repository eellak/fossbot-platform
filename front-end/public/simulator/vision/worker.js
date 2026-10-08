/* Lazy, self-hosted OpenCV WASM; all image processing stays off the UI thread. */
importScripts('detection.js', 'opencv-4.13.0.js');
let ready = false;
function initialized() {
  ready = true;
  postMessage({ type: 'ready' });
}
if (cv.Mat) initialized();
else cv.onRuntimeInitialized = initialized;
onmessage = ({ data }) => {
  if (!ready) return;
  try {
    const result = FossbotCameraDetection.detect(cv, new Uint8ClampedArray(data.pixels), data.width, data.height, data.mode, data.blackThreshold);
    postMessage({ type: 'result', mode: data.mode, generation: data.generation, result });
  } catch (error) {
    postMessage({ type: 'error', message: String(error) });
  }
};
