export type RequestMode = 'explain' | 'suggest';
export type BuddyView = 'ask' | 'working' | 'conversation' | 'answer' | 'review' | 'failed' | 'applied';

// One place that decides what the panel shows. Chat surfaces keep the conversation mounted
// across follow-up requests and failures; proposal surfaces keep the stepwise lifecycle.
export function resolveBuddyView(state: {
  busy: boolean;
  compose: boolean;
  preview: boolean;
  status: 'idle' | 'streaming' | 'done' | 'stopped' | 'error';
  applied: boolean;
  output: boolean;
  chatConversation: boolean;
}): BuddyView {
  if (state.busy) return state.chatConversation ? 'conversation' : 'working';
  if (state.compose) return 'ask';
  if (state.preview) return 'review';
  if (state.status === 'error') return state.chatConversation ? 'conversation' : 'failed';
  if (state.applied) return 'applied';
  if (state.output) return state.chatConversation ? 'conversation' : 'answer';
  return state.chatConversation ? 'conversation' : 'ask';
}
