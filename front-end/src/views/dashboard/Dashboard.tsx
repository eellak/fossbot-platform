
import React from 'react';
import PageContainer from 'src/components/container/PageContainer';
import ProjectsCard from 'src/components/dashboard/ProjectsCard';
import StageMarketplacePanel from 'src/components/dashboard/StageMarketplacePanel';
import UserGitHubStagesPanel from 'src/components/dashboard/UserGitHubStagesPanel';
import { Box, Grid } from '@mui/material';
import SlideShow from 'src/components/cards-slide-show/SlideShow';
import { useTranslation } from 'react-i18next';
import CourseResumeCard from 'src/components/dashboard/CourseResumeCard';

const Modern = () => {
  const { t } = useTranslation();

  return (
    <PageContainer title={t('dashboard-page.title')} description={t('dashboard-page.description')}>
      <Box>
        <Grid container spacing={3}>
          <Grid item xs={12}><CourseResumeCard /></Grid>
        {/* <Grid item xs={8} lg={8}>
        <SlideShow />
        </Grid> */}
          <Grid item xs={12} lg={12} >
            <ProjectsCard />
          </Grid>
          <Grid item xs={12} xl={5}><UserGitHubStagesPanel embedded preview /></Grid>
          <Grid item xs={12} xl={7}><StageMarketplacePanel embedded preview /></Grid>
        </Grid>
      </Box>
    </PageContainer>
  );
};

export default Modern;
