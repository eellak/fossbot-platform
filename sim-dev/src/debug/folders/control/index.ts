import GUI from 'lil-gui'
import type { SimControlInterface } from '../../../engine/types'
import { buildLineFollowerFolder } from './lineFollowerFolder'

export function buildControlFolder(parentGui: GUI, ctrl: SimControlInterface) {
  const folder = parentGui.addFolder('Control')
  buildLineFollowerFolder(folder as unknown as GUI, ctrl)
  folder.close()
}
