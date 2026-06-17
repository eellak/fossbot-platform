// Chassis buzzer — actuator (write-only). See ACTUATOR_MODELS.md.
//
// Lazy WebAudio via THREE.AudioListener attached to the active camera, with
// a single THREE.PositionalAudio attached to the chassis. Each beep swaps
// in a freq-keyed sine buffer (pre-rendered via OfflineAudioContext) and
// plays it; an early stop() enforces the requested duration.
//
// Browsers block audio until a user gesture, so the underlying
// AudioContext is resumed on the first pointer/key event on the sim
// canvas. Beeps requested before unlock are queued and flushed on resume.

import * as THREE from 'three'
import {
  registerSource,
  unregisterSource,
} from '../sensors/mic/SoundSourceRegistry'

const BUZZER_SOURCE_ID = 'buzzer'

export interface BuzzerOptions {
  /** Active camera — the AudioListener attaches here for spatial mixing. */
  camera: THREE.Camera
  /** Chassis Object3D — the PositionalAudio attaches here so it moves with the bot. */
  chassis: THREE.Object3D
  /** Element listened on for the first user gesture (typically the sim canvas). */
  gestureTarget: HTMLElement
}

export interface BuzzerHandle {
  /**
   * Play a sine tone at `freqHz` for `durationMs`. Resolves when the tone
   * finishes (or immediately if disposed). Matches the hardware Python SDK
   * shape so student scripts port between sim and real bot.
   */
  beep(freqHz: number, durationMs: number): Promise<void>
  /**
   * Play a sine tone at `freqHz` for `durationMs` from world position `pos`
   * (used for fixed stage sources like the diamond beeper).
   */
  testBeepFrom(pos: THREE.Vector3, freqHz?: number, durationMs?: number): Promise<void>
  dispose(): void
}

// Spatial-audio falloff. Linear model keeps the math obvious: full volume
// inside 0.5 m, silent past 10 m, linear in between.
const REF_DISTANCE = 0.5
const MAX_DISTANCE = 10

// Length of each pre-rendered sine buffer. Playback duration is enforced
// by an early stop(); this just needs to be longer than any plausible beep.
const BUFFER_SECONDS = 2

export function createBuzzer(opts: BuzzerOptions): BuzzerHandle {
  const listener = new THREE.AudioListener()
  opts.camera.add(listener)
  const ctx = listener.context

  const positional = new THREE.PositionalAudio(listener)
  positional.setRefDistance(REF_DISTANCE)
  positional.setMaxDistance(MAX_DISTANCE)
  positional.setDistanceModel('linear')
  opts.chassis.add(positional)

  const bufferCache = new Map<number, AudioBuffer>()

  function getBuffer(freqHz: number): AudioBuffer {
    const key = Math.max(1, Math.round(freqHz))
    const cached = bufferCache.get(key)
    if (cached) return cached
    const sampleRate = ctx.sampleRate
    const length = Math.ceil(BUFFER_SECONDS * sampleRate)
    const offline = new OfflineAudioContext(1, length, sampleRate)
    const buf = offline.createBuffer(1, length, sampleRate)
    const data = buf.getChannelData(0)
    const omega = 2 * Math.PI * key
    for (let i = 0; i < length; i++) {
      data[i] = Math.sin((omega * i) / sampleRate)
    }
    bufferCache.set(key, buf)
    return buf
  }

  interface PendingBeep {
    freqHz: number
    durationMs: number
    resolve: () => void
  }
  const pending: PendingBeep[] = []
  let disposed = false

  // Reused scratch for the registry source's worldPos() — refreshed on
  // every call so mic readings track the chassis as it moves.
  const _sourceWorld = new THREE.Vector3()

  function actuallyBeep(freqHz: number, durationMs: number): Promise<void> {
    if (disposed) return Promise.resolve()
    const buf = getBuffer(freqHz)
    if (positional.isPlaying) positional.stop()
    positional.setBuffer(buf)
    positional.play()
    // Register with the sound-source registry so the mic can sample us.
    // Pure sine at unit gain → amplitude is 1 while playing.
    registerSource({
      id: BUZZER_SOURCE_ID,
      worldPos: () => {
        positional.getWorldPosition(_sourceWorld)
        return _sourceWorld
      },
      currentAmplitude0to1: () => 1,
      dispose: () => {},
    })
    return new Promise((resolve) => {
      window.setTimeout(() => {
        if (disposed) {
          unregisterSource(BUZZER_SOURCE_ID)
          return resolve()
        }
        if (positional.isPlaying) positional.stop()
        unregisterSource(BUZZER_SOURCE_ID)
        resolve()
      }, Math.max(0, durationMs))
    })
  }

  // Separate scratch vector for the static source path.
  const _staticWorld = new THREE.Vector3()

  function testBeepFrom(pos: THREE.Vector3, freqHz = 440, durationMs = 200): Promise<void> {
    if (disposed) return Promise.resolve()
    const buf = getBuffer(freqHz)
    if (positional.isPlaying) positional.stop()
    // Position the audio at the requested world position temporarily.
    positional.position.copy(pos)
    positional.setBuffer(buf)
    positional.play()
    registerSource({
      id: BUZZER_SOURCE_ID,
      worldPos: () => {
        _staticWorld.copy(pos)
        return _staticWorld
      },
      currentAmplitude0to1: () => 1,
      dispose: () => {},
    })
    return new Promise((resolve) => {
      window.setTimeout(() => {
        if (disposed) {
          unregisterSource(BUZZER_SOURCE_ID)
          return resolve()
        }
        if (positional.isPlaying) positional.stop()
        unregisterSource(BUZZER_SOURCE_ID)
        resolve()
      }, Math.max(0, durationMs))
    })
  }

  function flushPending() {
    // Sequential flush: each queued beep waits for the previous to finish,
    // so the cached order is preserved and tones don't trample each other.
    const drain = (): void => {
      if (disposed) {
        for (const p of pending) p.resolve()
        pending.length = 0
        return
      }
      const next = pending.shift()
      if (!next) return
      actuallyBeep(next.freqHz, next.durationMs).then(() => {
        next.resolve()
        drain()
      })
    }
    drain()
  }

  function onFirstGesture() {
    opts.gestureTarget.removeEventListener('pointerdown', onFirstGesture)
    opts.gestureTarget.removeEventListener('keydown', onFirstGesture)
    if (ctx.state === 'suspended') {
      ctx.resume().then(flushPending, () => {})
    } else {
      flushPending()
    }
  }
  opts.gestureTarget.addEventListener('pointerdown', onFirstGesture)
  opts.gestureTarget.addEventListener('keydown', onFirstGesture)

  return {
    beep(freqHz, durationMs) {
      if (disposed) return Promise.resolve()
      if (ctx.state === 'suspended') {
        return new Promise<void>((resolve) => {
          pending.push({ freqHz, durationMs, resolve })
        })
      }
      return actuallyBeep(freqHz, durationMs)
    },
    testBeepFrom,
    dispose() {
      disposed = true
      opts.gestureTarget.removeEventListener('pointerdown', onFirstGesture)
      opts.gestureTarget.removeEventListener('keydown', onFirstGesture)
      if (positional.isPlaying) positional.stop()
      unregisterSource(BUZZER_SOURCE_ID)
      positional.removeFromParent()
      listener.removeFromParent()
      for (const p of pending) p.resolve()
      pending.length = 0
      bufferCache.clear()
    },
  }
}
