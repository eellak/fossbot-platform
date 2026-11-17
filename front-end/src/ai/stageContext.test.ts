import { buildStageAssistantContext } from './stageContext';
import { createDemoEditorStage } from 'src/components/stage-builder/serialize';
import { createCatalogObject } from 'src/components/stage-builder/stageBuilderCatalog';

declare const test: any, expect: any;
test('validation context includes curve intent and migration notices within the existing issue budget', () => {
  const stage = createDemoEditorStage();
  const line = createCatalogObject('line', 'new-line')!;
  stage.objects.push(line);
  const diagnostics = [{ code: 'legacy-upgraded', severity: 'notice' as const, message: 'Legacy paths remain sharp.' }];
  const context = buildStageAssistantContext(stage, 'validation', [], [], diagnostics);
  expect(context.stagePayload.objects.find(object => object.id === 'new-line')).toMatchObject({ curveVersion: 1, corners: [null, { mode: 'rounded', sizing: 'auto' }, null] });
  expect(context.validation).toContainEqual(expect.objectContaining({ id: 'migration:legacy-upgraded', severity: 'info' }));
  expect(buildStageAssistantContext(stage, 'stage', [], [], diagnostics).validation).toEqual([]);
  expect(buildStageAssistantContext(stage, 'validation', [], [], Array(100).fill(diagnostics[0])).validation).toHaveLength(64);
});
