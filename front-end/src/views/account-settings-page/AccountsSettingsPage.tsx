import React, { useState, useEffect } from 'react';
import PageContainer from 'src/components/container/PageContainer';
import Footer from 'src/components/landingpage/footer/Footer';
import AccountSettingsForm from 'src/components/forms/form-horizontal/AccountSettingsForm';
import BlankCard from 'src/components/shared/BlankCard';
import profilecover from 'src/assets/images/backgrounds/profilebg.jpg';
import {
    Grid,
    Box,
    Typography,
    Avatar,
    CardMedia,
    styled,
    Skeleton,
} from '@mui/material';
import { useAuth } from "src/authentication/AuthProvider";
import { useTranslation } from 'react-i18next';
import AccountSettingsInfo from './AccountSettingsInfo';
import { Project } from 'src/authentication/AuthInterfaces';
import SuccessAlert from 'src/components/alerts/SuccessAlert';
import ErrorAlert from 'src/components/alerts/ErrorAlert';

const AccountsSettingsPage = () => {
    const { t } = useTranslation();
    const auth = useAuth();
    const [user, setUser] = useState(null);
    const [isLoading, setIsLoading] = useState(true);

    const [monacoProjectsNumber, setMonacoProjectsNumber] = useState(0);
    const [blocklyProjectsNumber, setBlocklyProjectsNumber] = useState(0);
    const [tutorialsNumber, setTutorialsNumber] = useState(0);

    const [showSuccessAlert, setShowSuccessAlert] = useState(false);
    const [showErrorAlert, setShowErrorAlert] = useState(false);

    const [showSuccessAlertText, setShowSuccessAlertText] = useState("");
    const [showErrorAlertText, setShowErrorAlertText] = useState("");

    useEffect(() => {
        const fetchProjects = async () => {
            try {
                const fetchedProjects: Project[] = await auth.getProjectsAction();

                if (fetchedProjects.length != 0) {
                    const blocklyProjects = fetchedProjects.filter(project => project.project_type == 'python')
                    const monacoProjects = fetchedProjects.filter(project => project.project_type == 'blockly')
                    setMonacoProjectsNumber(monacoProjects.length)
                    setBlocklyProjectsNumber(blocklyProjects.length)
                }
            } catch (error) {
                console.error('Error fetching projects:', error);
                setShowErrorAlert(true);
                const text = t('alertMessages.projectsFetchError');
                setShowErrorAlertText(text);
            }
        };

        fetchProjects();
    }, []);


    useEffect(() => {
        const fetchUserData = async () => {
            try {
                const userData = await auth.getUserDataAction();
                setUser(userData);
            } catch (error) {
                console.error('Error fetching user data:', error);
                setShowErrorAlert(true);
                const text = t('alertMessages.userDataFetchError');
                setShowErrorAlertText(text);
            } finally {
                setIsLoading(false);
            }
        };

        fetchUserData();
    }, []);

    const handleFormSubmitResult = (result) => {
        if (result) {
            setShowSuccessAlert(true);
            setShowSuccessAlertText(t('alertMessages.userDataUpdated'));
        } else {
            setShowErrorAlert(true);
            setShowErrorAlertText(t('alertMessages.userDataUpdateError'));
        }
    };

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
                                    <Grid container justifyContent="center" mt={4} mb={5} paddingLeft={5} paddingRight={5}>

                                        <Grid item xs={12} md={6} paddingRight={2} >
                                            <AccountSettingsForm
                                                user={user}
                                                onFormSubmit={handleFormSubmitResult} />
                                        </Grid>

                                        <Grid item xs={12} md={6} paddingLeft={2} >
                                            <AccountSettingsInfo
                                                monacoProjectsNumber={monacoProjectsNumber}
                                                blocklyProjectsNumber={blocklyProjectsNumber}
                                                tutorialsNumber={tutorialsNumber} />
                                        </Grid>

                                    </Grid>
                                </Grid>
                            </Grid>
                        )}
                    </BlankCard>
                </Grid>
            </Grid>

            <Footer />

            {showSuccessAlert && (
                <SuccessAlert title={showSuccessAlertText} description={""} />
            )}

            {showErrorAlert && (
                <ErrorAlert title={showErrorAlertText} description={""} />
            )}
        </PageContainer>
    );
};


export default AccountsSettingsPage;
