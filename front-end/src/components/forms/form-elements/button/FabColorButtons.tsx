// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import React from 'react';
import { Fab, Tooltip, Stack } from '@mui/material';
import { IconSend } from '@tabler/icons-react';

const FabColorButtons = () => (
  <>
    <Stack spacing={1} direction={{ xs: 'column', sm: 'row' }} justifyContent="center" alignItems="center">
      <Tooltip title="Send">
        <Fab color="primary" aria-label="send">
          <IconSend width={20} />
        </Fab>
      </Tooltip>
      <Tooltip title="Send">
        <Fab color="secondary" aria-label="send">
          <IconSend width={20} />
        </Fab>
      </Tooltip>
      <Tooltip title="Send">
        <Fab color="warning" aria-label="send">
          <IconSend width={20} />
        </Fab>
      </Tooltip>
      <Tooltip title="Send">
        <Fab color="error" aria-label="send">
          <IconSend width={20} />
        </Fab>
      </Tooltip>
      <Tooltip title="Send">
        <Fab color="success" aria-label="send">
          <IconSend width={20} />
        </Fab>
      </Tooltip>
    </Stack>
  </>
);

export default FabColorButtons;
