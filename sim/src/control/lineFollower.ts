export interface LineFollowerReadings {
  left: boolean
  center: boolean
  right: boolean
}

export interface DriveCommand {
  left: number
  right: number
}

export interface LineFollowerConfig {
  /** Wheel input when going straight forward (both sensors symmetric). */
  forward: number
  /** Inner-wheel input when veering. Outer wheel uses `forward`. */
  slow: number
  /** Wheel input magnitude during spin-search after losing the line. */
  spin: number
  /** Seconds of spin-search before giving up and disengaging. */
  graceSec: number
  /** Seconds to drive forward hunting for the line after engaging, before
   *  giving up if no sensor has triggered yet. */
  acquireSec: number
}

export const DEFAULT_LINE_FOLLOWER_CONFIG: LineFollowerConfig = {
  forward: 0.6,
  slow: 0.2,
  spin: 0.35,
  graceSec: 1.0,
  acquireSec: 2.0,
}

export interface LineFollower {
  step: (r: LineFollowerReadings, dt: number) => DriveCommand | null
  reset: () => void
}

function instantaneousStep(r: LineFollowerReadings, c: LineFollowerConfig): DriveCommand | null {
  if (!r.left && !r.center && !r.right) return null
  if (r.center && !r.left && !r.right) return { left: c.forward, right: c.forward }
  if (r.left && !r.right) return { left: c.slow, right: c.forward }
  if (r.right && !r.left) return { left: c.forward, right: c.slow }
  return { left: c.forward, right: c.forward }
}

export function createLineFollower(config: LineFollowerConfig): LineFollower {
  // Direction of the most recent off-center sensor reading:
  //   -1 = left sensor saw line last, +1 = right, 0 = only center (or none).
  let lastSide = 0
  let lostSec = 0
  // Acquire phase: drive forward until we first see the line.
  let acquired = false
  let acquireSec = 0

  return {
    step(r, dt) {
      const anyHit = r.left || r.center || r.right

      if (!acquired) {
        if (anyHit) {
          acquired = true
        } else if (acquireSec < config.acquireSec) {
          acquireSec += dt
          return { left: config.forward, right: config.forward }
        } else {
          // Never found the line in time — give up.
          acquireSec = 0
          return null
        }
      }

      if (r.left && !r.right) lastSide = -1
      else if (r.right && !r.left) lastSide = 1
      else if (r.center && !r.left && !r.right) lastSide = 0

      const cmd = instantaneousStep(r, config)
      if (cmd) {
        lostSec = 0
        return cmd
      }
      // lastSide=0 → we lost the line while straight → end-of-track, give up.
      if (lastSide !== 0 && lostSec < config.graceSec) {
        lostSec += dt
        return lastSide < 0
          ? { left: -config.spin, right: config.spin }
          : { left: config.spin, right: -config.spin }
      }
      lastSide = 0
      lostSec = 0
      return null
    },
    reset() {
      lastSide = 0
      lostSec = 0
      acquired = false
      acquireSec = 0
    },
  }
}
