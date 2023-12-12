// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import React from 'react';
import { Box, FormControlLabel } from '@mui/material';
import CustomRadio from '../../theme-elements/CustomRadio';

const ColorLabelRadio = () => {
  return (
    <Box textAlign="center">
      <FormControlLabel
        value="end"
        control={<CustomRadio color="primary" checked />}
        label="Primary"
        labelPlacement="end"
      />
      <FormControlLabel
        value="end"
        control={<CustomRadio color="secondary" checked />}
        label="Secondary"
        labelPlacement="end"
      />
      <FormControlLabel
        value="end"
        control={<CustomRadio color="success" checked />}
        label="Success"
        labelPlacement="end"
      />

      <FormControlLabel
        value="end"
        control={<CustomRadio color="error" checked />}
        label="Danger"
        labelPlacement="end"
      />

      <FormControlLabel
        value="end"
        control={<CustomRadio color="warning" checked />}
        label="Warning"
        labelPlacement="end"
      />
    </Box>
  );
};

export default ColorLabelRadio;
