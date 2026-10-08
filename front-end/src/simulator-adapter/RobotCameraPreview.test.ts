import * as THREE from 'three';
import { RobotCameraPreview, updateRobotCameraPose } from '../simulator/robot/cameraPreview';

declare const describe: any;
declare const it: any;
declare const expect: any;
declare const jest: any;

describe('robot camera preview', () => {
  it('follows a moving CAD mount without inheriting its millimetre scale', () => {
    const robot = new THREE.Group();
    const cad = new THREE.Group();
    cad.scale.setScalar(0.001);
    robot.add(cad);
    const mount = new THREE.Object3D();
    mount.position.set(0, 120, -65);
    cad.add(mount);
    const camera = new THREE.PerspectiveCamera(65, 4 / 3, 0.01, 100);
    updateRobotCameraPose(camera, mount);
    expect(camera.position.y).toBeCloseTo(0.12);
    expect(camera.scale.toArray()).toEqual([1, 1, 1]);
    robot.position.set(2, 0, 3);
    robot.rotation.y = Math.PI / 2;
    updateRobotCameraPose(camera, mount);
    expect(camera.position.x).toBeCloseTo(1.935);
    expect(camera.position.z).toBeCloseTo(3);
    expect(camera.getWorldDirection(new THREE.Vector3()).x).toBeCloseTo(-1);
    expect(camera.far).toBe(100);
  });

  it('flips pixel rows, throttles frames, and restores the main renderer even on failure', () => {
    const context = {
      createImageData: () => ({ data: new Uint8ClampedArray(320 * 240 * 4) }),
      putImageData: jest.fn(), clearRect: jest.fn(),
    };
    const canvas = { getContext: () => context } as unknown as HTMLCanvasElement;
    const preview = new RobotCameraPreview(canvas);
    const originalTarget = new THREE.WebGLRenderTarget(4, 4);
    const viewport = new THREE.Vector4(1, 2, 3, 4);
    const scissor = new THREE.Vector4(5, 6, 7, 8);
    const renderer = {
      shadowMap: { autoUpdate: true },
      getRenderTarget: () => originalTarget,
      getViewport: (out: THREE.Vector4) => out.copy(viewport),
      getScissor: (out: THREE.Vector4) => out.copy(scissor),
      getScissorTest: () => true,
      setRenderTarget: jest.fn(), setViewport: jest.fn(),
      setScissor: jest.fn(), setScissorTest: jest.fn(), clear: jest.fn(),
      render: jest.fn(),
      readRenderTargetPixels: (_target: unknown, _x: number, _y: number, _w: number, _h: number, pixels: Uint8Array) => {
        pixels.fill(10, 0, 320 * 4);
        pixels.fill(20, 239 * 320 * 4);
      },
    };
    const robot = new THREE.Group();
    const scene = new THREE.Scene();
    const mount = new THREE.Object3D();
    const camera = new THREE.PerspectiveCamera();
    const render = (time: number) => preview.render(renderer as unknown as THREE.WebGLRenderer, scene, camera, mount, robot, time);
    render(0);
    const image = context.putImageData.mock.calls[0][0];
    expect(image.data[0]).toBe(20);
    expect(image.data[239 * 320 * 4]).toBe(10);
    render(10);
    expect(renderer.render).toHaveBeenCalledTimes(1);
    renderer.render.mockImplementationOnce(() => { throw new Error('render failed'); });
    expect(() => render(100)).toThrow('render failed');
    expect(robot.visible).toBe(true);
    expect(renderer.shadowMap.autoUpdate).toBe(true);
    expect(renderer.setRenderTarget).toHaveBeenLastCalledWith(originalTarget);
    expect(renderer.setViewport).toHaveBeenLastCalledWith(viewport);
    expect(renderer.setScissor).toHaveBeenLastCalledWith(scissor);
    expect(renderer.setScissorTest).toHaveBeenLastCalledWith(true);
    preview.dispose();
    expect(context.clearRect).toHaveBeenCalled();
    originalTarget.dispose();
  });
});
