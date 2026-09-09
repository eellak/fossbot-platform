import React from 'react';
import PageContainer from 'src/components/container/PageContainer';
import ProjectsCard from 'src/components/dashboard/ProjectsCard';
import StageMarketplacePanel from 'src/components/dashboard/StageMarketplacePanel';
import UserStagesDashboardPanel from 'src/components/dashboard/UserStagesDashboardPanel';
import { Box, Grid } from '@mui/material';
import { useTranslation } from 'react-i18next';
import CourseResumeCard from 'src/components/dashboard/CourseResumeCard';
import { useFeatureFlags } from 'src/config/FeatureFlags';

const Modern = ({ previewAppearance = false }: { previewAppearance?: boolean }) => {
  const { t } = useTranslation();
  const { marketplace } = useFeatureFlags();

  return (
    <PageContainer title={t('dashboard-page.title')} description={t('dashboard-page.description')}>
      <Box>
        <Grid container spacing={3}>
          {marketplace && <Grid item xs={12}><CourseResumeCard /></Grid>}
          <Grid item xs={12} lg={12}>
            <ProjectsCard previewAppearance={previewAppearance} />
          </Grid>
          {marketplace && <Grid item xs={12} xl={5}><UserStagesDashboardPanel /></Grid>}
          {marketplace && <Grid item xs={12} xl={7}><StageMarketplacePanel embedded preview /></Grid>}
        </Grid>
      </Box>
    </PageContainer>
  );
};
export default Modern;
