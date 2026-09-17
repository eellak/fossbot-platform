import { createDemoEditorStage } from './serialize';
import { stageAssetIdentity, stageFingerprint } from './stageBuilderDrafts';

declare const describe: any;
declare const expect: any;
declare const it: any;

describe('stageFingerprint', () => {
  it('tracks STL source and transform changes without embedding asset bytes', () => {
    const stage = createDemoEditorStage();
    const model = { id: 'model', kind: 'model', semanticKind: 'customObject', filename: `data:model/stl;base64,${'A'.repeat(100_000)}`, position: [0, 0, 0], scale: 1 } as any;
    stage.objects = [model];
    const first = stageFingerprint(stage);
    expect(first.length).toBeLessThan(10_000);
    model.position = [1, 0, 0];
    expect(stageFingerprint(stage)).not.toBe(first);
    model.position = [0, 0, 0];
    expect(stageFingerprint(stage)).toBe(first);
    model.filename = `data:model/stl;base64,${'B'.repeat(100_000)}`;
    expect(stageFingerprint(stage)).not.toBe(first);
  });
});

describe('stageAssetIdentity', () => {
  it('is stable for equal payloads and distinct for different payloads', () => {
    const a = `data:model/stl;base64,${'A'.repeat(200_000)}`;
    const b = `data:model/stl;base64,${'B'.repeat(200_000)}`;
    expect(stageAssetIdentity(a)).toBe(stageAssetIdentity(a));
    expect(stageAssetIdentity(a)).not.toBe(stageAssetIdentity(b));
    // Same-length payloads that differ only near the end are still distinguished.
    const c = `${a.slice(0, -4)}CCCC`;
    expect(stageAssetIdentity(a)).not.toBe(stageAssetIdentity(c));
  });
});
