export type CameraCapture = { image: Blob; timestamp: number; mode: string; metadata?: unknown };
type Provider = () => Promise<CameraCapture | null>;
const providers = new Map<string, Provider>();
export function registerCameraCapture(target: string, provider: Provider) {
  providers.set(target, provider);
  return () => { if (providers.get(target) === provider) providers.delete(target); };
}
export async function captureCamera(target: string) { return providers.get(target)?.() ?? null; }

/** ZIP STORE archive: binary-safe, interoperable, and requires no compression dependency. */
export function cameraZip(files: { name: string; bytes: Uint8Array }[]): Blob {
  const encoder = new TextEncoder();
  const chunks: Uint8Array[] = [], directory: Uint8Array[] = [];
  let offset = 0, directorySize = 0;
  for (const file of files) {
    const name = encoder.encode(file.name);
    let crc = 0xffffffff;
    for (const byte of file.bytes) {
      crc ^= byte;
      for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
    }
    crc = (crc ^ 0xffffffff) >>> 0;
    const header = new Uint8Array(30 + name.length), view = new DataView(header.buffer);
    view.setUint32(0, 0x04034b50, true); view.setUint16(4, 20, true); view.setUint16(6, 0x800, true);
    view.setUint32(14, crc, true); view.setUint32(18, file.bytes.length, true); view.setUint32(22, file.bytes.length, true);
    view.setUint16(26, name.length, true); header.set(name, 30);
    const central = new Uint8Array(46 + name.length), cv = new DataView(central.buffer);
    cv.setUint32(0, 0x02014b50, true); cv.setUint16(4, 20, true); cv.setUint16(6, 20, true); cv.setUint16(8, 0x800, true);
    cv.setUint32(16, crc, true); cv.setUint32(20, file.bytes.length, true); cv.setUint32(24, file.bytes.length, true);
    cv.setUint16(28, name.length, true); cv.setUint32(42, offset, true); central.set(name, 46);
    chunks.push(header, file.bytes); directory.push(central);
    offset += header.length + file.bytes.length; directorySize += central.length;
  }
  const end = new Uint8Array(22), view = new DataView(end.buffer);
  view.setUint32(0, 0x06054b50, true); view.setUint16(8, files.length, true); view.setUint16(10, files.length, true);
  view.setUint32(12, directorySize, true); view.setUint32(16, offset, true);
  return new Blob([...chunks, ...directory, end], { type: 'application/zip' });
}
