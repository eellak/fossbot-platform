import { Button, Stack } from '@mui/material';
import { useTranslation } from 'react-i18next';
import UsersCard from 'src/components/admin-panel/UsersCard';
import PageContainer from 'src/components/container/PageContainer';
import PageHeader from 'src/components/shared/PageHeader';

const AdminPanelPage = () => {
    const { t } = useTranslation();
    return (
        <PageContainer title={t('admin-panel.title')} description={t('admin-panel.usageDescription')}>
            <Stack spacing={3}>
                <PageHeader title={t('admin-panel.title')} description={t('admin-panel.usageDescription')} />
                <Button variant="outlined" href="/website-admin" sx={{ alignSelf: 'flex-start' }}>{t('website.title')}</Button>
                <Button variant="outlined" href="/website-admin?tab=api" sx={{ alignSelf: 'flex-start' }}>{t('website.apiTokens.title')}</Button>
                <UsersCard />
            </Stack>
        </PageContainer>
    );
};
export default AdminPanelPage;
