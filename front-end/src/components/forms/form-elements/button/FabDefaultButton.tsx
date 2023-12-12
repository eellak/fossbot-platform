// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import React from 'react';
import { Fab, Tooltip, Stack } from '@mui/material';
import { IconClipboard, IconPlus, IconSend } from '@tabler/icons-react';

const FabDefaultButton = () => (
  <Stack spacing={1} direction="row" justifyContent="center">
    <Tooltip title="Send">
      <Fab color="primary" aria-label="send">
        <IconSend width={20} />
      </Fab>
    </Tooltip>
    <Tooltip title="Add">
      <Fab color="secondary" aria-label="plus">
        <IconPlus width={20} />
      </Fab>
    </Tooltip>
    <Fab disabled aria-label="clipboard">
      <IconClipboard width={20} />
    </Fab>
  </Stack>
);

export default FabDefaultButton;
