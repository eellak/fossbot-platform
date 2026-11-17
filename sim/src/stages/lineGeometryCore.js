export const LINE_CURVE_VERSION = 2
export const MAX_LINE_SEGMENTS = 4096

const finite = value => typeof value === 'number' && Number.isFinite(value)
const positive = value => finite(value) && value > 0
const distance = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1])
const midpoint = (a, b) => [a[0] / 2 + b[0] / 2, a[1] / 2 + b[1] / 2]

export function sharpLineCorners(points, closed = false) {
  return points.map((_, i) => !closed && (i === 0 || i === points.length - 1) ? null : { mode: 'sharp' })
}

export function automaticLineCorners(points, closed = false) {
  return points.map((_, i) => !closed && (i === 0 || i === points.length - 1)
    ? null : { mode: 'rounded', sizing: 'auto' })
}

/** Validate authored data without changing or discarding it. Legacy lines stay sharp. */
export function validateLineGeometry(line) {
  const diagnostics = []
  const error = (code, message, pointIndex) => diagnostics.push({ code, message, severity: 'error', ...(pointIndex === undefined ? {} : { pointIndex }) })
  if (!line || typeof line !== 'object' || Array.isArray(line)) {
    error('invalid-line', 'A line must be an object.')
    return diagnostics
  }
  if (line.curveVersion !== undefined && ![1, LINE_CURVE_VERSION].includes(line.curveVersion)) {
    error('unsupported-curve-version', 'This line uses an unsupported curve version. Open it in a compatible editor.')
  }
  if (line.closed !== undefined && typeof line.closed !== 'boolean') error('invalid-closed', 'Closed must be a boolean.')
  if (line.closed === true && line.curveVersion !== 2) error('unsupported-closed-line', 'Closed paths require line curve version 2.')
  if (!positive(line.width === undefined ? 0.01 : line.width)) error('invalid-width', 'Line width must be a finite positive distance.')
  if (!finite(line.y === undefined ? 0.001 : line.y)) error('invalid-height', 'Line height must be finite.')
  if (!Array.isArray(line.points) || line.points.length === 0) {
    error('invalid-points', 'A line needs at least one authored point.')
    return diagnostics
  }
  if (line.closed && line.points.length < 3) error('incomplete-loop', 'A closed path needs at least three points.')
  line.points.forEach((point, i) => {
    if (!Array.isArray(point) || point.length !== 2 || !point.every(finite)) {
      error('invalid-point', 'Each point must contain two finite coordinates.', i)
    }
  })
  if ([1, LINE_CURVE_VERSION].includes(line.curveVersion)) {
    if (!Array.isArray(line.corners) || line.corners.length !== line.points.length) {
      error('invalid-corners', 'Supply one corner record per point, with null endpoints.')
    } else {
      line.corners.forEach((corner, i) => {
        if (!line.closed && (i === 0 || i === line.points.length - 1)) {
          if (corner !== null) error('invalid-endpoint', 'Endpoint corners must be null.', i)
          return
        }
        const record = corner && typeof corner === 'object' && !Array.isArray(corner)
        const keys = record ? Object.keys(corner) : []
        const sharp = record && corner.mode === 'sharp' && keys.length === 1
        const auto = record && corner.mode === 'rounded' && corner.sizing === 'auto' && keys.length === 2
        const manual = record && corner.mode === 'rounded' && corner.sizing === 'manual' && positive(corner.trim) && keys.length === 3
        if (!sharp && !auto && !manual) error('invalid-corner', 'Use Sharp, automatic Rounded, or Rounded with a finite positive requested trim.', i)
      })
    }
  }
  return diagnostics
}

