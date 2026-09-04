import { act } from 'react-dom/test-utils';
import { createRoot, type Root } from 'react-dom/client';
import type { SuggestionPreview } from 'src/ai/suggestions/codeSuggestions';
import type { EditorStage } from 'src/components/stage-builder/types';
import StageSuggestionPreview from './StageSuggestionPreview';

declare const afterEach: any;
declare const beforeEach: any;
declare const describe: any;
declare const expect: any;
declare const it: any;
declare const jest: any;

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: unknown) => typeof fallback === 'string' ? fallback : key,
  }),
}));

const editorStage = { id: 'preview-stage' } as EditorStage;
const preview: SuggestionPreview = {
  suggestion: {
    version: '1',
    type: 'stage_operations',
    baseFingerprint: 'f'.repeat(64),
    rationale: 'Add a small building.',
    operations: [{ op: 'add_object', tempId: 'ai-wall', semanticKind: 'wall', position: [0, 0, 0] }],
    expectedValidation: 'The building remains within the floor bounds.',
    summary: 'Added a small building.',
  },
  summary: 'Added a small building.',
  kind: 'stage',
  before: '',
  after: '',
  detail: '',
  stage: {
    added: 1,
    changed: 0,
    removed: 0,
    resolvedIssues: [],
    newIssues: [],
    floor: [12, 12],
    objects: [{ id: 'ai-wall', kind: 'wall', position: [0, 0, 0] }],
    editorStage,
    verifiedChecks: ['validGeometry'],
  },
};

describe('StageSuggestionPreview', () => {
  let container: HTMLDivElement;
  let root: Root | null;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    if (root) act(() => root?.unmount());
    container.remove();
  });

  it('keeps live preview enabled when its callback changes after a parent rerender', () => {
    const firstCallback = jest.fn();
    const secondCallback = jest.fn();

    act(() => root?.render(<StageSuggestionPreview preview={preview} onPreviewLiveToggle={firstCallback} />));
    const toggle = container.querySelector<HTMLInputElement>('input[type="checkbox"]');
    expect(toggle).not.toBeNull();

    act(() => toggle?.click());
    expect(firstCallback).toHaveBeenLastCalledWith(editorStage);
    expect(toggle?.checked).toBe(true);

    act(() => root?.render(<StageSuggestionPreview preview={preview} onPreviewLiveToggle={secondCallback} />));
    expect(firstCallback).not.toHaveBeenCalledWith(null);
    expect(toggle?.checked).toBe(true);

    act(() => root?.unmount());
    root = null;
    expect(secondCallback).toHaveBeenLastCalledWith(null);
  });

  it('labels the model expectation separately from verified checks', () => {
    act(() => root?.render(<StageSuggestionPreview preview={preview} />));
    expect(container.querySelector('[role="img"]')).toBeNull();
    expect(container.textContent).toContain("aiAssistant.stage.modelExpectation");
    expect(container.textContent).toContain('The building remains within the floor bounds.');
    expect(container.textContent).toContain('aiAssistant.stage.verified.validGeometry');
  });
});
