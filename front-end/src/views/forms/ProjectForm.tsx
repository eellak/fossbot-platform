// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import React from 'react';
import { Grid } from '@mui/material';

// components
import Breadcrumb from 'src/layouts/full/shared/breadcrumb/Breadcrumb';
import PageContainer from 'src/components/container/PageContainer';
import ParentCard from 'src/components/shared/ParentCard';
import NewProjectIcons from '../../components/forms/form-horizontal/NewProjectIcons';

const ProjectForm = () => {
  return (
    <PageContainer title="Horizontal Form" description="this is Horizontal Form page">
      {/* breadcrumb */}
      <Breadcrumb title="Create New Project" />
      {/* end breadcrumb */}
      <Grid container spacing={3}>        
        <Grid item xs={12}>
          <ParentCard title="New Project Form">
            <NewProjectIcons />
          </ParentCard>
        </Grid>
      </Grid>
    </PageContainer>
  );
};

export default ProjectForm;
