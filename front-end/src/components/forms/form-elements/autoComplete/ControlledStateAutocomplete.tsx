// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import React from 'react';
import { Typography } from '@mui/material';
import Autocomplete from '@mui/material/Autocomplete';
import CustomTextField from "../../theme-elements/CustomTextField";

const options = ['Option 1', 'Option 2'];

const ControlledStateAutocomplete = () => {
  const [value, setValue] = React.useState<string | null>(options[0]);
  const [inputValue, setInputValue] = React.useState('');

  return (
    <>
      <Autocomplete
        value={value}
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        onChange={(event: any, newValue: string | null) => {
          setValue(newValue);
        }}
        inputValue={inputValue}
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        onInputChange={(event, newInputValue) => {
          setInputValue(newInputValue);
        }}
        id="controllable-states-demo"
        options={options}
        fullWidth
        renderInput={(params) => (
          <CustomTextField
            {...params}
            placeholder="Controllable"
            aria-label="Controllable"
          />
        )}
      />
      <Typography
        color="textSecondary"
        variant="subtitle2"
        sx={{
          mt: 1,
        }}
      >{`value: ${value !== null ? `'${value}'` : 'null'}`}</Typography>
      <Typography
        color="textSecondary"
        variant="subtitle2"
      >{`inputvalue: '${inputValue}'`}</Typography>
    </>
  );
};

export default ControlledStateAutocomplete;
