import React from 'react';
import { act } from 'react-dom/test-utils';
import { createRoot } from 'react-dom/client';
import { useCameraDataCollection } from './useCameraDataCollection';
import { registerCameraCapture } from '../camera/cameraCapture';
declare const it: any, expect: any;
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
it('collects a frame and ignores an in-flight frame after capture stops', async () => {
  let camera!: ReturnType<typeof useCameraDataCollection>;
  function Harness() { camera = useCameraDataCollection('test'); return null; }
  const container = document.createElement('div'), root = createRoot(container);
  const image = new Blob(['image'], { type: 'image/png' });
  let resolve!: (value: any) => void;
  let cleanup = registerCameraCapture('test', async () => ({ image, timestamp: 1, mode: 'normal' }));
  try {
    await act(async () => { root.render(<Harness />); });
    await act(async () => { camera.setEnabled(true); });
    await act(async () => { camera.start(); });
    expect(camera.count).toBe(1); expect(camera.active).toBe(true);
    await act(async () => { camera.stop(); });
    cleanup(); cleanup = registerCameraCapture('test', () => new Promise(done => { resolve = done; }));
    await act(async () => { camera.start(); });
    await act(async () => { camera.stop(); resolve({ image, timestamp: 2, mode: 'normal' }); });
    expect(camera.count).toBe(0); expect(camera.active).toBe(false);
  } finally { cleanup(); await act(async () => { root.unmount(); }); }
});
