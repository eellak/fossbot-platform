// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import React from 'react';
import { Box, Switch, FormGroup, FormControlLabel } from '@mui/material';

const PositionSwitch = () => (
    <Box textAlign="center">
        <FormGroup aria-label="position" row>
            <FormControlLabel
                value="top"
                control={<Switch color="primary" />}
                label="Top"
                labelPlacement="top"
            />
            <FormControlLabel
                value="start"
                control={<Switch color="primary" />}
                label="Start"
                labelPlacement="start"
            />
            <FormControlLabel
                value="bottom"
                control={<Switch color="primary" />}
                label="Bottom"
                labelPlacement="bottom"
            />
            <FormControlLabel
                value="end"
                control={<Switch color="primary" />}
                label="End"
                labelPlacement="end"
            />
        </FormGroup>
    </Box>
);
export default PositionSwitch;
