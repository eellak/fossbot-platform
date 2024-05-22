import { useEffect, useState, useRef } from 'react';
import { Box, Grid, Stack, DialogContent } from '@mui/material';
import PageContainer from '../../components/container/PageContainer'; //'src/components/container/PageContainer';
import Cards from '../../components/widgets/cards/ComplexCard'

const TutorialsPage = () => {
  

  return (
    <PageContainer title="Tutorials" description="Coding Tutorials Page">
      <Cards/>
    </PageContainer>
  );
};

export default TutorialsPage;