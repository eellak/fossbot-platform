// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import React from 'react';
import { Fab, Tooltip, Stack } from '@mui/material';
import { IconBell } from '@tabler/icons-react';

const FabSizeButtons = () => (
  <>
    <Stack spacing={1} direction="row" justifyContent="center">
      <Tooltip title="Bell">
        <Fab size="small" color="primary" aria-label="small-bell">
          <IconBell width={16} />
        </Fab>
      </Tooltip>
      <Tooltip title="Bell">
        <Fab size="medium" color="secondary" aria-label="medium-bell">
          <IconBell width={18} />
        </Fab>
      </Tooltip>
      <Tooltip title="Bell">
        <Fab size="large" color="warning" aria-label="large-bell">
          <IconBell width={20} />
        </Fab>
      </Tooltip>
    </Stack>
  </>
);

export default FabSizeButtons;
