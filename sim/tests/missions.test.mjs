import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

import { createMissionState, evaluateMissionEvent, finalizeMissionState, missionAttemptTermination, objectiveResults } from '../src/missions/evaluatorCore.js'
import { challengeForEntry, isMissionIncidentCollision } from '../src/missions/stageChallengeCore.js'

const event = (type, extra = {}) => ({ type, attemptId: 'a-1', elapsedMs: 10, ...extra })
const activity = (condition, role = 'completion') => ({
  key: 'mission-1',
  completionMode: 'all',
  objectives: [{ key: 'objective-1', role, summary: 'Objective', condition }],
})

test('target and ordered checkpoint objectives transition deterministically', () => {
  const target = activity({ type: 'reach_target', markerId: 'target-a' })
  const reached = evaluateMissionEvent(target, createMissionState(target), event('marker_entered', { markerId: 'target-a' }))
  assert.equal(reached.outcome, 'succeeded')

  const checkpoints = activity({ type: 'checkpoints', markerIds: ['a', 'b'], ordered: true })
  const wrong = evaluateMissionEvent(checkpoints, createMissionState(checkpoints), event('marker_entered', { markerId: 'b' }))
  assert.equal(wrong.objectives[0].status, 'failed')
  assert.equal(wrong.outcome, 'failed')
  const first = evaluateMissionEvent(checkpoints, createMissionState(checkpoints), event('marker_entered', { markerId: 'a' }))
  const second = evaluateMissionEvent(checkpoints, first, event('marker_entered', { markerId: 'b' }))
  assert.equal(second.outcome, 'succeeded')
})

test('objective outcomes remain provisional until the program finishes', () => {
  const mission = {
    key: 'mission-1',
    completionMode: 'all',
    objectives: [
      { key: 'finish', role: 'completion', summary: 'Reach finish', condition: { type: 'reach_target', markerId: 'target-a' } },
      { key: 'safe', role: 'failure', summary: 'Avoid danger', condition: { type: 'avoid_zones', markerIds: ['danger-a'] } },
    ],
  }
  const targetEvent = event('marker_entered', { markerId: 'target-a' })
  const reached = evaluateMissionEvent(mission, createMissionState(mission), targetEvent)
  assert.equal(reached.outcome, 'succeeded')
  assert.equal(missionAttemptTermination(targetEvent, reached), null)

  const dangerEvent = event('marker_entered', { markerId: 'danger-a' })
  const failedAfterTarget = evaluateMissionEvent(mission, reached, dangerEvent)
  assert.equal(failedAfterTarget.outcome, 'failed')
  assert.equal(missionAttemptTermination(dangerEvent, failedAfterTarget), null)
  assert.deepEqual(
    missionAttemptTermination(event('program_completed'), finalizeMissionState(mission, failedAfterTarget)),
    { outcome: 'failed', reason: 'failure_objective' },
  )
})

test('danger zones fail and collectibles complete without raw events in results', () => {
  const danger = activity({ type: 'avoid_zones', markerIds: ['danger-a'] }, 'failure')
  const failed = evaluateMissionEvent(danger, createMissionState(danger), event('marker_entered', { markerId: 'danger-a' }))
  assert.equal(failed.outcome, 'failed')

  const collect = activity({ type: 'collect', markerIds: ['gem-a', 'gem-b'], requiredCount: 2 })
  const one = evaluateMissionEvent(collect, createMissionState(collect), event('collectible_picked_up', { markerId: 'gem-a' }))
  const two = evaluateMissionEvent(collect, one, event('collectible_picked_up', { markerId: 'gem-b' }))
  assert.deepEqual(objectiveResults(two), [{ key: 'objective-1', role: 'completion', status: 'succeeded' }])
})

test('safe-run and movement-limit objectives finalize independently of path distance', () => {
  const mission = {
    key: 'mission-1',
    completionMode: 'all',
    objectives: [
      { key: 'safe', role: 'completion', summary: 'Stay safe', condition: { type: 'no_incident', incidents: ['collision', 'fall'] } },
      { key: 'moves', role: 'completion', summary: 'Use few moves', condition: { type: 'limits', maxMovementActions: 2 } },
    ],
  }
  const state = evaluateMissionEvent(mission, createMissionState(mission), event('movement_action', { movementActions: 2 }))
  assert.equal(finalizeMissionState(mission, state).outcome, 'succeeded')
  const exceeded = evaluateMissionEvent(mission, createMissionState(mission), event('movement_action', { movementActions: 3 }))
  assert.equal(exceeded.objectives[1].status, 'failed')
})

