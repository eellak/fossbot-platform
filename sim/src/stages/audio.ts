import * as THREE from 'three'
import { registerSource, unregisterSource } from '../sensors/mic/SoundSourceRegistry'

export interface StageAudioEntry {
  type: 'audio'
  position?: [number, number, number]
  sourceType?: 'url' | 'file'
  source?: string
  volume?: number
  loop?: boolean
  spatial?: boolean
  range?: number
  autoplay?: boolean
  name?: string
}

export interface StageAudioRuntimeOptions {
  camera?: THREE.Camera
  gestureTarget?: HTMLElement
  resolveAssetUrl?: (url: string) => string
}

export interface StageAudioRuntimeHandle {
  dispose(): void
}

type StageAudioRecord = {
  id: string
  sound: THREE.Audio | THREE.PositionalAudio
  object: THREE.Object3D
  loaded: boolean
  shouldPlay: boolean
  volume: number
  scratch: THREE.Vector3
}

function clamp01(value: unknown, fallback: number): number {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(1, Math.max(0, parsed))
}

function sourceUrl(entry: StageAudioEntry, resolveAssetUrl?: (url: string) => string): string | null {
  const source = entry.source?.trim()
  if (!source) return null
  if (/^(https?:|data:|blob:|\/)/.test(source)) return resolveAssetUrl ? resolveAssetUrl(source) : source
  const assetSource = entry.sourceType === 'file' && !source.startsWith('js-simulator/')
    ? `js-simulator/${source}`
    : source
  return resolveAssetUrl ? resolveAssetUrl(assetSource) : assetSource
}

function safeSourceId(name: string | undefined, index: number): string {
  return `stage-audio:${index}:${String(name || 'audio').replace(/[^a-zA-Z0-9_.-]/g, '_')}`
}

export function createStageAudioRuntime(
  entries: StageAudioEntry[],
  scene: THREE.Scene,
  opts: StageAudioRuntimeOptions = {},
): StageAudioRuntimeHandle {
  if (!entries.length || !opts.camera || typeof window === 'undefined') {
    return { dispose() {} }
  }

  const listener = new THREE.AudioListener()
  opts.camera.add(listener)
  const loader = new THREE.AudioLoader()
  const context = listener.context
  const records: StageAudioRecord[] = []
  const pendingStart = new Set<StageAudioRecord>()
  let disposed = false

  function tryStart(record: StageAudioRecord): void {
    if (disposed || !record.loaded || !record.shouldPlay) return
    if (context.state === 'suspended') {
      pendingStart.add(record)
      return
    }
    try {
      if (record.sound.isPlaying) record.sound.stop()
      record.sound.play()
    } catch (error) {
      console.warn('[stage-audio] playback failed', error)
    }
  }

  function flushPending(): void {
    for (const record of Array.from(pendingStart)) {
      pendingStart.delete(record)
      tryStart(record)
    }
  }

  function onFirstGesture(): void {
    opts.gestureTarget?.removeEventListener('pointerdown', onFirstGesture)
    opts.gestureTarget?.removeEventListener('keydown', onFirstGesture)
    if (context.state === 'suspended') context.resume().then(flushPending, () => {})
    else flushPending()
  }

  if (context.state === 'suspended' && opts.gestureTarget) {
    opts.gestureTarget.addEventListener('pointerdown', onFirstGesture)
    opts.gestureTarget.addEventListener('keydown', onFirstGesture)
  }

  entries.forEach((entry, index) => {
    const url = sourceUrl(entry, opts.resolveAssetUrl)
    if (!url) return

    const id = safeSourceId(entry.name, index)
    const volume = clamp01(entry.volume, 0.8)
    const spatial = entry.spatial ?? true
    const range = Math.max(0.1, Number.isFinite(entry.range) ? Number(entry.range) : 10)
    const position = entry.position ?? [0, 0.5, 0]

    const sound = spatial ? new THREE.PositionalAudio(listener) : new THREE.Audio(listener)
    sound.setLoop(entry.loop ?? false)
    sound.setVolume(volume)

    if (spatial) {
      const positional = sound as THREE.PositionalAudio
      positional.position.set(position[0], position[1], position[2])
      // Keep positional playback audible from normal simulator camera distances.
      // The stage-builder range is a design radius, but using it as a hard
      // linear WebAudio cutoff can make clips sound like a 0.1s blip when the
      // camera/listener starts just outside that radius.
      positional.setRefDistance(Math.min(1, range))
      positional.setMaxDistance(Math.max(range, 20))
      positional.setDistanceModel('inverse')
      positional.setRolloffFactor(0.8)
      scene.add(positional)
    } else {
      listener.add(sound)
    }

    const record: StageAudioRecord = {
      id,
      sound,
      object: sound,
      loaded: false,
      shouldPlay: entry.autoplay ?? true,
      volume,
      scratch: new THREE.Vector3(),
    }
    records.push(record)

    if (spatial) {
      registerSource({
        id,
        worldPos: () => {
          record.object.getWorldPosition(record.scratch)
          return record.scratch
        },
        currentAmplitude0to1: () => (record.sound.isPlaying ? record.volume : 0),
        dispose: () => {},
      })
    }

    loader.load(
      url,
      (buffer) => {
        if (disposed) return
        record.sound.setBuffer(buffer)
        record.loaded = true
        tryStart(record)
      },
      undefined,
      (error) => console.warn(`[stage-audio] failed to load ${url}`, error),
    )
  })

  return {
    dispose() {
      if (disposed) return
      disposed = true
      opts.gestureTarget?.removeEventListener('pointerdown', onFirstGesture)
      opts.gestureTarget?.removeEventListener('keydown', onFirstGesture)
      pendingStart.clear()
      for (const record of records) {
        if (record.sound.isPlaying) record.sound.stop()
        unregisterSource(record.id)
        record.object.removeFromParent()
      }
      listener.removeFromParent()
    },
  }
}
