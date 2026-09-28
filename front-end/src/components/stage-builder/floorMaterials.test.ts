import { builtInStageBuilderPrefabs } from './stageBuilderPrefabs';
import { configToEditorStage, createDemoEditorStage, editorStageToConfig } from './serialize';
import { blockingValidationResults, validateStageBuilderStage } from './stageBuilderValidation';
import type { EditorCubeObject, StageCubeEntry } from './types';
import { surfaceDetails } from 'src/simulator/stages/surfaceDetails';
import floorMaterialsStage from 'src/simulator/stages/data/stage_floor_materials.json';

declare const test: any;
declare const expect: any;

test('floor material prefabs remain labeled and drivable after stage export and import', () => {
  const prefabs = builtInStageBuilderPrefabs().filter((item) => item.id.startsWith('builtin_floor_'));
  expect(prefabs.map((item) => item.title)).toEqual(['Smooth tile', 'Carpet', 'Rough mat', 'Dirt and small rocks']);

  for (const [code, prefab] of prefabs.entries()) {
    const patch = prefab.objects.find((object): object is EditorCubeObject => object.kind === 'cube' && object.floorMaterialCode === code);
    expect(patch).toBeDefined();
    expect(patch?.position[1]).toBeGreaterThan(0);
    expect(prefab.objects).toHaveLength(1);

    const stage = createDemoEditorStage();
    stage.objects = [stage.objects.find((object) => object.kind === 'fossbot')!, ...prefab.objects.map((object) => ({ ...object, prefabSourceId: prefab.id }))];
    const config = editorStageToConfig(stage);
    const exportedPatch = config.find((entry): entry is StageCubeEntry => entry.type === 'cube' && entry.floorMaterialCode === code);
    expect(exportedPatch?.surfaceTraction).toBe(patch?.surfaceTraction);
    expect(exportedPatch?.collision).toBe('none');
    expect(surfaceDetails(exportedPatch!)).toHaveLength([0, 10, 8, 396][code]);
    expect(blockingValidationResults(validateStageBuilderStage(stage))).toEqual([]);

    const imported = configToEditorStage({ id: stage.id, title: stage.title, config, createdAt: stage.createdAt, updatedAt: stage.updatedAt } as any);
    expect(imported.objects.some((object) => object.kind === 'cube' && object.floorMaterialCode === code)).toBe(true);
    expect(blockingValidationResults(validateStageBuilderStage(imported))).toEqual([]);
  }
});

test('the demo floor has flush patches and low, climbable details', () => {
  const patches = (floorMaterialsStage.filter((entry) => 'floorMaterialCode' in entry) as unknown as StageCubeEntry[])
    .sort((a, b) => b.position[2] - a.position[2]);
  expect(patches).toHaveLength(4);
  for (const [index, patch] of patches.entries()) {
    expect(patch.dimensions[1]).toBeLessThanOrEqual(0.001);
    expect(patch.position[1]).toBe(patch.dimensions[1] / 2);
    expect(patch.collision).toBe('none');
    if (index > 0) expect(patches[index - 1].position[2] - patch.position[2]).toBeCloseTo(patch.dimensions[2], 6);
    const details = surfaceDetails(patch);
    for (const detail of details) {
      const dimensions = detail.dimensions as number[];
      const top = (detail.position as number[])[1] + (detail.type === 'sphere' ? dimensions[0] / 2 : dimensions[1] / 2);
      expect(top).toBeLessThanOrEqual(detail.type === 'sphere' ? 0.0041 : 0.003);
    }
  }
});

test('dirt rocks are reproducibly scattered rather than aligned in rows', () => {
  const patch = (floorMaterialsStage as StageCubeEntry[]).find((entry) => entry.floorMaterialCode === 3)!;
  const rocks = surfaceDetails(patch);
  expect(rocks).toHaveLength(396);
  expect(surfaceDetails(patch)).toEqual(rocks);
  const positions = rocks.map((rock) => rock.position as number[]);
  expect(new Set(positions.map((position) => position[0].toFixed(3))).size).toBeGreaterThan(300);
  expect(new Set(positions.map((position) => position[2].toFixed(3))).size).toBeGreaterThan(300);
  let closest = Infinity;
  for (let index = 0; index < positions.length; index++) {
    for (let other = index + 1; other < positions.length; other++) {
      closest = Math.min(closest, Math.hypot(positions[index][0] - positions[other][0], positions[index][2] - positions[other][2]));
    }
  }
  expect(closest).toBeGreaterThanOrEqual(0.024);
});
