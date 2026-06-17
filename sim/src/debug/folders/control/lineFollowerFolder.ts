import GUI from 'lil-gui'
import type { SimControlInterface } from '../../../engine/types'
import { DEFAULT_LINE_FOLLOWER_CONFIG } from '../../../control/lineFollower'

export function buildLineFollowerFolder(parentGui: GUI, ctrl: SimControlInterface) {
  const folder = parentGui.addFolder('Line Follower')
  const cfg = ctrl.lineFollowerConfig

  const fwd = folder.add(cfg, 'forward', 0, 1, 0.01).name('Forward speed')
  const slow = folder.add(cfg, 'slow', 0, 1, 0.01).name('Veer inner speed')
  const spin = folder.add(cfg, 'spin', 0, 1, 0.01).name('Spin-search speed')
  const grace = folder.add(cfg, 'graceSec', 0, 5, 0.05).name('Lost grace (s)')
  const acquire = folder.add(cfg, 'acquireSec', 0, 10, 0.1).name('Acquire timeout (s)')

  folder.add({
    resetDefaults: () => {
      cfg.forward = DEFAULT_LINE_FOLLOWER_CONFIG.forward
      cfg.slow = DEFAULT_LINE_FOLLOWER_CONFIG.slow
      cfg.spin = DEFAULT_LINE_FOLLOWER_CONFIG.spin
      cfg.graceSec = DEFAULT_LINE_FOLLOWER_CONFIG.graceSec
      cfg.acquireSec = DEFAULT_LINE_FOLLOWER_CONFIG.acquireSec
      fwd.updateDisplay()
      slow.updateDisplay()
      spin.updateDisplay()
      grace.updateDisplay()
      acquire.updateDisplay()
    },
  }, 'resetDefaults').name('Reset to defaults')

  folder.close()
}
