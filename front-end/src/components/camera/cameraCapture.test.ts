import { cameraZip, registerCameraCapture, captureCamera } from './cameraCapture';
declare const it: any, expect: any, require: any;
const { spawnSync } = require('child_process');
(globalThis as any).TextEncoder = require('util').TextEncoder;
it('creates a ZIP readable by Python with intact binary images, JSON and CRCs', async () => {
  const blob = cameraZip([{ name: 'images/000000-depth.png', bytes: new Uint8Array([0, 255, 1, 128]) },
    { name: 'manifest.json', bytes: new Uint8Array([123, 125]) }]);
  const bytes = await new Promise<ArrayBuffer>((resolve, reject) => {
    const reader = new FileReader(); reader.onload = () => resolve(reader.result as ArrayBuffer); reader.onerror = reject; reader.readAsArrayBuffer(blob);
  });
  const result = spawnSync('python3', ['-c', `import sys,io,zipfile,json
z=zipfile.ZipFile(io.BytesIO(sys.stdin.buffer.read()))
assert z.testzip() is None
assert z.read('images/000000-depth.png') == bytes([0,255,1,128])
assert json.loads(z.read('manifest.json')) == {}
`], { input: Buffer.from(bytes), encoding: 'utf8' });
  expect(result.stderr).toBe(''); expect(result.status).toBe(0);
});
it('does not unregister a newer source when the previous camera unmounts', async () => {
  const removeOld = registerCameraCapture('test', async () => null);
  const frame = { image: new Blob(), timestamp: 100, mode: 'depth' };
  const removeNew = registerCameraCapture('test', async () => frame);
  removeOld(); expect(await captureCamera('test')).toBe(frame);
  removeNew(); expect(await captureCamera('test')).toBeNull();
});

it('writes float32 NPY data that NumPy loads without losing values, NaNs or shape', async () => {
  const { depthToNpy } = require('./depthNpy');
  const blob = depthToNpy(new Float32Array([0.123456, 12.75, NaN, 4.5, 0.001, 90]), 3, 2);
  const buffer = await new Promise<ArrayBuffer>((resolve) => {
    const reader = new FileReader(); reader.onload = () => resolve(reader.result as ArrayBuffer); reader.readAsArrayBuffer(blob);
  });
  const result = spawnSync('python3', ['-c', `import io,sys,numpy as np
a=np.load(io.BytesIO(sys.stdin.buffer.read()), allow_pickle=False)
assert a.shape == (2,3) and a.dtype == np.dtype('<f4')
assert np.isnan(a[0,2])
np.testing.assert_array_equal(a, np.array([[0.123456,12.75,np.nan],[4.5,0.001,90]],dtype='<f4'))
`], { input: Buffer.from(buffer), encoding: 'utf8' });
  expect(result.stderr).toBe(''); expect(result.status).toBe(0);
});
