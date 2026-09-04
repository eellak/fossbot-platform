function initialObjective(objective) {
  return {
    key: objective.key,
    role: objective.role,
    summary: objective.summary,
    status: 'pending',
    progress: 0,
    visited: [],
  }
}

export function createMissionState(activity) {
  return {
    activityKey: activity.key,
    completionMode: activity.completionMode || 'all',
    objectives: activity.objectives.map(initialObjective),
    outcome: 'running',
    failureReason: null,
  }
}

function compare(value, operator, threshold) {
  if (operator === 'lt') return value < threshold
  if (operator === 'lte') return value <= threshold
  if (operator === 'eq') return Math.abs(value - threshold) <= 1e-9
  if (operator === 'gte') return value >= threshold
  return value > threshold
}

function completionReached(activity, state) {
  const completion = activity.objectives
    .map((objective, index) => ({ objective, result: state.objectives[index] }))
    .filter(({ objective }) => objective.role === 'completion')
    .map(({ result }) => result.status === 'succeeded')
  return (activity.completionMode || 'all') === 'any' ? completion.some(Boolean) : completion.every(Boolean)
}

function deriveOutcome(activity, state) {
  const failed = state.objectives.find((result, index) =>
    activity.objectives[index].role === 'failure' && result.status === 'failed')
  if (failed) return { ...state, outcome: 'failed', failureReason: failed.key }
  const completionResults = state.objectives.filter((_, index) => activity.objectives[index].role === 'completion')
  const completionImpossible = (activity.completionMode || 'all') === 'any'
    ? completionResults.every((result) => result.status === 'failed')
    : completionResults.some((result) => result.status === 'failed')
  if (completionImpossible) {
    const result = completionResults.find((item) => item.status === 'failed')
    return { ...state, outcome: 'failed', failureReason: result?.key || null }
  }
  if (completionReached(activity, state)) return { ...state, outcome: 'succeeded', failureReason: null }
  return { ...state, outcome: 'running', failureReason: null }
}

function updateObjective(objective, result, event) {
  if (result.status === 'failed') return result
  const condition = objective.condition
  if (condition.type === 'reach_target' && event.type === 'marker_entered' && event.markerId === condition.markerId) {
    return { ...result, status: 'succeeded', progress: 1 }
  }
  if (condition.type === 'checkpoints' && event.type === 'marker_entered' && condition.markerIds.includes(event.markerId)) {
    if (result.visited.includes(event.markerId)) return result
    if (condition.ordered) {
      const expected = condition.markerIds[result.visited.length]
      if (event.markerId !== expected) return { ...result, status: 'failed' }
    }
    const visited = [...result.visited, event.markerId]
    return { ...result, visited, progress: visited.length / condition.markerIds.length, status: visited.length === condition.markerIds.length ? 'succeeded' : 'pending' }
  }
  if (condition.type === 'collect' && event.type === 'collectible_picked_up' && condition.markerIds.includes(event.markerId)) {
    const visited = result.visited.includes(event.markerId) ? result.visited : [...result.visited, event.markerId]
    const needed = condition.requiredCount || condition.markerIds.length
    return { ...result, visited, progress: Math.min(1, visited.length / needed), status: visited.length >= needed ? 'succeeded' : 'pending' }
  }
  if (condition.type === 'avoid_zones' && event.type === 'marker_entered' && condition.markerIds.includes(event.markerId)) {
    return { ...result, status: 'failed' }
  }
  if (condition.type === 'stop_in_target') {
    if (event.type === 'marker_entered' && event.markerId === condition.markerId) return { ...result, visited: [condition.markerId] }
    if (event.type === 'marker_exited' && event.markerId === condition.markerId) return { ...result, visited: [] }
    if ((event.type === 'program_completed' || event.type === 'attempt_stopped') && result.visited.includes(condition.markerId)) return { ...result, status: 'succeeded', progress: 1 }
  }
  if (condition.type === 'object_in_zone' && event.type === 'object_entered_target' && event.objectId === condition.objectId && event.zoneId === condition.zoneId) {
    return { ...result, status: 'succeeded', progress: 1 }
  }
  if (condition.type === 'no_incident') {
    const incident = event.type === 'collision_detected' ? 'collision' : event.type === 'robot_fell' ? 'fall' : event.type === 'runtime_error' ? 'runtime_error' : null
    if (incident && condition.incidents.includes(incident)) return { ...result, status: 'failed' }
  }
  if (condition.type === 'sensor_threshold' && event.type === 'sensor_statistic_finalized' && event.sensorId === condition.sensorId) {
    const value = event.statistics[condition.statistic]
    if (Number.isFinite(value) && compare(value, condition.operator, condition.threshold)) return { ...result, status: 'succeeded', progress: 1 }
  }
  if (condition.type === 'actuator_state' && event.type === 'actuator_state_changed' && event.actuator === condition.actuator && event.state === condition.state) {
    return { ...result, status: 'succeeded', progress: 1 }
  }
  if (condition.type === 'limits') {
    if (condition.maxMovementActions && event.type === 'movement_action' && event.movementActions > condition.maxMovementActions) return { ...result, status: 'failed' }
    if (condition.maxDurationMs && (event.type === 'timeout' || event.elapsedMs > condition.maxDurationMs)) return { ...result, status: 'failed' }
  }
  return result
}

export function evaluateMissionEvent(activity, current, event) {
  const objectives = current.objectives.map((result, index) => updateObjective(activity.objectives[index], result, event))
  return deriveOutcome(activity, { ...current, objectives })
}

export function finalizeMissionState(activity, current) {
  const objectives = current.objectives.map((result, index) => {
    const condition = activity.objectives[index].condition
    if (result.status !== 'pending') return result
    if (condition.type === 'avoid_zones' || condition.type === 'no_incident' || condition.type === 'limits') {
      return { ...result, status: 'succeeded', progress: 1 }
    }
    return result
  })
  return deriveOutcome(activity, { ...current, objectives })
}

/**
 * Decide whether a simulator event ends the attempt. Objective transitions are
 * deliberately provisional until a terminal execution event arrives.
 * @returns {{ outcome: 'succeeded' | 'failed' | 'stopped' | 'runtime_error', reason: string } | null}
 */
export function missionAttemptTermination(event, state) {
  if (event.type === 'runtime_error') return { outcome: 'runtime_error', reason: 'runtime_error' }
  if (event.type === 'robot_fell') return { outcome: 'failed', reason: 'fall' }
  if (event.type === 'timeout') return { outcome: 'failed', reason: 'timeout' }
  if (event.type !== 'program_completed') return null
  if (state.outcome === 'succeeded') return { outcome: 'succeeded', reason: 'objectives_met' }
  if (state.outcome === 'failed') return { outcome: 'failed', reason: 'failure_objective' }
  return { outcome: 'stopped', reason: 'program_completed' }
}

export function objectiveResults(state) {
  return state.objectives.map(({ key, role, status }) => ({ key, role, status }))
}
