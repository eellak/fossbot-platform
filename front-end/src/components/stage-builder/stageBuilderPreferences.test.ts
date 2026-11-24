import { readStageBuilderPreferences, stageBuilderPreferencesKey, writeStageBuilderPreferences, defaultStageBuilderPreferences } from './stageBuilderPreferences';
import { getSnapSettings } from './stageBuilderSnapping';

declare const test: any, expect: any;
test('movement presets survive storage, including medium and off, independently of rotation', () => {
  for (const [preset, metres] of [['off', 0], ['precise', 0.01], ['fine', 0.1], ['medium', 0.5], ['coarse', 1]] as const) {
    writeStageBuilderPreferences({ ...defaultStageBuilderPreferences, snapPreset: preset, rotationSnapPreset: '45' }, 'snap-test');
    const prefs = readStageBuilderPreferences('snap-test');
    expect(prefs.snapPreset).toBe(preset);
    expect(prefs.rotationSnapPreset).toBe('45');
    expect(getSnapSettings(prefs.snapPreset).move).toBe(metres);
  }
  window.localStorage.setItem(stageBuilderPreferencesKey('snap-test'), JSON.stringify({ snapPreset: 'grid', rotationSnapPreset: 'off' }));
  expect(readStageBuilderPreferences('snap-test')).toMatchObject({ snapPreset: 'fine', rotationSnapPreset: 'off' });
  window.localStorage.removeItem(stageBuilderPreferencesKey('snap-test'));
});
