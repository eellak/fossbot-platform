import GUI from 'lil-gui'
import type { RobotV2 } from '../../robot/v2'

// Fender values are in CAD-mm pre-flip frame (the same units as PART_DEFAULTS in v2.ts).
// Wheel values are in WORLD-mm Y-up frame (root-local). We display mm and write
// meters (×0.001) into the THREE positions, so the dump output reads naturally.

interface TunerState {
  // Body (pivot) world-mm
  bodyX: number
  bodyY: number
  bodyZ: number
  // Fender CAD-mm
  leftFenderX: number
  leftFenderY: number
  leftFenderZ: number
  rightFenderX: number
  rightFenderY: number
  rightFenderZ: number
  mirrorRightFender: boolean
  // Wheel world-mm
  leftWheelX: number
  leftWheelY: number
  leftWheelZ: number
  rightWheelX: number
  rightWheelY: number
  rightWheelZ: number
  mirrorRightWheel: boolean
  // Uniform multiplier on both wheels' group scale
  wheelScale: number
}

export interface VisualTunerHandle {
  mainFolder: ReturnType<GUI['addFolder']>
  dispose: () => void
  /** If embedded, this is the Actions folder where caller can attach toggles */
  actionsFolder?: ReturnType<GUI['addFolder']>
}

export function buildVisualTunerFolder(parentGui: GUI, robot: RobotV2): VisualTunerHandle {
  const d = robot.defaults

  const state: TunerState = {
    bodyX: d.bodyM[0] * 1000,
    bodyY: d.bodyM[1] * 1000,
    bodyZ: d.bodyM[2] * 1000,
    leftFenderX: d.leftFenderMm[0],
    leftFenderY: d.leftFenderMm[1],
    leftFenderZ: d.leftFenderMm[2],
    rightFenderX: d.rightFenderMm[0],
    rightFenderY: d.rightFenderMm[1],
    rightFenderZ: d.rightFenderMm[2],
    mirrorRightFender: true,
    leftWheelX: d.leftWheelM[0] * 1000,
    leftWheelY: d.leftWheelM[1] * 1000,
    leftWheelZ: d.leftWheelM[2] * 1000,
    rightWheelX: d.rightWheelM[0] * 1000,
    rightWheelY: d.rightWheelM[1] * 1000,
    rightWheelZ: d.rightWheelM[2] * 1000,
    mirrorRightWheel: true,
    wheelScale: d.wheelScale,
  }

  const apply = () => {
    if (state.mirrorRightFender) {
      state.rightFenderX = -state.leftFenderX
      state.rightFenderY = state.leftFenderY
      state.rightFenderZ = state.leftFenderZ
    }
    if (state.mirrorRightWheel) {
      state.rightWheelX = -state.leftWheelX
      state.rightWheelY = state.leftWheelY
      state.rightWheelZ = state.leftWheelZ
    }

    robot.pivot.position.set(state.bodyX * 0.001, state.bodyY * 0.001, state.bodyZ * 0.001)

    robot.leftFender.position.set(state.leftFenderX, state.leftFenderY, state.leftFenderZ)
    robot.rightFender.position.set(state.rightFenderX, state.rightFenderY, state.rightFenderZ)

    robot.leftWheel.position.set(
      state.leftWheelX * 0.001,
      state.leftWheelY * 0.001,
      state.leftWheelZ * 0.001,
    )
    robot.rightWheel.position.set(
      state.rightWheelX * 0.001,
      state.rightWheelY * 0.001,
      state.rightWheelZ * 0.001,
    )

    robot.leftWheel.scale.setScalar(state.wheelScale)
    robot.rightWheel.scale.setScalar(state.wheelScale)

    rightFenderControllers.forEach((c) => c.updateDisplay())
    rightWheelControllers.forEach((c) => c.updateDisplay())
    rightFenderControllers.forEach((c) => c.disable(state.mirrorRightFender))
    rightWheelControllers.forEach((c) => c.disable(state.mirrorRightWheel))
  }

  const dump = () => {
    const fmt = (n: number, digits = 2) => n.toFixed(digits)
    const lf = `[${fmt(state.leftFenderX)}, ${fmt(state.leftFenderY)}, ${fmt(state.leftFenderZ)}]`
    const rf = `[${fmt(state.rightFenderX)}, ${fmt(state.rightFenderY)}, ${fmt(state.rightFenderZ)}]`
    const bx = (state.bodyX * 0.001).toFixed(4)
    const by = (state.bodyY * 0.001).toFixed(4)
    const bz = (state.bodyZ * 0.001).toFixed(4)
    const lwm = (state.leftWheelX * 0.001).toFixed(4)
    const lwm2 = (state.leftWheelY * 0.001).toFixed(4)
    const lwm3 = (state.leftWheelZ * 0.001).toFixed(4)
    const rwm = (state.rightWheelX * 0.001).toFixed(4)
    const rwm2 = (state.rightWheelY * 0.001).toFixed(4)
    const rwm3 = (state.rightWheelZ * 0.001).toFixed(4)
    const ws = state.wheelScale.toFixed(4)

    const block =
      `// === sim-v2 tuner dump ===\n` +
      `// Paste fender values into PART_DEFAULTS in src/robot/v2.ts (CAD-mm pre-flip):\n` +
      `  left_fender:  { pos: ${lf} },\n` +
      `  right_fender: { pos: ${rf} },\n` +
      `\n` +
      `// Paste body position in v2.ts after pivot.updateMatrixWorld\n` +
      `// (root-local meters, Y-up world frame):\n` +
      `  pivot.position.set(${bx}, ${by}, ${bz})\n` +
      `\n` +
      `// Paste wheel positions into v2.ts where wheel.position is set\n` +
      `// (root-local meters, Y-up world frame):\n` +
      `  leftWheel.group.position.set(${lwm}, ${lwm2}, ${lwm3})\n` +
      `  rightWheel.group.position.set(${rwm}, ${rwm2}, ${rwm3})\n` +
      `\n` +
      `// Paste wheel scale (uniform multiplier on the group scale):\n` +
      `  leftWheel.group.scale.setScalar(${ws})\n` +
      `  rightWheel.group.scale.setScalar(${ws})\n`

    console.log(block)
    // Also try clipboard for convenience.
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(block).then(
        () => console.log('[tuner] dump copied to clipboard'),
        () => {/* clipboard may be denied; log only */ },
      )
    }
  }

  const reset = () => {
    state.bodyX = d.bodyM[0] * 1000
    state.bodyY = d.bodyM[1] * 1000
    state.bodyZ = d.bodyM[2] * 1000
    state.leftFenderX = d.leftFenderMm[0]
    state.leftFenderY = d.leftFenderMm[1]
    state.leftFenderZ = d.leftFenderMm[2]
    state.rightFenderX = d.rightFenderMm[0]
    state.rightFenderY = d.rightFenderMm[1]
    state.rightFenderZ = d.rightFenderMm[2]
    state.leftWheelX = d.leftWheelM[0] * 1000
    state.leftWheelY = d.leftWheelM[1] * 1000
    state.leftWheelZ = d.leftWheelM[2] * 1000
    state.rightWheelX = d.rightWheelM[0] * 1000
    state.rightWheelY = d.rightWheelM[1] * 1000
    state.rightWheelZ = d.rightWheelM[2] * 1000
    state.wheelScale = d.wheelScale
    apply()
    allControllers.forEach((c) => c.updateDisplay())
  }

  // Create a folder under the provided parent GUI
  const gui = parentGui.addFolder('v2 Visual Tuner')

  const onChange = () => apply()

  const allControllers: ReturnType<GUI['add']>[] = []
  const rightFenderControllers: ReturnType<GUI['add']>[] = []
  const rightWheelControllers: ReturnType<GUI['add']>[] = []

  const bodyFolder = gui.addFolder('Body (world-mm, Y-up)')
  allControllers.push(bodyFolder.add(state, 'bodyX', -200, 200, 0.5).name('x').onChange(onChange))
  allControllers.push(bodyFolder.add(state, 'bodyY', -100, 200, 0.5).name('y').onChange(onChange))
  allControllers.push(bodyFolder.add(state, 'bodyZ', -200, 200, 0.5).name('z').onChange(onChange))
  bodyFolder.close()

  const fenderFolder = gui.addFolder('Fenders (CAD-mm, pre-flip)')
  const lf = fenderFolder.addFolder('Left fender')
  allControllers.push(lf.add(state, 'leftFenderX', -100, 100, 0.5).name('x').onChange(onChange))
  allControllers.push(lf.add(state, 'leftFenderY', -100, 100, 0.5).name('y').onChange(onChange))
  allControllers.push(lf.add(state, 'leftFenderZ', -50, 100, 0.5).name('z').onChange(onChange))

  const rf = fenderFolder.addFolder('Right fender')
  allControllers.push(
    rf
      .add(state, 'mirrorRightFender')
      .name('mirror from left')
      .onChange(onChange),
  )
  rightFenderControllers.push(rf.add(state, 'rightFenderX', -100, 100, 0.5).name('x').onChange(onChange))
  rightFenderControllers.push(rf.add(state, 'rightFenderY', -100, 100, 0.5).name('y').onChange(onChange))
  rightFenderControllers.push(rf.add(state, 'rightFenderZ', -50, 100, 0.5).name('z').onChange(onChange))
  fenderFolder.close()
  allControllers.push(...rightFenderControllers)

  const wheelFolder = gui.addFolder('Wheels (world-mm, Y-up)')
  const lw = wheelFolder.addFolder('Left wheel')
  allControllers.push(lw.add(state, 'leftWheelX', -200, 200, 0.5).name('x').onChange(onChange))
  allControllers.push(lw.add(state, 'leftWheelY', -50, 100, 0.5).name('y').onChange(onChange))
  allControllers.push(lw.add(state, 'leftWheelZ', -200, 200, 0.5).name('z').onChange(onChange))
  wheelFolder.close()

  const rw = wheelFolder.addFolder('Right wheel')
  allControllers.push(
    rw.add(state, 'mirrorRightWheel').name('mirror from left').onChange(onChange),
  )
  rightWheelControllers.push(rw.add(state, 'rightWheelX', -200, 200, 0.5).name('x').onChange(onChange))
  rightWheelControllers.push(rw.add(state, 'rightWheelY', -50, 100, 0.5).name('y').onChange(onChange))
  rightWheelControllers.push(rw.add(state, 'rightWheelZ', -200, 200, 0.5).name('z').onChange(onChange))
  allControllers.push(...rightWheelControllers)

  allControllers.push(
    wheelFolder.add(state, 'wheelScale', 0.25, 3.0, 0.01).name('scale (both)').onChange(onChange),
  )

  const actions = gui.addFolder('Actions')


  actions.add({ dump }, 'dump').name('Dump values (console + clipboard)')
  actions.add({ reset }, 'reset').name('Reset to defaults')

  gui.close()

  // Initial apply (also disables mirrored controllers).
  apply()

  return {
    mainFolder: gui,
    dispose() {
      // Remove the folder DOM element from the parent (best-effort)
      try {
        const el = (gui as any).domElement as HTMLElement | undefined
        if (el && el.parentElement) el.parentElement.removeChild(el)
      } catch (e) {
        // ignore
      }
    },
  }
}
