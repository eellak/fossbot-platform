import * as THREE from 'three'

export type StageSkyboxEntry = {
  type: 'skybox'
  mode?: 'default' | 'color'
  color?: string | number
}

export function applyStageSkybox(scene: THREE.Scene, entry: StageSkyboxEntry): void {
  if (entry.mode === 'color' && entry.color) {
    scene.background = new THREE.Color(entry.color as THREE.ColorRepresentation)
  }
}
