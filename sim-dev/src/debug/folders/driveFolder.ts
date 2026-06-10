import GUI from 'lil-gui'
import type { RuntimeControls } from '../types'

export function buildDriveFolder(parentGui: GUI, controls: RuntimeControls) {
  const folder = parentGui.addFolder('Drive')
  const controller = folder.add(controls.drive, 'turnScale', 0, 1, 0.01).name('Turn scale')
  folder.add({
    resetDefaults: () => {
      controls.drive.turnScale = 0.35
      controller.updateDisplay()
    }
  }, 'resetDefaults').name('Reset to defaults')
  folder.close()
}
