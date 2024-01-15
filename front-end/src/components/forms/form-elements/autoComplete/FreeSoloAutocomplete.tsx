import React from 'react';
import { Stack } from '@mui/material';
import Autocomplete from '@mui/material/Autocomplete';
import CustomTextField from '../../theme-elements/CustomTextField';
import top100Films from './data';

const FreeSoloAutocomplete = () => {
  
  return (
    <Stack>
      <Autocomplete
        id="free-solo-demo"
        freeSolo
        fullWidth
        sx={{
          mb: 2,
        }}
        options={top100Films.map((option) => option.title)}
        renderInput={(params) => (
          <CustomTextField {...params} placeholder="FreeSolo" aria-label="FreeSolo" />
        )}
      />
      <Autocomplete
        freeSolo
        fullWidth
        id="free-solo-2-demo"
        disableClearable
        options={top100Films.map((option) => option.title)}
        renderInput={(params) => (
          <CustomTextField
            {...params}
            placeholder="Search input"
            aria-label="Search input"
            inputProps={{
              ...params.inputProps,
              type: 'search',
            }}
          />
        )}
      />
    </Stack>
  );
};

export default FreeSoloAutocomplete;
