import React, { useEffect, useState } from 'react';
import { Alert, Button, Checkbox, FormControlLabel, Paper, Stack, Switch, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useAuth } from 'src/authentication/AuthProvider';
import { getAdminGuestSettings, updateAdminGuestSettings } from 'src/authentication/AuthApi';
import type { GuestSettings, GuestView } from 'src/authentication/AuthInterfaces';
import { useNotifications } from 'src/components/notifications/NotificationProvider';

const VIEWS: GuestView[] = ['dashboard', 'python', 'blockly', 'interactive', 'rc', 'courses', 'classrooms', 'stages', 'stage_builder'];

const emptySettings: GuestSettings = { beta_tester: false, allowed_views: [] };

export default function GuestAccessSettingsCard() {
    const { t } = useTranslation();
    const { token, user } = useAuth();
    const { notify } = useNotifications();
    const [settings, setSettings] = useState<GuestSettings>(emptySettings);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [dirty, setDirty] = useState(false);
    const isAdmin = user?.role === 'admin';

    const load = async () => {
        if (!token || !isAdmin) { setLoading(false); return; }
        setLoading(true); setError('');
        try {
            const response = await getAdminGuestSettings(token);
            const data = await response.json();
            if (!response.ok) throw new Error(data.detail || 'Could not load guest access settings.');
            setSettings(data);
            setDirty(false);
        } catch (reason) {
            setError(reason instanceof Error ? reason.message : 'Could not load guest access settings.');
        } finally { setLoading(false); }
    };

    useEffect(() => { void load(); }, [isAdmin, token]);

    const toggleView = (view: GuestView, checked: boolean) => {
        setSettings((current) => ({
            ...current,
            allowed_views: checked
                ? VIEWS.filter((item) => item === view || current.allowed_views.includes(item))
                : current.allowed_views.filter((item) => item !== view),
        }));
        setDirty(true);
    };

    const save = async () => {
        if (!token) return;
        setSaving(true); setError('');
        try {
            const response = await updateAdminGuestSettings(token, settings);
            const data = await response.json();
            if (!response.ok) throw new Error(data.detail || 'Could not save guest access settings.');
            setSettings(data);
            setDirty(false);
            notify(t('admin-panel.guest.saved'), { severity: 'success' });
        } catch (reason) {
            setError(reason instanceof Error ? reason.message : 'Could not save guest access settings.');
        } finally { setSaving(false); }
    };

    if (!isAdmin) return null;

    return (
        <Paper variant="outlined" sx={{ p: 3 }}>
            <Stack spacing={2}>
                <Typography variant="h5">{t('admin-panel.guest.title')}</Typography>
                <Typography color="text.secondary">{t('admin-panel.guest.description')}</Typography>
                {error && <Alert severity="error" action={<Button color="inherit" size="small" onClick={() => void load()}>{t('admin-panel.guest.retry')}</Button>}>{error}</Alert>}
                {loading ? <Typography color="text.secondary">{t('admin-panel.guest.loading')}</Typography> : (
                    <>
                        <FormControlLabel
                            control={<Switch checked={settings.beta_tester} onChange={(event) => { setSettings((current) => ({ ...current, beta_tester: event.target.checked })); setDirty(true); }} />}
                            label={t('admin-panel.guest.beta')}
                        />
                        <Typography variant="body2" color="text.secondary">{t('admin-panel.guest.betaHelp')}</Typography>
                        <Typography variant="subtitle2" fontWeight={600}>{t('admin-panel.guest.views')}</Typography>
                        <Stack spacing={0.5}>
                            {VIEWS.map((view) => (
                                <FormControlLabel
                                    key={view}
                                    control={<Checkbox checked={settings.allowed_views.includes(view)} onChange={(event) => toggleView(view, event.target.checked)} />}
                                    label={t(`admin-panel.guest.views_${view}`)}
                                />
                            ))}
                        </Stack>
                        {!settings.allowed_views.length && <Alert severity="info">{t('admin-panel.guest.empty')}</Alert>}
                        <Button variant="contained" onClick={() => void save()} disabled={saving || !dirty} sx={{ alignSelf: 'flex-start' }}>
                            {saving ? t('admin-panel.guest.saving') : t('admin-panel.guest.save')}
                        </Button>
                    </>
                )}
            </Stack>
        </Paper>
    );
}
