import React from 'react';
import PageContainer from 'src/components/container/PageContainer';
import Footer from 'src/components/landingpage/footer/Footer';
import {
    Grid,
    Box,
    Typography,
    Button,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useNotifications } from 'src/components/notifications/NotificationProvider';
import UsersCard from 'src/components/admin-panel/UsersCard';
import { Link } from 'react-router-dom';
import { IconRobot } from '@tabler/icons-react';

const AdminPanelPage = () => {
    const { t } = useTranslation();
    const { notify } = useNotifications();

    const handleShowSuccessAlert = (message) => {
        notify(message, { severity: 'success' });
    };

    const handleShowErrorAlert = (message) => {
        notify(message, { severity: 'error' });
    };

    return (
        <PageContainer title={t('admin-panel.title')} description={t('admin-panel.description')}>

            <Grid container>
                <Grid item xs={12} sm={12} mt={2}>
                    <Typography variant="h5">{t('admin-panel.title')}</Typography>
                    <Typography variant="subtitle2" color="textSecondary">
                        {t('admin-panel.usageDescription')}
                    </Typography>
                </Grid>
                <Grid item xs={12} sm={12} mt={3}>
                    <Box mb={2} display="flex" justifyContent="flex-end">
                        <Button component={Link} to="/admin/ai" variant="outlined" startIcon={<IconRobot size={18} />}>
                            {t('aiAdmin.open')}
                        </Button>
                    </Box>
                    <UsersCard 
                     onShowSuccessAlert={handleShowSuccessAlert}
                     onShowErrorAlert={handleShowErrorAlert}
                     />
                </Grid>
            </Grid>

        </PageContainer>
    );
};


export default AdminPanelPage;
