// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import React from 'react';
import { Box, FormControlLabel } from '@mui/material';
import CustomCheckbox from '../../theme-elements/CustomCheckbox';

const ColorsCheckbox = () => (
  <Box textAlign="center">
    <FormControlLabel control={<CustomCheckbox defaultChecked />} label="Primary" />
    <FormControlLabel
      control={
        <CustomCheckbox
          defaultChecked
          color="secondary"
          inputProps={{ 'aria-label': 'checkbox with default color' }}
        />
      }
      label="Secondary"
    />
    <FormControlLabel
      control={
        <CustomCheckbox
          defaultChecked
          color="success"
          inputProps={{ 'aria-label': 'checkbox with default color' }}
        />
      }
      label="Success"
    />
    <FormControlLabel
      control={
        <CustomCheckbox
          defaultChecked
          color="warning"
          inputProps={{ 'aria-label': 'checkbox with default color' }}
        />
      }
      label="Warning"
    />
    <FormControlLabel
      control={
        <CustomCheckbox
          defaultChecked
          color="error"
          inputProps={{ 'aria-label': 'checkbox with default color' }}
        />
      }
      label="Error"
    />
  </Box>
);

export default ColorsCheckbox;
