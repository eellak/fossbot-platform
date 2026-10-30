import type { GuestSettings } from 'src/authentication/AuthInterfaces';

/** Buddy is only mounted for a guest when an administrator enabled guest AI access. */
export function guestAssistantEnabled(isGuest: boolean, guestSettings?: GuestSettings | null): boolean {
  return Boolean(guestSettings?.ai_enabled) || !isGuest;
}

export function assistantMayFetchAccess(isGuest: boolean, guestSettings?: GuestSettings | null): boolean {
  return isGuest ? Boolean(guestSettings?.ai_enabled) : true;
}
