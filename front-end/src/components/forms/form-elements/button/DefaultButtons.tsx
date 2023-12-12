// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import React from 'react';
import {  Button, Stack } from '@mui/material';

const DefaultButtons = () => (
  <Stack spacing={1} direction={{ xs: 'column', sm: 'row' }} justifyContent="center">
    <Button variant="contained" color="primary">
      Primary
    </Button>
    <Button variant="contained" color="secondary">
      Secondary
    </Button>
    <Button disabled>Disabled</Button>
    <Button href="#text-buttons" variant="contained" color="primary">
      Link
    </Button>
  </Stack>
);

export default DefaultButtons;
