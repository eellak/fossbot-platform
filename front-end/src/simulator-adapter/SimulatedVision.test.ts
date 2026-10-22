import * as THREE from 'three';
import { detectSimulatedObjects } from '../simulator/robot/simulatedVision';
import { CameraVisionProcessor } from '../simulator/robot/cameraVision';
declare const describe: any, it: any, expect: any, jest: any;

describe('simulated object visibility', () => {
  it('rejects offscreen and occluded objects and follows camera rotation', () => {
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(65, 4 / 3, 0.01, 100);
    const object = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial());
    object.position.z = -3; object.userData.cameraVisionLabel = 'box'; scene.add(object);
    expect(detectSimulatedObjects(scene, camera).map(result => result.label)).toEqual(['box']);
    const wall = new THREE.Mesh(new THREE.BoxGeometry(3, 3, 0.2), new THREE.MeshBasicMaterial());
    wall.position.z = -2; scene.add(wall);
    expect(detectSimulatedObjects(scene, camera)).toEqual([]);
    wall.visible = false;
    expect(detectSimulatedObjects(scene, camera)).toHaveLength(1);
    camera.rotation.y = Math.PI;
    expect(detectSimulatedObjects(scene, camera)).toEqual([]);
  });
});

describe('camera vision worker lifecycle', () => {
  it('rejects old-mode results, drops busy frames and terminates when switched to video', () => {
    const worker = { onmessage: null as any, onerror: null as any, postMessage: jest.fn(), terminate: jest.fn() };
    const originalWorker = globalThis.Worker;
    globalThis.Worker = jest.fn(() => worker) as any;
    try {
      const processor = new CameraVisionProcessor('/simulator');
      processor.setMode('aruco'); worker.onmessage({ data: { type: 'ready' } });
      const image = { data: new Uint8ClampedArray(4), width: 1, height: 1 } as ImageData;
      processor.process(image, 0); processor.process(image, 200);
      expect(worker.postMessage).toHaveBeenCalledTimes(1);
      const generation = worker.postMessage.mock.calls[0][0].generation;
      processor.setMode('road');
      worker.onmessage({ data: { type: 'result', generation, mode: 'aruco', result: { markers: [{ id: 9 }], road: null } } });
      expect(processor.getSnapshot().markers).toEqual([]);
      processor.process(image, 300);
      expect(worker.postMessage).toHaveBeenCalledTimes(2);
      processor.setMode('normal'); expect(worker.terminate).toHaveBeenCalledTimes(1);
      processor.dispose();
    } finally { globalThis.Worker = originalWorker; }
  });
});

it('uses the physical FastDepth display scale and RGB palette', () => {
  const { createCameraDepthMaterial, CAMERA_DEPTH_COLORS } = require('../simulator/robot/simulatedVision');
  const material = createCameraDepthMaterial();
  expect(material.uniforms.nearDepth.value).toBe(0.5);
  expect(material.uniforms.farDepth.value).toBe(8);
  expect(CAMERA_DEPTH_COLORS).toEqual(['#fff550', '#ff5a1e', '#b42396', '#2382dc', '#141e5a']);
  expect(material.uniforms.depthColors.value[0].toArray()).toEqual([1, 245 / 255, 80 / 255]);
  expect(material.toneMapped).toBe(false);
  material.dispose();
});
