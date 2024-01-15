import React from 'react';
import Autocomplete from '@mui/material/Autocomplete';
import CustomTextField from '../../theme-elements/CustomTextField';
import top100Films from './data';

const MultipleValuesAutocomplete = () => (
  <Autocomplete
    multiple
    fullWidth
    id="tags-outlined"
    options={top100Films}
    getOptionLabel={(option) => (typeof option === 'string' ? '' : option.title)}
    defaultValue={[top100Films[13]]}
    filterSelectedOptions
    renderInput={(params) => (
      <CustomTextField {...params} placeholder="Favorites" aria-label="Favorites" />
    )}
  />
);

export default MultipleValuesAutocomplete;
