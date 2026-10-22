import { cameraDetectionsForPython, cameraVisionForPython } from './cameraPythonApi';
import type { CameraVisionSnapshot } from '../simulator/robot/cameraVision';
declare const it: any, expect: any;
it('maps visible simulated labels to the physical detection packet and expires old results', () => {
  const snapshot: CameraVisionSnapshot = { mode: 'objects', status: 'ready', timestamp: 1000,
    markers: [], road: null, objects: [{ label: 'person', source: 'simulator', distance: 2,
      box: { x: 80, y: 20, width: 80, height: 120 } }] };
  const detections = cameraDetectionsForPython(snapshot, 0.8, 1100);
  expect(detections).toEqual([{ label: 'person', confidence: 1, source: 'simulator', distance_m: 2,
    x: 80, y: 20, width: 80, height: 120, center_x: 120, center_y: 80,
    center_x_ratio: 0.375, center_y_ratio: 1 / 3, frame_width: 320, frame_height: 240 }]);
  expect(cameraDetectionsForPython(snapshot, 0.05, 1100)).toEqual([]);
  expect(cameraDetectionsForPython(snapshot, 0.8, 1900)).toEqual([]);
  expect(cameraDetectionsForPython(snapshot, 1, 900)).toEqual([]);
  expect(cameraDetectionsForPython({ ...snapshot, mode: 'normal' }, 1, 1100)).toEqual([]);
  expect(cameraDetectionsForPython(null)).toEqual([]);
});

it('returns fresh road, marker and depth packets only for the active mode', () => {
  const marker = { id: 7 } as any;
  const road = { detected: true, center_error: 0.1 } as any;
  const depth = { center_m: 2, regions: { left_m: 1, center_m: 2, right_m: 3 } } as any;
  const snapshot = { mode: 'road', status: 'ready', timestamp: 1000, markers: [marker], road, depth } as CameraVisionSnapshot;
  expect(cameraVisionForPython(snapshot, 'road', 0.5, 1200)).toBe(road);
  expect(cameraVisionForPython(snapshot, 'road', 0.5, 1600)).toBeNull();
  expect(cameraVisionForPython(snapshot, 'depth', 1.5, 1200)).toBeNull();
  expect(cameraVisionForPython({ ...snapshot, mode: 'depth' }, 'depth', 1.5, 1200)).toBe(depth);
  expect(cameraVisionForPython({ ...snapshot, mode: 'aruco' }, 'aruco', 0.5, 1200)).toEqual([marker]);
  expect(cameraVisionForPython(null, 'aruco', 0.5)).toEqual([]);
});
