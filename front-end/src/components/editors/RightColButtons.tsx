import React from 'react';
import { Stack, Fab } from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSave, faPlay, faStop } from '@fortawesome/free-solid-svg-icons';

type ButtonsProps = {
    handlePlayClick: () => void;
};

const Buttons = ({ handlePlayClick }: ButtonsProps) => (
    <Stack direction="row" spacing={3}>
        <Fab color="primary" aria-label="save">
            <FontAwesomeIcon icon={faSave} size="1x" />
        </Fab>
            <Fab color="success" aria-label="play" onClick={handlePlayClick}>
            <FontAwesomeIcon icon={faPlay} size="1x" />
        </Fab>
            <Fab color="error" aria-label="stop">
            <FontAwesomeIcon icon={faStop} size="1x" />
        </Fab>
  </Stack>
);

export default Buttons;