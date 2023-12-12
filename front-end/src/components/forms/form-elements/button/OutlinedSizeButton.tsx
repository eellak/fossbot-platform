// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import React from 'react';
import { Button, Stack } from '@mui/material';

const OutlinedSizeButton = () => (
  <Stack spacing={1} direction={{ xs: 'column', sm: 'row' }} alignItems="center" justifyContent="center">
    <Button variant="outlined" size="small">
      Small
    </Button>
    <Button variant="outlined" size="medium">
      Medium
    </Button>
    <Button variant="outlined" size="large">
      Large
    </Button>
  </Stack>
);

export default OutlinedSizeButton;