test('stop, push, sensor, and actuator objectives use structured events', () => {
  const stop = activity({ type: 'stop_in_target', markerId: 'target-a' })
  const inside = evaluateMissionEvent(stop, createMissionState(stop), event('marker_entered', { markerId: 'target-a' }))
  assert.equal(evaluateMissionEvent(stop, inside, event('program_completed')).outcome, 'succeeded')

  const push = activity({ type: 'object_in_zone', objectId: 'box-a', zoneId: 'zone-a' })
  assert.equal(evaluateMissionEvent(push, createMissionState(push), event('object_entered_target', { objectId: 'box-a', zoneId: 'zone-a' })).outcome, 'succeeded')

  const sensor = activity({ type: 'sensor_threshold', sensorId: 'ultrasonic-front', statistic: 'minimum', operator: 'lte', threshold: 0.2 })
  assert.equal(evaluateMissionEvent(sensor, createMissionState(sensor), event('sensor_statistic_finalized', { sensorId: 'ultrasonic-front', statistics: { minimum: 0.2 } })).outcome, 'succeeded')

  const actuator = activity({ type: 'actuator_state', actuator: 'led', state: 'green' })
  assert.equal(evaluateMissionEvent(actuator, createMissionState(actuator), event('actuator_state_changed', { actuator: 'led', state: 'green' })).outcome, 'succeeded')
})

test('stage challenge metadata survives JSON round-trip and legacy markers get stable IDs', () => {
  const kinds = ['spawn', 'target', 'checkpoint', 'danger_zone', 'sensor_region', 'collectible', 'push_object', 'target_zone']
  const entries = kinds.map((kind, index) => ({
    type: kind === 'spawn' ? 'fossbot' : kind === 'collectible' ? 'sphere' : kind === 'push_object' ? 'cube' : 'base',
    name: kind,
    challenge: {
      markerId: `mission-${kind}`,
      kind,
      order: kind === 'checkpoint' ? 2 : undefined,
      pickupRadius: kind === 'collectible' ? 0.35 : undefined,
    },
  }))
  entries.push({ type: 'base', name: 'hidden target', hidden: true, challenge: { markerId: 'hidden', kind: 'target' } })
  const roundTripped = JSON.parse(JSON.stringify(entries))
  assert.deepEqual(
    roundTripped.map(challengeForEntry).filter(Boolean).map(({ markerId, kind }) => ({ markerId, kind })),
    kinds.map((kind) => ({ markerId: `mission-${kind}`, kind })),
  )
  assert.equal(challengeForEntry({ type: 'sphere', name: 'Collectible gem' }, 4).markerId, 'collectible-gem-5')
})

test('push-object contact is not classified as a mission collision incident', () => {
  const markers = [
    { kind: 'push_object', body: { handle: 42 } },
    { kind: 'target_zone' },
  ]
  assert.equal(isMissionIncidentCollision(42, markers), false)
  assert.equal(isMissionIncidentCollision(7, markers), true)
  assert.equal(isMissionIncidentCollision(undefined, markers), true)
})

test('Phase 6 mission lab exposes every challenge marker kind with stable IDs', async () => {
  const source = JSON.parse(await readFile(new URL('../src/stages/data/stage_missions_phase6.json', import.meta.url), 'utf8'))
  const deployed = JSON.parse(await readFile(new URL('../../front-end/public/js-simulator/stages/stage_missions_phase6.json', import.meta.url), 'utf8'))
  assert.deepEqual(deployed, source)

  const markers = source.map(challengeForEntry).filter(Boolean)
  assert.equal(new Set(markers.map(({ markerId }) => markerId)).size, markers.length)
  assert.deepEqual(
    new Set(markers.map(({ kind }) => kind)),
    new Set(['spawn', 'target', 'checkpoint', 'danger_zone', 'sensor_region', 'collectible', 'push_object', 'target_zone']),
  )
})
