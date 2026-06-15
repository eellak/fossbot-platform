// Static sensor layout for the v2 chassis. Placeholder poses — tuned
// later via the debug folder (see SENSOR_MODELS.md §2, §5).
//
// Frame: chassis-local, Y-up. Forward = +Z, left = -X (mirror of wheel X:
// LEFT_WHEEL_POS_M.x = -0.079, RIGHT = +0.079; see robot/v2.ts).
// Footprint width ≈ 0.17 m, deck height ≈ 0.05 m above ground.

import type { SensorLayoutEntry } from './types'

const FRONT_Z = -0.085 // ~front edge of chassis (caster sits at z=0.07)
const SIDE_X = 0.085 // ~half footprint width
const DECK_Y = 0.05 // sensor board height above ground
const FLOOR_Y = 0.032 // bottom-IR mount height (just under deck)

const LED_OFF: [number, number, number] = [0, 0, 0]

export const SENSOR_LAYOUT: readonly SensorLayoutEntry[] = [
  // --- Ultrasonic, front center, facing forward ---
  {
    id: 'ultrasonic-front',
    kind: 'ultrasonic',
    localPos: [0, DECK_Y + 0.01, FRONT_Z],
    localDir: [0, 0, -1],
    maxRange: 4.0,
    halfAngleDeg: 7.5,
    rayCount: 5,
  },

  // --- Front IR pair, angled slightly outward ---
  {
    id: 'ir-front-left',
    kind: 'ir-proximity',
    localPos: [-0.055, DECK_Y + 0.027, FRONT_Z + 0.015],
    localDir: [-0.2, 0, -0.98],
    maxRange: 0.3,
    tripDistance: 0.12,
    led: { defaultColor: LED_OFF },
  },
  {
    id: 'ir-front-right',
    kind: 'ir-proximity',
    localPos: [0.055, DECK_Y + 0.027, FRONT_Z + 0.015],
    localDir: [0.2, 0, -0.98],
    maxRange: 0.3,
    tripDistance: 0.12,
    led: { defaultColor: LED_OFF },
  },

  // --- Side IR pair, facing straight out ---
  {
    id: 'ir-side-left',
    kind: 'ir-proximity',
    localPos: [-SIDE_X, DECK_Y + 0.027, 0.01],
    localDir: [-1, 0, 0],
    maxRange: 0.3,
    tripDistance: 0.12,
    led: { defaultColor: LED_OFF },
  },
  {
    id: 'ir-side-right',
    kind: 'ir-proximity',
    localPos: [SIDE_X, DECK_Y + 0.027, 0.01],
    localDir: [1, 0, 0],
    maxRange: 0.3,
    tripDistance: 0.12,
    led: { defaultColor: LED_OFF },
  },

  // --- Floor IR triplet, line-following, facing straight down ---
  {
    id: 'ir-floor-left',
    kind: 'ir-floor',
    localPos: [-0.025, FLOOR_Y, FRONT_Z + 0.025],
    localDir: [0, -1, 0],
    maxRange: 0.03,
    led: { defaultColor: LED_OFF },
  },
  {
    id: 'ir-floor-center',
    kind: 'ir-floor',
    localPos: [0, FLOOR_Y, FRONT_Z + 0.025],
    localDir: [0, -1, 0],
    maxRange: 0.03,
    led: { defaultColor: LED_OFF },
  },
  {
    id: 'ir-floor-right',
    kind: 'ir-floor',
    localPos: [0.025, FLOOR_Y, FRONT_Z + 0.025],
    localDir: [0, -1, 0],
    maxRange: 0.03,
    led: { defaultColor: LED_OFF },
  },
]
