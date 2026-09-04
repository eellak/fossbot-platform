import type { BenchmarkHost, BenchmarkHostBindings, BenchmarkMode } from './types'

export function createBenchmarkHost(bindings: BenchmarkHostBindings): BenchmarkHost {
  return {
    onFrame: bindings.onFrame,
    swapStage: bindings.swapStage,
    resetRobot: bindings.resetRobot,
    setDriveOverride: bindings.setDriveOverride,
    setLineFollowerOverride: bindings.setLineFollowerOverride,
    clearDriveOverride: bindings.clearDriveOverride,
    getStageCounts: bindings.getStageCounts,
    setCameraMode: bindings.setCameraMode,
    getCameraMode: bindings.getCameraMode,
    setPaused: bindings.setPaused,
    isPaused: bindings.isPaused,
    setTimeScale: bindings.setTimeScale,
    getTimeScale: bindings.getTimeScale,
    snapshotOverlayState: bindings.snapshotOverlayState,
    applyOverlayMode: (mode: BenchmarkMode) => bindings.applyOverlayMode(mode),
    restoreOverlayState: bindings.restoreOverlayState,
  }
}
