// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import React from 'react';
import { Button, ButtonGroup, Stack } from '@mui/material';

const SizeButtonGroup = () => (
  <Stack spacing={1} justifyContent="center">
        <ButtonGroup size="small" variant="outlined" aria-label="outlined primary button group">
          <Button>One</Button>
          <Button>Two</Button>
          <Button>Three</Button>
        </ButtonGroup>
        <ButtonGroup variant="outlined" aria-label="outlined button group">
          <Button>One</Button>
          <Button>Two</Button>
          <Button>Three</Button>
        </ButtonGroup>
        <ButtonGroup size="large" variant="outlined" aria-label="text button group">
          <Button>One</Button>
          <Button>Two</Button>
          <Button>Three</Button>
        </ButtonGroup>
    </Stack>
);

export default SizeButtonGroup;
