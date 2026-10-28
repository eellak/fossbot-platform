import React from 'react';
import { Box, Button, Paper, Stack, Typography } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from 'src/authentication/AuthProvider';
import { guestLandingPath } from 'src/authentication/guest';
import PageContainer from 'src/components/container/PageContainer';

export default function GuestUnavailable() {
    const { t } = useTranslation();
    const { isGuest, guestSettings, refreshGuestAction, logOutAction } = useAuth();
    const navigate = useNavigate();
    const landing = guestLandingPath(guestSettings);
    const hasViews = guestSettings.allowed_views.length > 0;

    return (
        <PageContainer title={t('guestUnavailable.title')} description={t('guestUnavailable.description')}>
            <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center', p: 3, bgcolor: 'background.default' }}>
                <Paper variant="outlined" sx={{ p: 4, maxWidth: 520, width: '100%' }}>
                    <Stack spacing={2}>
                        <Typography variant="h4" component="h1">{t('guestUnavailable.title')}</Typography>
                        <Typography color="text.secondary">{t('guestUnavailable.description')}</Typography>
                        {hasViews && (
                            <Button variant="contained" onClick={() => navigate(landing, { replace: true })}>
                                {t('guestUnavailable.continue')}
                            </Button>
                        )}
                        {isGuest && (
                            <Button variant="outlined" onClick={() => void refreshGuestAction().then((session) => {
                                if (session?.settings.allowed_views.length) navigate(guestLandingPath(session.settings), { replace: true });
                            })}>
                                {t('guestUnavailable.checkAgain')}
                            </Button>
                        )}
                        <Button color="inherit" onClick={() => { logOutAction(); navigate('/auth/login'); }}>
                            {t('guestUnavailable.signIn')}
                        </Button>
                    </Stack>
                </Paper>
            </Box>
        </PageContainer>
    );
}