/** Pure shared route for rendering, picking and floor sensors. Errors never return a partial route. */
export function evaluateLineGeometry(line) {
  const diagnostics = validateLineGeometry(line)
  const result = { route: [], diagnostics, requestedTrims: [], effectiveTrims: [], segmentCount: 0, runnable: false }
  if (diagnostics.some(item => item.severity === 'error')) return result
  const { points } = line
  const closed = line.closed === true
  const count = points.length
  const corners = [1, LINE_CURVE_VERSION].includes(line.curveVersion) ? line.corners : sharpLineCorners(points)
  const lengths = []
  const directions = []
  const error = (code, message, pointIndex) => diagnostics.push({ code, message, severity: 'error', ...(pointIndex === undefined ? {} : { pointIndex }) })
  for (let i = 0; i < (closed ? count : count - 1); i++) {
    const next = points[(i + 1) % count]
    const length = distance(points[i], next)
    if (!positive(length)) error('invalid-section', 'Consecutive points must define a finite, non-zero section. Move or remove a point.', i)
    lengths.push(length)
    directions.push([(next[0] - points[i][0]) / length, (next[1] - points[i][1]) / length])
  }
  if (diagnostics.length) return result
  result.requestedTrims = points.map(() => 0)
  for (let i = closed ? 0 : 1; i < (closed ? count : count - 1); i++) {
    if (corners[i].mode === 'sharp') continue
    const incoming = directions[(i - 1 + count) % count]
    const outgoing = directions[i]
    const cross = incoming[0] * outgoing[1] - incoming[1] * outgoing[0]
    const dot = incoming[0] * outgoing[0] + incoming[1] * outgoing[1]
    if (cross === 0) {
      if (dot < 0) error('rounded-reversal', 'This rounded corner reverses direction. Move the point or choose Sharp.', i)
      continue
    }
    result.requestedTrims[i] = corners[i].sizing === 'manual'
      ? corners[i].trim : Math.min(lengths[(i - 1 + count) % count], lengths[i]) / 4
  }
  if (diagnostics.length) return result
  // Scale each pair before summing so large finite requests cannot overflow.
  const factors = lengths.map((length, i) => {
    const a = result.requestedTrims[i]
    const b = result.requestedTrims[(i + 1) % count]
    const scale = Math.max(a, b)
    return scale === 0 ? 1 : Math.min(1, (length / scale) / (a / scale + b / scale))
  })
  result.effectiveTrims = result.requestedTrims.map((request, i) =>
    request * Math.min(factors[closed ? (i - 1 + count) % count : i - 1] ?? 1, factors[i] ?? 1))
  if (points.length === 1) {
    diagnostics.push({ code: 'incomplete-line', message: 'Continue drawing or delete this point. It has no runnable line yet.', severity: 'notice' })
    return result
  }
  const firstTrim = result.effectiveTrims[0]
  const route = [closed ? [points[0][0] - directions[count - 1][0] * firstTrim,
    points[0][1] - directions[count - 1][1] * firstTrim] : points[0].slice()]
  const append = point => {
    if (!point.every(finite)) {
      error('non-finite-route', 'The line cannot be evaluated with these coordinates.')
      return false
    }
    if (distance(route[route.length - 1], point) === 0) return true
    if (route.length > MAX_LINE_SEGMENTS) {
      error('segment-limit', `This path exceeds ${MAX_LINE_SEGMENTS} evaluated segments. Reduce its complexity before running.`)
      return false
    }
    route.push(point)
    return true
  }
  const tolerance = Math.min(0.001, (line.width ?? 0.01) / 8)
  for (let i = closed ? 0 : 1; i < (closed ? count : count - 1); i++) {
    const trim = result.effectiveTrims[i]
    if (trim === 0) {
      if (!append(points[i].slice())) return result
      continue
    }
    const control = points[i]
    const start = [control[0] - directions[(i - 1 + count) % count][0] * trim, control[1] - directions[(i - 1 + count) % count][1] * trim]
    const end = [control[0] + directions[i][0] * trim, control[1] + directions[i][1] * trim]
    if (!append(start)) return result
    const stack = [[start, control, end]]
    while (stack.length) {
      const [a, b, c] = stack.pop()
      const chord = distance(a, c)
      const deviation = chord === 0 ? distance(a, b)
        : Math.abs((b[0] - a[0]) * ((c[1] - a[1]) / chord) - (b[1] - a[1]) * ((c[0] - a[0]) / chord))
      if (deviation <= tolerance) {
        if (!append(c)) return result
      } else {
        const ab = midpoint(a, b)
        const bc = midpoint(b, c)
        const mid = midpoint(ab, bc)
        // Every pending piece needs a segment. Reject rather than silently coarsen.
        if (route.length + stack.length + 2 > MAX_LINE_SEGMENTS + 1) {
          error('segment-limit', `This path exceeds ${MAX_LINE_SEGMENTS} evaluated segments. Reduce its complexity before running.`)
          return result
        }
        if (!finite(deviation) || (distance(a, mid) === 0 || distance(mid, c) === 0)) {
          error('sampling-precision', 'These coordinates cannot be sampled accurately. Move the line closer to the origin or increase its width.')
          return result
        }
        stack.push([mid, bc, c], [a, ab, mid])
      }
    }
  }
  if (!append(closed ? route[0].slice() : points[points.length - 1].slice())) return result
  result.route = route
  result.segmentCount = route.length - 1
  result.runnable = true
  return result
}
