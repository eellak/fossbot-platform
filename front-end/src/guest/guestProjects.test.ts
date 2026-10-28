import { GuestStorageError, guestProjectRepository } from './guestProjects';

declare const beforeEach: any;
declare const describe: any;
declare const expect: any;
declare const it: any;
declare const jest: any;

const project = {
  name: 'Guest bot', description: 'Local only', project_type: 'python', code: 'print("hi")',
  stageReference: { sourceType: 'default' as const, title: 'Stage', url: '/stage.json' },
};

describe('guest project repository', () => {
  beforeEach(() => localStorage.clear());

  it('persists projects and drafts locally across reads', () => {
    const created = guestProjectRepository.create(project);
    expect(created.id).toBeGreaterThan(0);
    expect(guestProjectRepository.list()).toEqual([created]);
    expect(guestProjectRepository.get(created.id)?.code).toBe('print("hi")');

    const updated = guestProjectRepository.update(created.id, { ...project, code: 'print("changed")' });
    expect(updated?.code).toBe('print("changed")');
    expect(guestProjectRepository.get(created.id)?.name).toBe('Guest bot');

    guestProjectRepository.saveDraft('blockly', { editorType: 'blockly', name: 'Draft', description: 'd', code: '<xml/>', stageReference: null });
    expect(guestProjectRepository.getDraft('blockly')?.code).toBe('<xml/>');
    guestProjectRepository.clearDraft('blockly');
    expect(guestProjectRepository.getDraft('blockly')).toBeUndefined();

    expect(guestProjectRepository.delete(created.id)).toBe(true);
    expect(guestProjectRepository.list()).toEqual([]);
  });

  it('reports corrupt storage instead of pretending success', () => {
    localStorage.setItem('fossbot.guest.projects.v1', '{not-json');
    expect(() => guestProjectRepository.list()).toThrow(GuestStorageError);
    try { guestProjectRepository.list(); } catch (error: any) { expect(error.code).toBe('corrupt'); }
  });

  it('reports quota failures', () => {
    const spy = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError');
    });
    try {
      expect(() => guestProjectRepository.create(project)).toThrow(GuestStorageError);
      try { guestProjectRepository.create(project); } catch (error: any) { expect(error.code).toBe('quota'); }
    } finally {
      spy.mockRestore();
    }
  });
});
