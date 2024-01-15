 
import React from 'react';
import { Box, Grid } from '@mui/material';
import PageContainer from 'src/components/container/PageContainer';

import TopCards from 'src/components/dashboards/modern/TopCards';
import ProjectsCard from 'src/components/dashboards/modern/ProjectsCard';
import WelcomeHomePage from 'src/layouts/full/shared/welcome/WelcomeHomePage';

const Modern = () => {
  return (
    <PageContainer title="Modern Dashboard" description="this is Modern Dashboard page">
      <Box>
        <Grid container spacing={3}>
          {/* column */}
          <Grid item xs={12} lg={12}>
            <TopCards />
          </Grid>
          {/* column */}
          <Grid item xs={12} lg={12}>
            <ProjectsCard />
          </Grid>
        </Grid>
        {/* column */}
        <WelcomeHomePage />
      </Box>
    </PageContainer>
  );
};

export default Modern;