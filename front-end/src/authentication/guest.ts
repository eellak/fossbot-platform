import type { GuestSettings, GuestView } from './AuthInterfaces';

export const GUEST_TOKEN_STORAGE_KEY = 'fossbot-guest-session';

export const GUEST_VIEW_PATHS: Record<GuestView, string> = {
    dashboard: '/dashboard',
    python: '/monaco-page',
    blockly: '/blockly-page',
    interactive: '/interactive-page',
    rc: '/rc-page',
    courses: '/courses',
    classrooms: '/classrooms',
    stages: '/stages',
    stage_builder: '/stage-builder',
};

export const GUEST_VIEW_ORDER: GuestView[] = [
    'dashboard', 'python', 'blockly', 'interactive', 'rc', 'courses', 'classrooms', 'stages', 'stage_builder',
];

export function guestLandingPath(settings?: GuestSettings | null): string {
    const view = GUEST_VIEW_ORDER.find((item) => settings?.allowed_views.includes(item));
    return view ? GUEST_VIEW_PATHS[view] : '/guest-unavailable';
}

export function guestCanView(settings: GuestSettings | null | undefined, view: GuestView): boolean {
    return Boolean(settings?.allowed_views.includes(view));
}
