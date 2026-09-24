/** Audio ranges are circles on the stage floor, matching the editor marker. */
export function robotInsideAudioRange(robot, source, range) {
  const dx = robot.x - source[0]
  const dz = robot.z - source[2]
  return dx * dx + dz * dz <= range * range
}
