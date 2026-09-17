import * as THREE from 'three'
import { registerSource, unregisterSource } from '../sensors/mic/SoundSourceRegistry'
import { robotInsideAudioRange } from './audioRange'

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
  updateRobotPosition(position: { x: number; z: number }): void
  dispose(): void
}

type StageAudioRecord = {
  id: string
  sound: THREE.Audio | THREE.PositionalAudio
  media?: HTMLAudioElement
  object: THREE.Object3D
  loaded: boolean
  shouldPlay: boolean
  spatial: boolean
  range: number
  position: [number, number, number]
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
  const assetSource = entry.sourceType === 'file' && !source.startsWith('js-simulator/') && !source.startsWith('assets/')
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
    return { updateRobotPosition() {}, dispose() {} }
  }

  const listener = new THREE.AudioListener()
  opts.camera.add(listener)
  const loader = new THREE.AudioLoader()
  const context = listener.context
  const gestureDocument = opts.gestureTarget?.ownerDocument ?? document
  const records: StageAudioRecord[] = []
  const pendingStart = new Set<StageAudioRecord>()
  const pendingMedia = new Set<StageAudioRecord>()
  let disposed = false

  function tryStart(record: StageAudioRecord): void {
    if (disposed || !record.loaded || !record.shouldPlay) return
    if (record.media) {
      void record.media.play().then(() => {
        if (!record.shouldPlay) record.media?.pause()
        pendingMedia.delete(record)
        if (!pendingMedia.size) stopListeningForMediaGesture()
      }, (error) => {
        if (disposed || !record.shouldPlay) return
        console.warn('[stage-audio] media playback failed', error)
        pendingMedia.add(record)
        gestureDocument.addEventListener('pointerdown', onMediaGesture, true)
        gestureDocument.addEventListener('keydown', onMediaGesture, true)
      })
      return
    }
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

  function stopListeningForMediaGesture(): void {
    gestureDocument.removeEventListener('pointerdown', onMediaGesture, true)
    gestureDocument.removeEventListener('keydown', onMediaGesture, true)
  }

  function onMediaGesture(): void {
    for (const record of Array.from(pendingMedia)) tryStart(record)
  }

  function onContextStateChange(): void {
    if (context.state === 'running') {
      stopListeningForGesture()
      flushPending()
    }
  }

  function stopListeningForGesture(): void {
    gestureDocument.removeEventListener('pointerdown', onGesture, true)
    gestureDocument.removeEventListener('keydown', onGesture, true)
  }

  function onGesture(): void {
    if (disposed) return
    if (context.state !== 'suspended') {
      stopListeningForGesture()
      flushPending()
      return
    }
    // A simulator can be opened from an editor control outside its canvas.
    // Keep listening until resume succeeds, including after a rejected attempt.
    void context.resume().then(() => {
      if (disposed) return
      stopListeningForGesture()
      flushPending()
    }, () => {})
  }

  if (context.state === 'suspended') {
    gestureDocument.addEventListener('pointerdown', onGesture, true)
    gestureDocument.addEventListener('keydown', onGesture, true)
    // Browsers with sticky user activation can resume immediately after the
    // editor's Run Test gesture, even though loading the stage is asynchronous.
    if (navigator.userActivation?.hasBeenActive) onGesture()
  }
  context.addEventListener('statechange', onContextStateChange)

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
      // The robot's position gates playback. Camera distance must not silence
      // audio while the robot is inside the marked range.
      positional.setRefDistance(Math.min(1, range))
      positional.setMaxDistance(Math.max(range, 20))
      positional.setDistanceModel('inverse')
      positional.setRolloffFactor(0)
      scene.add(positional)
    } else {
      listener.add(sound)
    }

    const record: StageAudioRecord = {
      id,
      sound,
      object: sound,
      loaded: false,
      shouldPlay: spatial ? false : entry.autoplay ?? true,
      spatial,
      range,
      position,
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
        currentAmplitude0to1: () => (record.sound.isPlaying || (record.media && !record.media.paused) ? record.volume : 0),
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
      (error) => {
        if (disposed) return
        // HTML media can play cross-origin URLs that Web Audio cannot decode
        // without CORS. Fall back to audible non-positional playback.
        console.warn('[stage-audio] Web Audio load failed; trying media playback', error)
        const media = new Audio(url)
        media.volume = volume
        media.loop = entry.loop ?? false
        media.onerror = () => {
          pendingMedia.delete(record)
          if (!pendingMedia.size) stopListeningForMediaGesture()
          console.warn('[stage-audio] media source failed to load', url)
        }
        record.media = media
        record.loaded = true
        pendingStart.delete(record)
        tryStart(record)
      },
    )
  })

  return {
    updateRobotPosition(robotPosition) {
      if (disposed) return
      for (const record of records) {
        if (!record.spatial) continue
        const inside = robotInsideAudioRange(robotPosition, record.position, record.range)
        if (inside === record.shouldPlay) continue
        record.shouldPlay = inside
        if (inside) {
          if (record.loaded) tryStart(record)
        } else {
          pendingStart.delete(record)
          pendingMedia.delete(record)
          if (!pendingMedia.size) stopListeningForMediaGesture()
          if (record.sound.isPlaying) record.sound.stop()
          if (record.media) {
            record.media.pause()
            record.media.currentTime = 0
          }
        }
      }
    },
    dispose() {
      if (disposed) return
      disposed = true
      stopListeningForGesture()
      stopListeningForMediaGesture()
      context.removeEventListener('statechange', onContextStateChange)
      pendingStart.clear()
      pendingMedia.clear()
      for (const record of records) {
        if (record.sound.isPlaying) record.sound.stop()
        if (record.media) {
          record.media.pause()
          record.media.onerror = null
          record.media.removeAttribute('src')
          record.media.load()
        }
        unregisterSource(record.id)
        record.object.removeFromParent()
      }
      listener.removeFromParent()
    },
  }
}
