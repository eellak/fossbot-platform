// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import React from 'react';
import { FormGroup, FormControlLabel, FormControl } from '@mui/material';
import CustomCheckbox from '../../theme-elements/CustomCheckbox';

const PositionCheckbox = () => (
  <FormControl
    component="fieldset"
    sx={{
      display: 'flex',
      justifyContent: 'center',
    }}
  >
    <FormGroup
      aria-label="position"
      row
      sx={{
        justifyContent: 'center',
      }}
    >
      <FormControlLabel
        value="top"
        control={<CustomCheckbox color="primary" />}
        label="Top"
        labelPlacement="top"
      />
      <FormControlLabel
        value="start"
        control={<CustomCheckbox color="primary" />}
        label="Start"
        labelPlacement="start"
      />
      <FormControlLabel
        value="bottom"
        control={<CustomCheckbox color="primary" />}
        label="Bottom"
        labelPlacement="bottom"
      />
      <FormControlLabel
        value="end"
        control={<CustomCheckbox color="primary" />}
        label="End"
        labelPlacement="end"
      />
    </FormGroup>
  </FormControl>
);

export default PositionCheckbox;
