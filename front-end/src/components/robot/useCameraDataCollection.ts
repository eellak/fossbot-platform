import { useCallback, useEffect, useRef, useState } from 'react';
import { cameraZip, captureCamera, type CameraCapture } from '../camera/cameraCapture';

const MAX_BYTES = 100 * 1024 * 1024;
export function useCameraDataCollection(target: string) {
  const [enabled, setEnabled] = useState(false);
  const [intervalMs, setIntervalMs] = useState(1000);
  const [active, setActive] = useState(false);
  const [count, setCount] = useState(0);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);
  const frames = useRef<CameraCapture[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const generation = useRef(0);
  const runTarget = useRef(target);
  const stop = useCallback(() => {
    generation.current++;
    clearTimeout(timer.current);
    setActive(false);
  }, []);
  const start = useCallback(() => {
    if (!enabled) return;
    stop();
    const token = generation.current;
    frames.current = []; runTarget.current = target; setCount(0); setError(''); setActive(true);
    let bytes = 0, lastTimestamp = -1;
    const sample = async () => {
      try {
        const frame = await captureCamera(target);
        if (token !== generation.current) return;
        if (frame?.mode === 'depth' && frame.image.type !== 'application/x-npy') {
          setError('rawDepthUnavailable');
        } else if (frame && frame.timestamp !== lastTimestamp) {
          if (bytes + frame.image.size > MAX_BYTES || frames.current.length >= 1000) {
            setError('limit'); stop(); return;
          }
          frames.current.push(frame); bytes += frame.image.size; lastTimestamp = frame.timestamp;
          setCount(frames.current.length); setError('');
        } else if (!frame) setError('noFrame');
      } catch {
        if (token !== generation.current) return;
        setError('captureError');
      }
      if (token === generation.current) timer.current = setTimeout(sample, intervalMs);
    };
    void sample();
  }, [enabled, intervalMs, stop, target]);
  useEffect(() => { stop(); }, [target, stop]);
  useEffect(() => () => { generation.current++; clearTimeout(timer.current); }, []);
  const exportZip = useCallback(async () => {
    if (!frames.current.length || active || exporting) return;
    setExporting(true);
    try {
      const saved = frames.current.slice();
      const files = await Promise.all(saved.map(async (frame, i) => ({
        name: `${frame.mode === 'depth' ? 'depth' : 'images'}/${String(i).padStart(6, '0')}-${frame.mode}.${frame.mode === 'depth' ? 'npy' : frame.image.type === 'image/jpeg' ? 'jpg' : 'png'}`,
        bytes: new Uint8Array(await frame.image.arrayBuffer()),
      })));
      const manifest = { version: 2, target: runTarget.current, frameCount: saved.length,
        notes: 'Depth files are numeric float32 NPY arrays in metres, C-order [height,width], with NaN for invalid pixels. Simulator depth is camera-forward Z from geometry; physical depth is the model output. Preview images from other modes may contain overlays.',
        frames: saved.map(({ image, ...frame }, i) => ({ ...frame, file: files[i].name })) };
      files.push({ name: 'manifest.json', bytes: new TextEncoder().encode(JSON.stringify(manifest, null, 2)) });
      const url = URL.createObjectURL(cameraZip(files));
      const link = document.createElement('a'); link.href = url;
      link.download = `fossbot-${runTarget.current}-camera-${Date.now()}.zip`;
      document.body.appendChild(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch { setError('exportError'); }
    finally { setExporting(false); }
  }, [active, exporting]);
  return { enabled, setEnabled, intervalMs, setIntervalMs, active, count, error, exporting, start, stop, exportZip };
}
