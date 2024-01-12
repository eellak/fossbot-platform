import React from 'react';
import Autocomplete from '@mui/material/Autocomplete';
import CustomTextField from '../../theme-elements/CustomTextField';
import top100Films from './data';

const SizesAutocomplete = () => (
  <>
    <Autocomplete
      disablePortal
      id="medium-combo-box-demo"
      options={top100Films}
      fullWidth
      sx={{
        mb: 2,
      }}
      renderInput={(params) => (
        <CustomTextField {...params} placeholder="Size Medium" aria-label="Size Medium" />
      )}
    />
    <Autocomplete
      disablePortal
      id="medium-combo-box-demo"
      options={top100Films}
      fullWidth
      size="small"
      renderInput={(params) => (
        <CustomTextField {...params} placeholder="Size Small" aria-label="Size Small" />
      )}
    />
  </>
);

export default SizesAutocomplete;
