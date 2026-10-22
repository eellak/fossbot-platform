/** NumPy v1.0, C-order [height,width], little-endian float32 metres. */
export function depthToNpy(values: Float32Array, width: number, height: number): Blob {
  if (values.length !== width * height) throw new Error('Depth dimensions do not match pixel count');
  const dictionary = `{'descr': '<f4', 'fortran_order': False, 'shape': (${height}, ${width}), }`;
  const padding = (64 - ((10 + dictionary.length + 1) % 64)) % 64;
  const header = new TextEncoder().encode(dictionary + ' '.repeat(padding) + '\n');
  const bytes = new Uint8Array(10 + header.length + values.length * 4), view = new DataView(bytes.buffer);
  bytes.set([0x93, 0x4e, 0x55, 0x4d, 0x50, 0x59, 1, 0]); view.setUint16(8, header.length, true); bytes.set(header, 10);
  for (let i = 0; i < values.length; i++) view.setFloat32(10 + header.length + i * 4, values[i], true);
  return new Blob([bytes], { type: 'application/x-npy' });
}
