import React, { useState, useEffect } from 'react';
import PageContainer from 'src/components/container/PageContainer';
import Footer from 'src/components/landingpage/footer/Footer';
import AccountSettingsForm from 'src/components/forms/form-horizontal/AccountSettingsForm';
import Breadcrumb from 'src/layouts/full/shared/breadcrumb/Breadcrumb';
import BlankCard from 'src/components/shared/BlankCard';
import profilecover from 'src/assets/images/backgrounds/profilebg.jpg';
import userimg from 'src/assets/images/profile/user-1.jpg';
import {
    Grid,
    Box,
    Typography,
    Button,
    Avatar,
    Stack,
    CardMedia,
    styled,
    Fab,
    Skeleton,
    Alert,
    AlertTitle,
} from '@mui/material';
import { useAuth } from "src/authentication/AuthProvider";
import { useTranslation } from 'react-i18next';
import InfoAlert from 'src/components/alerts/InfoAlert';

const AccountsSettingsPage = () => {
    const { t } = useTranslation();
    const auth = useAuth();
    const [user, setUser] = useState(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchUserData = async () => {
            try {
                const userData = await auth.getUserDataAction();
                setUser(userData);
                console.log(userData)
            } catch (error) {
                console.error('Error fetching user data:', error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchUserData();
    }, []);

    const ProfileImage = styled(Box)(() => ({
        borderRadius: '50%',
        width: '140px',
        height: '140px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        margin: '0 auto',
    }));

    return (
        <PageContainer title={t('acccount-settings.title')} description={t('acccount-settings.description')}>

            <Grid
                container
                justifyContent="center"
                alignItems="center"
            >
                <Grid item xs={12} sm={12} md={10} lg={9}>
                    <BlankCard>
                        <CardMedia component="img" image={profilecover} alt={profilecover} width="100%" />
                        {isLoading ? (
                            <Skeleton variant="rectangular" width="100%" height={400} />
                        ) : (
                            <Grid container justifyContent="center" mt={4} mb={5}>
                                <Grid item lg={6}
                                    sm={12}
                                    xs={12}
                                    sx={{ marginBottom: 3 }}
                                >
                                    <Box
                                        display="flex"
                                        alignItems="center"
                                        textAlign="center"
                                        justifyContent="center"
                                        sx={{
                                            mt: '-115px',
                                        }}
                                    >
                                        <Box>
                                            <ProfileImage>
                                                <Avatar
                                                    src={user?.image_url}
                                                    alt={user?.image_url}
                                                    sx={{
                                                        borderRadius: '50%',
                                                        width: '130px',
                                                        height: '130px',
                                                        border: '4px solid #fff',
                                                    }}
                                                />
                                            </ProfileImage>
                                            <Box mt={1}>
                                                <Typography fontWeight={600} variant="h5">
                                                    {`${user?.firstname} ${user?.lastname}`}
                                                </Typography>
                                                <Typography color="textSecondary" variant="h6" fontWeight={400}>
                                                    {user?.role}
                                                </Typography>
                                            </Box>
                                        </Box>
                                    </Box>
                                </Grid>
                                <Grid item xs={12} sm={12} md={12} lg={12}>
                                    <AccountSettingsForm user={user} />
                                </Grid>
                            </Grid>
                        )}
                    </BlankCard>
                </Grid>
            </Grid>

            <Footer />
        </PageContainer>
    );
};

export default AccountsSettingsPage;
