import React from 'react';
import { Stack, Fab } from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSave, faPlay, faStop } from '@fortawesome/free-solid-svg-icons';

// type PlayProp = {
//     handlePlayClick: () => void;
    
// };

// type SaveProp = {
//     handleSaveClick: () => void;
// };

interface ButtonsProps {
    handlePlayClick: () => void;
    handleSaveClick: () => void;
}

const Buttons: React.FC<ButtonsProps> = ( { handlePlayClick, handleSaveClick } )  => (
    <Stack direction="row" spacing={3}>
        <Fab color="primary" aria-label="save" onClick={handleSaveClick}>
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