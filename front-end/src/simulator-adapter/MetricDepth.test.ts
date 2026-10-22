import * as THREE from 'three';
import { createMetricDepthMaterial, renderMetricDepth } from '../simulator/robot/depthCapture';
declare const it: any, expect: any, jest: any;
it('exports float depth without the heatmap range clamp, flips rows and restores renderer state', () => {
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(65, 4 / 3, 0.01, 100);
  const robot = new THREE.Object3D(); scene.add(robot);
  const material = createMetricDepthMaterial(), target = new THREE.WebGLRenderTarget(2, 2);
  const oldTarget = new THREE.WebGLRenderTarget(1, 1), background = new THREE.Color('red'); scene.background = background;
  const renderer = { extensions: { has: () => true }, shadowMap: { autoUpdate: true },
    getRenderTarget: () => oldTarget, getViewport: (v: THREE.Vector4) => v.set(1, 2, 3, 4),
    getScissor: (v: THREE.Vector4) => v.set(5, 6, 7, 8), getScissorTest: () => true,
    getClearColor: (c: THREE.Color) => c.set('blue'), getClearAlpha: () => 1,
    setRenderTarget: jest.fn(), setScissorTest: jest.fn(), setClearColor: jest.fn(),
    setViewport: jest.fn(), setScissor: jest.fn(), clear: jest.fn(), render: jest.fn(),
    readRenderTargetPixels: (_t: any, _x: any, _y: any, _w: any, _h: any, pixels: Float32Array) => {
      [12.5, 0, 1.25, 3.5].forEach((value, i) => { pixels[i * 4] = value; });
    },
  };
  const frame = renderMetricDepth(renderer as any, scene, camera, robot, target, material);
  expect(Array.from(frame.values).slice(0, 3)).toEqual([1.25, 3.5, 12.5]);
  expect(Number.isNaN(frame.values[3])).toBe(true);
  expect(scene.background).toBe(background); expect(scene.overrideMaterial).toBeNull(); expect(robot.visible).toBe(true);
  expect(renderer.setRenderTarget).toHaveBeenLastCalledWith(oldTarget);
  renderer.render.mockImplementation(() => { throw new Error('GPU failure'); });
  expect(() => renderMetricDepth(renderer as any, scene, camera, robot, target, material)).toThrow('GPU failure');
  expect(scene.background).toBe(background); expect(robot.visible).toBe(true); expect(renderer.shadowMap.autoUpdate).toBe(true);
  target.dispose(); oldTarget.dispose(); material.dispose();
});
