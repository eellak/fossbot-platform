import { useContext, useEffect, useState } from 'react';
import { Box, Button, Stack, Tab, Tabs, Typography } from '@mui/material';
import { Link, UNSAFE_NavigationContext, useLocation, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import UsersCard from 'src/components/admin-panel/UsersCard';
import GuestAccessSettingsCard from 'src/components/admin-panel/GuestAccessSettingsCard';
import PageContainer from 'src/components/container/PageContainer';
import { pageTabsSx, TabbedPageHeader } from 'src/components/shared/PageHeader';
import { useConfirmDialog } from 'src/components/shared/ConfirmDialog';

type NavigationTransition = { location: { pathname: string }; retry: () => void };
type BlockingNavigator = {
    block: (blocker: (transition: NavigationTransition) => void) => () => void;
    listen: (listener: () => void) => () => void;
};

const AdminPanelPage = () => {
    const { t } = useTranslation();
    const [searchParams, setSearchParams] = useSearchParams();
    const tab = searchParams.get('tab') === 'guests' ? 'guests' : 'users';
    const [guestDirty, setGuestDirty] = useState(false);
    const { confirm } = useConfirmDialog();
    const { navigator } = useContext(UNSAFE_NavigationContext);
    const { pathname } = useLocation();

    useEffect(() => {
        if (!guestDirty) return;
        // React Router 6.3 exposes blocking only through its underlying history.
        const history = navigator as unknown as BlockingNavigator;
        let active = true;
        let pending = false;
        let unblock = () => {};
        const block = (transition: NavigationTransition) => {
            if (pending) return;
            pending = true;
            const proceed = () => {
                if (!active) return;
                unblock();
                transition.retry();
            };
            // Tabs change the query only; they must not discard the draft.
            if (transition.location.pathname === pathname) {
                proceed();
                return;
            }
            void confirm({
                title: t('admin-panel.guest.unsavedTitle'),
                message: t('admin-panel.guest.discard'),
                confirmLabel: t('admin-panel.guest.discardAction'),
                cancelLabel: t('cancel'),
                danger: true,
            }).then((approved) => {
                if (approved) proceed();
                else pending = false;
            });
        };
        unblock = history.block(block);
        const unlisten = history.listen(() => {
            if (!active) return;
            pending = false;
            unblock();
            unblock = history.block(block);
        });
        return () => { active = false; unblock(); unlisten(); };
    }, [guestDirty, navigator, pathname, confirm, t]);

    return (
        <PageContainer title={t('admin-panel.title')} description={t('admin-panel.usageDescription')}>
            <Stack spacing={3}>
                <TabbedPageHeader
                    title={t('admin-panel.title')}
                    description={t('admin-panel.usageDescription')}
                    action={(
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                            <Button variant="outlined" component={Link} to="/website-admin">{t('website.title')}</Button>
                            <Button variant="outlined" component={Link} to="/website-admin?tab=api">{t('website.apiTokens.title')}</Button>
                        </Box>
                    )}
                    tabs={(
                        <Tabs
                            value={tab}
                            aria-label={t('admin-panel.sections')}
                            variant="scrollable"
                            scrollButtons="auto"
                            sx={pageTabsSx}
                            onChange={(_, value) => {
                                const next = new URLSearchParams(searchParams);
                                if (value === 'guests') next.set('tab', 'guests');
                                else next.delete('tab');
                                setSearchParams(next);
                            }}
                        >
                            <Tab id="admin-users-tab" aria-controls="admin-users-panel" value="users" label={t('admin-panel.usersTitle')} />
                            <Tab
                                id="admin-guests-tab"
                                aria-controls="admin-guests-panel"
                                value="guests"
                                label={(
                                    <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1 }}>
                                        {t('admin-panel.guest.title')}
                                        {guestDirty && <Typography component="span" variant="caption" color="text.secondary">{t('admin-panel.guest.unsavedShort')}</Typography>}
                                    </Box>
                                )}
                            />
                        </Tabs>
                    )}
                />
                <Box role="tabpanel" id="admin-users-panel" aria-labelledby="admin-users-tab" hidden={tab !== 'users'}>
                    <UsersCard />
                </Box>
                <Box role="tabpanel" id="admin-guests-panel" aria-labelledby="admin-guests-tab" hidden={tab !== 'guests'}>
                    <GuestAccessSettingsCard onDirtyChange={setGuestDirty} />
                </Box>
            </Stack>
        </PageContainer>
    );
};
export default AdminPanelPage;
