import { cp, mkdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(here, '../..')
const simRoot = resolve(repoRoot, 'sim')
const frontendRoot = resolve(repoRoot, 'front-end')

const sourceAssets = resolve(simRoot, 'public/js-simulator')
const targetAssets = resolve(frontendRoot, 'public/simulator')
const sourceImages = resolve(simRoot, 'public/images')
const targetImages = resolve(frontendRoot, 'public/simulator/images')

// The camera test stage is authored in src; publish it to both asset layouts.
const cameraStage = resolve(simRoot, 'src/stages/data/stage_camera_vision.json')
const cameraStageAsset = resolve(sourceAssets, 'stages/stage_camera_vision.json')
await mkdir(dirname(cameraStageAsset), { recursive: true })
await cp(cameraStage, cameraStageAsset)
const legacyStages = resolve(frontendRoot, 'public/js-simulator/stages')
await mkdir(legacyStages, { recursive: true })
await cp(cameraStage, resolve(legacyStages, 'stage_camera_vision.json'))
await cp(resolve(sourceAssets, 'stages/camera_vision.svg'), resolve(legacyStages, 'camera_vision.svg'))

// Public assets are merged, not deleted, so front-end-only additions under
// /public/simulator survive while source-of-truth assets are updated.
await mkdir(targetAssets, { recursive: true })
await cp(sourceAssets, targetAssets, { recursive: true, force: true })
await mkdir(targetImages, { recursive: true })
await cp(sourceImages, targetImages, { recursive: true, force: true })

console.log('Synced simulator assets:')
console.log(`  ${sourceAssets} -> ${targetAssets}`)
console.log(`  ${sourceImages} -> ${targetImages}`)
