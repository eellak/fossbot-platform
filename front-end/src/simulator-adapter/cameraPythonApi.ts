import type { CameraVisionSnapshot } from '../simulator/robot/cameraVision';

/** Match the physical YOLO packet; confidence is synthetic for geometry labels. */
export function cameraDetectionsForPython(snapshot: CameraVisionSnapshot | null, maxAge = 1, now = Date.now()) {
  if (!snapshot || snapshot.mode !== 'objects' || !snapshot.timestamp ||
      now < snapshot.timestamp || now - snapshot.timestamp > Math.max(0.05, maxAge) * 1000) return [];
  const frame_width = 320, frame_height = 240;
  return (snapshot.objects || []).map(({ label, box, distance }) => {
    const center_x = box.x + box.width / 2, center_y = box.y + box.height / 2;
    return { label, confidence: 1, x: box.x, y: box.y, width: box.width, height: box.height,
      center_x, center_y, center_x_ratio: center_x / frame_width, center_y_ratio: center_y / frame_height,
      frame_width, frame_height, distance_m: distance, source: 'simulator' };
  });
}

/** Preserve the physical getters' empty values and freshness requirements. */
export function cameraVisionForPython(snapshot: CameraVisionSnapshot | null, mode: string, maxAge: number, now = Date.now()) {
  const empty = mode === 'aruco' ? [] : null;
  if (!snapshot || snapshot.mode !== mode || !snapshot.timestamp || now < snapshot.timestamp ||
      now - snapshot.timestamp > Math.max(mode === 'depth' ? 0.1 : 0.05, maxAge) * 1000) return empty;
  if (mode === 'aruco') return snapshot.markers;
  if (mode === 'road') return snapshot.road;
  if (mode === 'depth') return snapshot.depth ?? null;
  return null;
}
