import GUI from 'lil-gui'
import type { SimControlInterface } from '../../engine/types'

export function buildDriveFolder(parentGui: GUI, ctrl: SimControlInterface) {
  const folder = parentGui.addFolder('Drive')
  const controller = folder.add(
    { get turnScale() { return ctrl.getTurnScale() }, set turnScale(v: number) { ctrl.setTurnScale(v) } },
    'turnScale', 0, 1, 0.01,
  ).name('Turn scale')
  folder.add({
    resetDefaults: () => {
      ctrl.setTurnScale(0.35)
      controller.updateDisplay()
    }
  }, 'resetDefaults').name('Reset to defaults')
  folder.close()
}
