import React, { useEffect, useState } from 'react';
import { Alert, Box, Button, Checkbox, Divider, FormControlLabel, FormGroup, Paper, Stack, Switch, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useAuth } from 'src/authentication/AuthProvider';
import { getAdminGuestSettings, updateAdminGuestSettings } from 'src/authentication/AuthApi';
import { GUEST_VIEW_ORDER } from 'src/authentication/guest';
import type { GuestAdminSettings, GuestView } from 'src/authentication/AuthInterfaces';
import { readAIProviders } from 'src/ai/AssistantApi';
import type { AIProviderConfig } from 'src/ai/types';
import { useNotifications } from 'src/components/notifications/NotificationProvider';

const VIEW_GROUPS: { label: string; views: GuestView[] }[] = [
    { label: 'groups_editors', views: ['python', 'blockly'] },
    { label: 'groups_learning', views: ['courses', 'classrooms'] },
    { label: 'groups_stages', views: ['stages', 'stage_builder'] },
    { label: 'groups_tools', views: ['dashboard', 'interactive', 'rc'] },
];

const emptySettings: GuestAdminSettings = { beta_tester: false, allowed_views: [], ai_enabled: false, ai_provider_ids: [] };

export default function GuestAccessSettingsCard({ onDirtyChange }: { onDirtyChange?: (dirty: boolean) => void } = {}) {
    const { t } = useTranslation();
    const { token, user } = useAuth();
    const { notify } = useNotifications();
    const [settings, setSettings] = useState<GuestAdminSettings>(emptySettings);
    const [savedSettings, setSavedSettings] = useState<GuestAdminSettings>(emptySettings);
    const [providers, setProviders] = useState<AIProviderConfig[]>([]);
    const [loading, setLoading] = useState(true);
    const [loaded, setLoaded] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const isAdmin = user?.role === 'admin';
    const enabled = settings.allowed_views.length;
    const normalized = (value: GuestAdminSettings) => ({
        beta_tester: value.beta_tester,
        allowed_views: [...value.allowed_views].sort(),
        ai_enabled: value.ai_enabled,
        ai_provider_ids: [...value.ai_provider_ids].sort((left, right) => left - right),
    });
    const dirty = JSON.stringify(normalized(settings)) !== JSON.stringify(normalized(savedSettings));

    useEffect(() => { onDirtyChange?.(dirty); }, [dirty, onDirtyChange]);

    const load = async () => {
        if (!token || !isAdmin) { setLoading(false); return; }
        setLoading(true); setError('');
        try {
            const [response, aiProviders] = await Promise.all([getAdminGuestSettings(token), readAIProviders(token).catch(() => [])]);
            const data = await response.json();
            if (!response.ok) throw new Error(data.detail || 'Could not load guest access settings.');
            setSettings(data);
            setSavedSettings(data);
            // Only hosted providers can serve a guest request; browser runtimes run in the guest's own browser.
            setProviders(aiProviders.filter((provider) => provider.runtime === 'hosted'));
            setLoaded(true);
        } catch (reason) {
            setError(reason instanceof Error ? reason.message : 'Could not load guest access settings.');
        } finally { setLoading(false); }
    };

    useEffect(() => { void load(); }, [isAdmin, token]);

    useEffect(() => {
        if (!dirty) return;
        const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
        window.addEventListener('beforeunload', warn);
        return () => window.removeEventListener('beforeunload', warn);
    }, [dirty]);

    const setViews = (views: GuestView[]) => setSettings((current) => ({ ...current, allowed_views: views }));

    const toggleView = (view: GuestView, checked: boolean) => setViews(
        checked
            ? GUEST_VIEW_ORDER.filter((item) => item === view || settings.allowed_views.includes(item))
            : settings.allowed_views.filter((item) => item !== view),
    );

    const toggleProvider = (providerId: number, checked: boolean) => setSettings((current) => ({
        ...current,
        ai_provider_ids: checked
            ? [...current.ai_provider_ids, providerId].sort((left, right) => left - right)
            : current.ai_provider_ids.filter((id) => id !== providerId),
    }));

    const save = async () => {
        if (!token) return;
        setSaving(true); setError('');
        try {
            const response = await updateAdminGuestSettings(token, settings);
            const data = await response.json();
            if (!response.ok) throw new Error(data.detail || 'Could not save guest access settings.');
            setSettings(data);
            setSavedSettings(data);
            notify(t('admin-panel.guest.saved'), { severity: 'success' });
        } catch (reason) {
            setError(reason instanceof Error ? reason.message : 'Could not save guest access settings.');
        } finally { setSaving(false); }
    };

    if (!isAdmin) return null;

    return (
        <Stack spacing={2}>
            {error && <Alert severity="error" action={<Button color="inherit" size="small" onClick={() => void load()}>{t('admin-panel.guest.retry')}</Button>}>{error}</Alert>}
            {loading ? <Typography color="text.secondary">{t('admin-panel.guest.loading')}</Typography> : loaded ? (
                <>
                    <Stack spacing={2}>
                        <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
                            <Typography variant="body2" color="text.secondary" aria-live="polite">
                                {t('admin-panel.guest.selectedCount', { enabled, total: GUEST_VIEW_ORDER.length })}
                            </Typography>
                            <Button size="small" onClick={() => setViews([...GUEST_VIEW_ORDER])} disabled={saving || enabled === GUEST_VIEW_ORDER.length}>{t('admin-panel.guest.all')}</Button>
                            <Button size="small" onClick={() => setViews([])} disabled={saving || !enabled}>{t('admin-panel.guest.none')}</Button>
                        </Box>
                        <Paper variant="outlined" sx={{ overflow: 'hidden' }}>
                            <Typography component="h2" sx={{ bgcolor: 'background.default', color: 'text.secondary', fontWeight: 700, fontSize: '1rem', px: 2, py: 1.5 }}>
                                {t('admin-panel.guest.views')}
                            </Typography>
                            <Divider />
                            <Stack divider={<Divider />}>
                                {VIEW_GROUPS.map((group) => (
                                    <Box key={group.label} sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '160px minmax(0, 1fr)' }, gap: { xs: 0.5, md: 2 }, px: 2, py: 1.5 }}>
                                        <Typography variant="body2" component="h3" color="text.secondary" fontWeight={600} sx={{ pt: { md: 1 } }}>
                                            {t(`admin-panel.guest.${group.label}`)}
                                        </Typography>
                                        <FormGroup sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', lg: 'repeat(4, minmax(0, 1fr))' }, columnGap: 2 }}>
                                            {group.views.map((view) => (
                                                <FormControlLabel
                                                    key={view}
                                                    control={<Checkbox size="small" checked={settings.allowed_views.includes(view)} disabled={saving} onChange={(event) => toggleView(view, event.target.checked)} />}
                                                    label={<Typography variant="body2">{t(`admin-panel.guest.views_${view}`)}</Typography>}
                                                />
                                            ))}
                                        </FormGroup>
                                    </Box>
                                ))}
                            </Stack>
                        </Paper>
                        {!enabled && <Alert severity="info">{t('admin-panel.guest.empty')}</Alert>}
                    </Stack>
                    <Paper variant="outlined" sx={{ overflow: 'hidden' }}>
                        <Typography component="h2" sx={{ bgcolor: 'background.default', color: 'text.secondary', fontWeight: 700, fontSize: '1rem', px: 2, py: 1.5 }}>
                            {t('admin-panel.guest.aiSection')}
                        </Typography>
                        <Divider />
                        <Box sx={{ px: 2, py: 1.5 }}>
                            <FormControlLabel
                                control={<Switch checked={settings.ai_enabled} disabled={saving} onChange={(event) => setSettings((current) => ({ ...current, ai_enabled: event.target.checked }))} />}
                                label={<Typography variant="body2">{t('admin-panel.guest.ai')}</Typography>}
                            />
                            <Typography variant="body2" color="text.secondary">{t('admin-panel.guest.aiHelp')}</Typography>
                            {settings.ai_enabled && (providers.length ? (
                                <FormGroup sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' }, columnGap: 2, mt: 1 }}>
                                    {providers.map((provider) => (
                                        <FormControlLabel
                                            key={provider.id}
                                            control={<Checkbox size="small" checked={settings.ai_provider_ids.includes(provider.id)} disabled={saving} onChange={(event) => toggleProvider(provider.id, event.target.checked)} />}
                                            label={(
                                                <Box sx={{ minWidth: 0 }}>
                                                    <Typography variant="body2">{provider.name}</Typography>
                                                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', overflowWrap: 'anywhere' }}>
                                                        {provider.model} · {provider.enabled ? t('aiAdmin.providers.available') : t('aiAdmin.providers.unavailable')}
                                                    </Typography>
                                                </Box>
                                            )}
                                        />
                                    ))}
                                </FormGroup>
                            ) : <Alert severity="info" sx={{ mt: 1.5 }}>{t('admin-panel.guest.aiNoProviders')}</Alert>)}
                        </Box>
                    </Paper>
                    <Paper variant="outlined" sx={{ overflow: 'hidden' }}>
                        <Typography component="h2" sx={{ bgcolor: 'background.default', color: 'text.secondary', fontWeight: 700, fontSize: '1rem', px: 2, py: 1.5 }}>
                            {t('admin-panel.guest.betaSection')}
                        </Typography>
                        <Divider />
                        <Box sx={{ px: 2, py: 1.5 }}>
                            <FormControlLabel
                                control={<Switch checked={settings.beta_tester} disabled={saving} onChange={(event) => setSettings((current) => ({ ...current, beta_tester: event.target.checked }))} />}
                                label={<Typography variant="body2">{t('admin-panel.guest.beta')}</Typography>}
                            />
                        </Box>
                    </Paper>
                    <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1.5 }}>
                        <Button variant="contained" onClick={() => void save()} disabled={saving || !dirty}>
                            {saving ? t('admin-panel.guest.saving') : t('admin-panel.guest.save')}
                        </Button>
                        {dirty && <Typography variant="body2" color="text.secondary">{t('admin-panel.guest.unsaved')}</Typography>}
                    </Box>
                </>
            ) : null}
        </Stack>
    );
}
