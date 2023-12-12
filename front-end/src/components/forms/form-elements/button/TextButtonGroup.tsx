// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import React from 'react';
import { Button, ButtonGroup, Stack } from '@mui/material';

const TextButtonGroup = () => (
  <Stack spacing={1} direction="column" justifyContent="center">
    <ButtonGroup variant="text" aria-label="text button group">
      <Button>One</Button>
      <Button>Two</Button>
      <Button>Three</Button>
    </ButtonGroup>
    <ButtonGroup color="secondary" variant="text" aria-label="text button group">
      <Button>One</Button>
      <Button>Two</Button>
      <Button>Three</Button>
    </ButtonGroup>
    <ButtonGroup color="error" variant="text" aria-label="text button group">
      <Button>One</Button>
      <Button>Two</Button>
      <Button>Three</Button>
    </ButtonGroup>
  </Stack>
);

export default TextButtonGroup;
