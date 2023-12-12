import React from 'react';
import { Grid, Fab } from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSave, faPlay, faStop } from '@fortawesome/free-solid-svg-icons';

type ButtonsProps = {
    handlePlayClick: () => void;
};

const Buttons2 = ({ handlePlayClick }: ButtonsProps) => (
    <Grid container justifyContent="space-between">
        <Grid item>
            <Fab color="primary" aria-label="save">
                <FontAwesomeIcon icon={faSave} size="1x" />
            </Fab>
        </Grid>
        <Grid item>
            <Fab color="success" aria-label="play" onClick={handlePlayClick}>
                <FontAwesomeIcon icon={faPlay} size="1x" />
            </Fab>
        </Grid>
        <Grid item>
            <Fab color="error" aria-label="stop">
                <FontAwesomeIcon icon={faStop} size="1x" />
            </Fab>
        </Grid>
    </Grid>
);

export default Buttons2;