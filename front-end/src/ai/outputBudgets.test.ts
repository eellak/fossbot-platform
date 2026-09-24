import { outputTokenBudget } from './outputBudgets';

declare const describe: any;
declare const expect: any;
declare const it: any;

describe('outputTokenBudget', () => {
  it('reserves larger complete-JSON budgets for structured authoring', () => {
    expect(outputTokenBudget('code.explain')).toBe(4096);
    expect(outputTokenBudget('code.suggest_changes')).toBe(6144);
    expect(outputTokenBudget('lesson.suggest_changes')).toBe(6144);
    expect(outputTokenBudget('stage.create')).toBe(8192);
  });
});
