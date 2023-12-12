// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import React from 'react';
import { Box, RadioGroup, FormControlLabel  } from '@mui/material';

import CustomRadio from "../../theme-elements/CustomRadio"

const PositionRadio = () => {
    return (
        <Box textAlign="center">
            <RadioGroup row aria-label="position" name="position" defaultValue="top">
                <FormControlLabel value="top" control={<CustomRadio />} label="Top" labelPlacement="top" />
                <FormControlLabel
                  value="start"
                  control={<CustomRadio />}
                  label="Start"
                  labelPlacement="start"
                />
                <FormControlLabel
                  value="bottom"
                  control={<CustomRadio />}
                  label="Bottom"
                  labelPlacement="bottom"
                />
                <FormControlLabel value="end" control={<CustomRadio />} label="End" />
              </RadioGroup>

        </Box>
    );
};

export default PositionRadio;
