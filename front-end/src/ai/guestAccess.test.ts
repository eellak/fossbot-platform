import { assistantMayFetchAccess, guestAssistantEnabled } from './guestAccess';

declare const describe: any;
declare const expect: any;
declare const it: any;

const guestSettings = (aiEnabled: boolean) => ({
  beta_tester: false,
  allowed_views: ['python' as const],
  ai_enabled: aiEnabled,
});

describe('guest Buddy gate', () => {
  it('keeps Buddy for signed-in users regardless of guest settings', () => {
    expect(guestAssistantEnabled(false, guestSettings(false))).toBe(true);
    expect(guestAssistantEnabled(false, undefined)).toBe(true);
  });

  it('hides Buddy from guests until an administrator enables it', () => {
    expect(guestAssistantEnabled(true, guestSettings(false))).toBe(false);
    expect(guestAssistantEnabled(true, undefined)).toBe(false);
    expect(guestAssistantEnabled(true, guestSettings(true))).toBe(true);
  });

  it('only fetches AI access for guests when guest access is enabled', () => {
    expect(assistantMayFetchAccess(true, guestSettings(false))).toBe(false);
    expect(assistantMayFetchAccess(true, guestSettings(true))).toBe(true);
    expect(assistantMayFetchAccess(false, guestSettings(false))).toBe(true);
  });
});
