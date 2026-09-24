import { createDemoEditorStage } from './serialize';
import { blockingValidationResults, validateStageBuilderStage } from './stageBuilderValidation';

declare const describe: any;
declare const expect: any;
declare const it: any;

describe('stage builder required objects', () => {
  it('allows a stage with only a visible robot spawn', () => {
    const stage = createDemoEditorStage();
    stage.objects = stage.objects.filter((object) => object.kind === 'fossbot');

    expect(blockingValidationResults(validateStageBuilderStage(stage))).toEqual([]);
  });

  it('requires a visible robot spawn even when a target exists', () => {
    const stage = createDemoEditorStage();
    stage.objects = stage.objects.filter((object) => object.semanticKind === 'target');

    expect(blockingValidationResults(validateStageBuilderStage(stage)).map((item) => item.id)).toContain('stage:spawn-missing');
  });

  it('does not report speculative reachability warnings for targets or checkpoints', () => {
    const stage = createDemoEditorStage();
    const target = stage.objects.find((object) => object.semanticKind === 'target');
    if (!target) throw new Error('demo target missing');
    stage.objects.push({ ...target, id: 'checkpoint', name: 'checkpoint', semanticKind: 'checkpoint' });

    expect(validateStageBuilderStage(stage).map((item) => item.id)).not.toContainEqual(expect.stringContaining('reachability-unverified'));
  });
});
