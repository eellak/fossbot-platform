import type { SimulatedObjectDetection } from './simulatedVision'
export type CameraVisionMode = 'normal' | 'aruco' | 'road' | 'objects' | 'depth'
export interface ArucoMarker {
  id: number; corners: { x: number; y: number }[]
  center_x: number; center_y: number; center_x_ratio: number; center_y_ratio: number
  orientation_degrees: number; frame_width: number; frame_height: number
}
export interface RoadBoundary { x: number; x_ratio: number; top_x: number; bottom_x: number }
export interface RoadDetection {
  detected: true; left: RoadBoundary; right: RoadBoundary; center_x: number
  center_x_ratio: number; center_error: number; lane_width: number; lane_width_ratio: number
  lookahead_y: number; lookahead_y_ratio: number; confidence: number; frame_width: number; frame_height: number
}
export interface SimulatedDepthPacket {
  timestamp: number; model: string; source: 'simulator'; frame_width: number; frame_height: number
  center_m: number | null; regions: { left_m: number | null; center_m: number | null; right_m: number | null }
}
export interface CameraVisionSnapshot {
  mode: CameraVisionMode; status: 'video' | 'loading' | 'ready' | 'error'
  depth?: SimulatedDepthPacket; timestamp?: number; objects?: SimulatedObjectDetection[]; markers: ArucoMarker[]; road: RoadDetection | null; error?: string
}
export class CameraVisionProcessor {
  private worker: Worker | null = null
  private ready = false
  private busy = false
  private generation = 0
  private lastResult = -Infinity
  private lastFrame = -Infinity
  private mode: CameraVisionMode = 'normal'
  private threshold = 105
  private snapshot: CameraVisionSnapshot = { mode: 'normal', status: 'video', markers: [], road: null }
  constructor(private baseUrl: string, private onUpdate?: (snapshot: CameraVisionSnapshot) => void) {}
  getSnapshot(): CameraVisionSnapshot {
    if (performance.now() - this.lastResult > 500) return { ...this.snapshot, markers: [], road: null, objects: [], depth: undefined }
    return this.snapshot
  }
  setMode(mode: CameraVisionMode, threshold = 105): void {
    threshold = Math.max(20, Math.min(200, Math.round(threshold)))
    if (mode === this.mode && threshold === this.threshold) return
    this.generation++
    this.mode = mode
    this.threshold = Math.max(20, Math.min(200, Math.round(threshold)))
    this.publish({ mode, status: ['normal', 'objects', 'depth'].includes(mode) ? 'video' : this.ready ? 'ready' : 'loading', markers: [], road: null })
    if (['normal', 'objects', 'depth'].includes(mode)) { this.worker?.terminate(); this.worker = null; this.ready = false; this.busy = false; return }
    if (this.worker) return
    try {
      this.worker = new Worker(`${this.baseUrl.replace(/\/$/, '')}/vision/worker.js`)
      this.worker.onmessage = ({ data }) => {
        if (data.type === 'ready') { this.ready = true; this.publish({ ...this.snapshot, status: ['normal', 'objects', 'depth'].includes(this.mode) ? 'video' : 'ready' }); return }
        this.busy = false
        if (data.type === 'error') { this.fail(data.message); return }
        if (data.generation !== this.generation || data.mode !== this.mode) return
        this.lastResult = performance.now()
        this.publish({ mode: this.mode, status: 'ready', ...data.result, timestamp: Date.now() })
      }
      this.worker.onerror = () => this.fail('Camera processing could not start. Reload to retry.')
    } catch (error) { this.fail(String(error)) }
  }
  process(image: ImageData, now: number): void {
    if (!['aruco', 'road'].includes(this.mode) || !this.ready || this.busy || now - this.lastFrame < 100) return
    this.busy = true
    this.lastFrame = now
    const pixels = image.data.slice().buffer
    this.worker!.postMessage({ pixels, width: image.width, height: image.height, mode: this.mode, blackThreshold: this.threshold, generation: this.generation }, [pixels])
  }
  draw(context: CanvasRenderingContext2D): void {
    const snapshot = this.getSnapshot()
    if (!snapshot.markers.length && !snapshot.road && !snapshot.objects?.length) return
    context.save()
    context.lineWidth = 2
    context.font = '12px sans-serif'
    const label = (text: string, x: number, y: number) => {
      context.strokeStyle = '#000000'; context.lineWidth = 3
      context.strokeText(text, x, y)
      context.fillStyle = '#ffff00'; context.fillText(text, x, y)
      context.lineWidth = 2
    }
    for (const object of snapshot.objects ?? []) {
      const { x, y, width, height } = object.box
      context.strokeStyle = '#00ff80'; context.strokeRect(x, y, width, height)
      label(`${object.label} ${object.distance.toFixed(2)} m`, Math.max(2, x), Math.max(14, y - 3))
    }
    for (const marker of snapshot.markers) {
      context.strokeStyle = '#00ff80'
      context.beginPath()
      marker.corners.forEach((p, i) => i ? context.lineTo(p.x, p.y) : context.moveTo(p.x, p.y))
      context.closePath(); context.stroke()
      label(`ID ${marker.id} ${marker.orientation_degrees.toFixed(1)}°`, Math.max(2, marker.center_x - 40), Math.max(14, marker.center_y - 12))
    }
    if (snapshot.road) {
      const road = snapshot.road
      for (const [boundary, color] of [[road.left, '#00ff80'], [road.right, '#ffff00']] as const) {
        context.strokeStyle = color; context.beginPath()
        context.moveTo(boundary.top_x, Math.round(road.frame_height * 0.42))
        context.lineTo(boundary.bottom_x, road.frame_height - 1); context.stroke()
      }
      context.strokeStyle = '#00ffff'; context.beginPath()
      context.moveTo(road.frame_width / 2, road.frame_height - 1)
      context.lineTo(road.center_x, road.lookahead_y); context.stroke()
    }
    context.restore()
  }
  setSimulatedObjects(objects: SimulatedObjectDetection[]): void {
    this.lastResult = performance.now()
    this.publish({ mode: 'objects', status: 'ready', timestamp: Date.now(), markers: [], road: null, objects })
  }
  setSimulatedDepth(depth: SimulatedDepthPacket): void {
    this.lastResult = performance.now()
    this.publish({ mode: 'depth', status: 'ready', timestamp: Date.now(), markers: [], road: null, depth })
  }
  private publish(snapshot: CameraVisionSnapshot): void { this.snapshot = snapshot; this.onUpdate?.(snapshot) }
  private fail(error: string): void {
    this.worker?.terminate(); this.worker = null; this.ready = false; this.busy = false
    this.publish({ mode: this.mode, status: 'error', markers: [], road: null, error })
  }
  dispose(): void { this.worker?.terminate(); this.worker = null }
}
