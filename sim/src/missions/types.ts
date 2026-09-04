import type * as THREE from 'three'

export type ChallengeMarkerKind =
  | 'spawn'
  | 'target'
  | 'checkpoint'
  | 'danger_zone'
  | 'sensor_region'
  | 'collectible'
  | 'push_object'
  | 'target_zone'

export interface ChallengeMarker {
  id: string
  kind: ChallengeMarkerKind
  name: string
  order?: number
  pickupRadius?: number
  bounds: {
    min: [number, number, number]
    max: [number, number, number]
  }
  object?: THREE.Object3D
  body?: import('@dimforge/rapier3d-compat').RigidBody
}

export type MissionEvent =
  | { type: 'attempt_started'; attemptId: string; elapsedMs: number }
  | { type: 'attempt_stopped'; attemptId: string; elapsedMs: number; outcome: 'succeeded' | 'failed' | 'stopped' | 'runtime_error'; reason: string; summary: AttemptSummary }
  | { type: 'attempt_reset'; attemptId: string; elapsedMs: number }
  | { type: 'movement_action'; attemptId: string; elapsedMs: number; action: 'move_step' | 'rotate_step' | 'continuous_move' | 'continuous_rotate' | 'stop'; movementActions: number }
  | { type: 'marker_entered' | 'marker_exited'; attemptId: string; elapsedMs: number; markerId: string; markerKind: ChallengeMarkerKind }
  | { type: 'collectible_picked_up'; attemptId: string; elapsedMs: number; markerId: string; collected: number }
  | { type: 'collision_detected'; attemptId: string; elapsedMs: number }
  | { type: 'robot_fell'; attemptId: string; elapsedMs: number }
  | { type: 'object_entered_target'; attemptId: string; elapsedMs: number; objectId: string; zoneId: string }
  | { type: 'sensor_statistic_finalized'; attemptId: string; elapsedMs: number; sensorId: string; statistics: Record<string, number> }
  | { type: 'actuator_state_changed'; attemptId: string; elapsedMs: number; actuator: 'led' | 'buzzer'; state: string }
  | { type: 'program_completed'; attemptId: string; elapsedMs: number }
  | { type: 'runtime_error'; attemptId: string; elapsedMs: number; message: string }
  | { type: 'timeout'; attemptId: string; elapsedMs: number }

export type MissionEventListener = (event: MissionEvent) => void

export interface AttemptSummary {
  attemptId: string
  startedAt: string
  endedAt: string
  outcome: 'succeeded' | 'failed' | 'stopped' | 'runtime_error'
  completionReason: string
  metrics: {
    elapsedMs: number
    movementActions: number
    pathDistance: number
    collisions: number
    falls: number
    resets: number
    collectibles: number
    sensorSummaries: Record<string, Record<string, number | string>>
  }
}
