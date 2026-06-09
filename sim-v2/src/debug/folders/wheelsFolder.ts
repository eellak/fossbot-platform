import GUI from 'lil-gui'
import { createDefaultVehicleSettings, type VehicleHandle } from '../../physics/vehicle'

export function buildWheelsFolder(parentGui: GUI, vehicle: VehicleHandle) {
  const folder = parentGui.addFolder('Wheels')
  const s = vehicle.settings
  const controllers: ReturnType<GUI['add']>[] = []

  controllers.push(folder.add(s, 'wheelRadius', 0.01, 0.08, 0.001).name('Wheel radius'))
  controllers.push(folder.add(s, 'motorForce', 0, 40, 0.1).name('Motor force'))
  controllers.push(folder.add(s, 'brakeStrength', 0, 50, 0.1).name('Brake strength'))
  controllers.push(folder.add(s, 'gripStrength', 0, 80, 0.1).name('Grip strength'))
  controllers.push(folder.add(s, 'suspensionStiffness', 0, 2000, 10).name('Suspension stiffness'))
  controllers.push(folder.add(s, 'suspensionDamping', 0, 150, 1).name('Suspension damping'))
  controllers.push(folder.add(s, 'suspensionRestLength', 0, 0.08, 0.001).name('Rest length'))
  controllers.push(folder.add(s, 'maxSuspensionForce', 0, 150, 1).name('Max suspension force'))
  controllers.push(folder.add(s, 'maxTireForce', 0, 200, 1).name('Max tire force'))
  controllers.push(folder.add(s, 'tireLoadFactor', 0, 5, 0.05).name('Tire load factor'))
  controllers.push(folder.add(s, 'slopeFactor', 0, 2, 0.05).name('Slope hold factor'))
  controllers.push(folder.add(s, 'freeSpinSpeed', 0, 30, 0.1).name('Free spin speed'))
  folder.add({
    resetDefaults: () => {
      Object.assign(s, createDefaultVehicleSettings(s.wheelRadius))
      controllers.forEach((c) => c.updateDisplay())
    }
  }, 'resetDefaults').name('Reset to defaults')
  folder.close()
}
