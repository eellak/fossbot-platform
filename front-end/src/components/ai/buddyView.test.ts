import { resolveBuddyView } from './buddyView';


declare const describe: any;
declare const expect: any;
declare const it: any;


const idle = {
  busy: false,
  compose: false,
  preview: false,
  status: 'idle' as const,
  applied: false,
  output: false,
  chatConversation: false,
};

describe('resolveBuddyView', () => {
  it('starts on the ask view', () => {
    expect(resolveBuddyView(idle)).toBe('ask');
  });

  it('uses the full working view for a first request', () => {
    expect(resolveBuddyView({ ...idle, busy: true, status: 'streaming' })).toBe('working');
  });

  it('keeps the conversation visible for a follow-up request', () => {
    expect(resolveBuddyView({ ...idle, busy: true, status: 'streaming', chatConversation: true })).toBe('conversation');
  });

  it('keeps the conversation visible after an answer on a chat surface', () => {
    expect(resolveBuddyView({ ...idle, status: 'done', output: true, chatConversation: true })).toBe('conversation');
  });

  it('keeps the one-shot answer view for proposal surfaces', () => {
    expect(resolveBuddyView({ ...idle, status: 'done', output: true })).toBe('answer');
  });

  it('keeps a failed follow-up inside the conversation', () => {
    expect(resolveBuddyView({ ...idle, status: 'error', chatConversation: true })).toBe('conversation');
  });

  it('shows the failed view when there is no conversation', () => {
    expect(resolveBuddyView({ ...idle, status: 'error' })).toBe('failed');
  });

  it('prefers review over the conversation', () => {
    expect(resolveBuddyView({ ...idle, preview: true, chatConversation: true })).toBe('review');
  });

  it('lets compose return to the ask view for proposal surfaces', () => {
    expect(resolveBuddyView({ ...idle, compose: true, output: true })).toBe('ask');
  });

  it('prefers the applied confirmation for proposal surfaces', () => {
    expect(resolveBuddyView({ ...idle, applied: true, output: true })).toBe('applied');
  });
});
