import React from 'react';
import Autocomplete from '@mui/material/Autocomplete';
import CustomTextField from '../../theme-elements/CustomTextField';
import top100Films from './data';

const ComboBoxAutocomplete = () => (
  <Autocomplete
    disablePortal
    id="combo-box-demo"
    options={top100Films}
    fullWidth
    renderInput={(params) => (
      <CustomTextField {...params} placeholder="Select movie" aria-label="Select movie" />
    )}
  />
);

export default ComboBoxAutocomplete;
