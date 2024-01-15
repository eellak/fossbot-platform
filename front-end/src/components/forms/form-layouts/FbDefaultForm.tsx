 
import React from 'react';
import { FormControlLabel, Button, Grid, RadioGroup, FormControl, MenuItem } from '@mui/material';
import CustomTextField from '../theme-elements/CustomTextField';
import CustomSelect from '../theme-elements/CustomSelect';
import CustomCheckbox from '../theme-elements/CustomCheckbox';
import CustomRadio from '../theme-elements/CustomRadio';
import CustomFormLabel from '../theme-elements/CustomFormLabel';
import ParentCard from '../../shared/ParentCard';

interface numberType {
  value: string;
  label: string;
}

const numbers: numberType[] = [
  {
    value: 'one',
    label: 'One',
  },
  {
    value: 'two',
    label: 'Two',
  },
  {
    value: 'three',
    label: 'Three',
  },
  {
    value: 'four',
    label: 'Four',
  },
];

const FbDefaultForm = () => {
  const [state, setState] = React.useState({
    checkedA: false,
    checkedB: false,
    checkedC: false,
  });

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setState({ ...state, [event.target.name]: event.target.checked });
  };

  const [value, setValue] = React.useState('');

  const handleChange2 = (event: React.ChangeEvent<HTMLInputElement>) => {
    setValue(event.target.value);
  };

  const [number, setNumber] = React.useState('');

  const handleChange3 = (event: React.ChangeEvent<HTMLInputElement>) => {
    setNumber(event.target.value);
  };

  return (
    <ParentCard title="Default Form">
      <form>
        <CustomFormLabel
          sx={{
            mt: 0,
          }}
          htmlFor="default-value"
        >
          Default Text
        </CustomFormLabel>
        <CustomTextField
          id="default-value"
          variant="outlined"
          defaultValue="George deo"
          fullWidth
        />
        <CustomFormLabel htmlFor="email-text">Email</CustomFormLabel>
        <CustomTextField id="email-text" type="email" variant="outlined" fullWidth />
        <CustomFormLabel htmlFor="default-outlined-password-input">Password</CustomFormLabel>

        <CustomTextField
          id="default-outlined-password-input"
          type="password"
          autoComplete="current-password"
          variant="outlined"
          fullWidth
        />
        <CustomFormLabel htmlFor="outlined-multiline-static">Textarea</CustomFormLabel>

        <CustomTextField
          id="outlined-multiline-static"
          multiline
          rows={4}
          variant="outlined"
          fullWidth
        />
        <CustomFormLabel htmlFor="readonly-text">Read Only</CustomFormLabel>

        <CustomTextField
          id="readonly-text"
          defaultValue="Hello World"
          InputProps={{
            readOnly: true,
          }}
          variant="outlined"
          fullWidth
        />
        <Grid container spacing={0} my={2}>
          <Grid item lg={4} md={6} sm={12}>
            <FormControlLabel
              control={
                <CustomCheckbox
                  checked={state.checkedA}
                  onChange={handleChange}
                  name="checkedA"
                  color="primary"
                />
              }
              label="Check this custom checkbox"
            />
            <FormControlLabel
              control={
                <CustomCheckbox
                  checked={state.checkedB}
                  onChange={handleChange}
                  name="checkedB"
                  color="primary"
                />
              }
              label="Check this custom checkbox"
            />
            <FormControlLabel
              control={
                <CustomCheckbox
                  checked={state.checkedC}
                  onChange={handleChange}
                  name="checkedC"
                  color="primary"
                />
              }
              label="Check this custom checkbox"
            />
          </Grid>
          <Grid item lg={4} md={6} sm={12}>
            <FormControl component="fieldset">
              <RadioGroup aria-label="gender" name="gender1" value={value} onChange={handleChange2}>
                <FormControlLabel
                  value="radio1"
                  control={<CustomRadio />}
                  label="Toggle this custom radio"
                />
                <FormControlLabel
                  value="radio2"
                  control={<CustomRadio />}
                  label="Toggle this custom radio"
                />
                <FormControlLabel
                  value="radio3"
                  control={<CustomRadio />}
                  label="Toggle this custom radio"
                />
              </RadioGroup>
            </FormControl>
          </Grid>
        </Grid>
        <CustomFormLabel htmlFor="standard-select-number">Select</CustomFormLabel>
        <CustomSelect
          fullWidth
          id="standard-select-number"
          variant="outlined"
          value={number}
          onChange={handleChange3}
          sx={{
            mb: 2,
          }}
        >
          {numbers.map((option) => (
            <MenuItem key={option.value} value={option.value}>
              {option.label}
            </MenuItem>
          ))}
        </CustomSelect>
        <div>
          <Button color="primary" variant="contained">
            Submit
          </Button>
        </div>
      </form>
    </ParentCard>
  );
};

export default FbDefaultForm;
