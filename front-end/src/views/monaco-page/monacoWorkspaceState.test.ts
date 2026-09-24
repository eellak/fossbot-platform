import { isExistingProject, isRobotProgramActive } from './monacoWorkspaceState';

declare const describe: any;
declare const expect: any;
declare const it: any;

describe('Monaco workspace state', () => {
  it('tracks only active physical robot program states as running', () => {
    expect(isRobotProgramActive('accepted')).toBe(true);
    expect(isRobotProgramActive('running')).toBe(true);
    expect(isRobotProgramActive('completed')).toBe(false);
    expect(isRobotProgramActive('failed')).toBe(false);
  });

  it('routes unsaved projects through project creation', () => {
    expect(isExistingProject(undefined)).toBe(false);
    expect(isExistingProject('')).toBe(false);
    expect(isExistingProject('42')).toBe(true);
  });
});
