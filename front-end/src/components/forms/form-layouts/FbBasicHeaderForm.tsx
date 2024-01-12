 
import React from 'react';
import { Box, FormControlLabel, Button, Grid, MenuItem, FormControl, Alert } from '@mui/material';
import CustomTextField from '../theme-elements/CustomTextField';
import CustomSelect from '../theme-elements/CustomSelect';
import CustomRadio from '../theme-elements/CustomRadio';
import CustomFormLabel from '../theme-elements/CustomFormLabel';
import ParentCard from '../../shared/ParentCard';

interface currencyType {
  value: string;
  label: string;
}

const currencies: currencyType[] = [
  {
    value: 'female',
    label: 'Female',
  },
  {
    value: 'male',
    label: 'Male',
  },
  {
    value: 'other',
    label: 'Other',
  },
];

const countries: currencyType[] = [
  {
    value: 'india',
    label: 'India',
  },
  {
    value: 'uk',
    label: 'United Kingdom',
  },
  {
    value: 'srilanka',
    label: 'Srilanka',
  },
];

const FbBasicHeaderForm = () => {
  const [currency, setCurrency] = React.useState('');

  const handleChange2 = (event: React.ChangeEvent<HTMLInputElement>) => {
    setCurrency(event.target.value);
  };

  const [selectedValue, setSelectedValue] = React.useState('');

  const handleChange3 = (event: any) => {
    setSelectedValue(event.target.value);
  };

  const [country, setCountry] = React.useState('');

  const handleChange4 = (event: any) => {
    setCountry(event.target.value);
  };

  return (
    <div>
      {/* ------------------------------------------------------------------------------------------------ */}
      {/* Basic Checkbox */}
      {/* ------------------------------------------------------------------------------------------------ */}
      <ParentCard
        title="Basic Header Form"
        footer={
          <>
            <Button
              variant="contained"
              color="error"
              sx={{
                mr: 1,
              }}
            >
              Cancel
            </Button>
            <Button variant="contained" color="primary">
              Submit
            </Button>
          </>
        }
      >
        <>
          <Alert severity="info">Person Info</Alert>
          <form>
            <Grid container spacing={3} mb={3}>
              <Grid item lg={6} md={12} sm={12}>
                <CustomFormLabel htmlFor="fname-text">First Name</CustomFormLabel>
                <CustomTextField id="fname-text" variant="outlined" fullWidth />
                <CustomFormLabel htmlFor="standard-select-currency">Select Gender</CustomFormLabel>
                <CustomSelect
                  id="standard-select-currency"
                  value={currency}
                  onChange={handleChange2}
                  fullWidth
                  variant="outlined"
                >
                  {currencies.map((option) => (
                    <MenuItem key={option.value} value={option.value}>
                      {option.label}
                    </MenuItem>
                  ))}
                </CustomSelect>
                <CustomFormLabel>Membership</CustomFormLabel>

                <FormControl
                  sx={{
                    width: '100%',
                  }}
                >
                  <Box>
                    <FormControlLabel
                      checked={selectedValue === 'a'}
                      onChange={handleChange3}
                      value="a"
                      label="Free"
                      name="radio-button-demo"
                      control={<CustomRadio />}
                     
                    />
                    <FormControlLabel
                      checked={selectedValue === 'b'}
                      onChange={handleChange3}
                      value="b"
                      label="Paid"
                      control={<CustomRadio />}
                      name="radio-button-demo"
                    />
                  </Box>
                </FormControl>
              </Grid>
              <Grid item lg={6} md={12} sm={12}>
                <CustomFormLabel htmlFor="lname-text">Last Name</CustomFormLabel>

                <CustomTextField id="lname-text" variant="outlined" fullWidth />
                <CustomFormLabel htmlFor="date">Date of Birth</CustomFormLabel>

                <CustomTextField
                  id="date"
                  type="date"
                  variant="outlined"
                  fullWidth
                  InputLabelProps={{
                    shrink: true,
                  }}
                />
              </Grid>
            </Grid>
          </form>
          <Alert severity="info">Address</Alert>
          <Grid container spacing={3} mb={3} mt={1}>
            <Grid item lg={12} md={12} sm={12} xs={12}>
              <CustomFormLabel
                sx={{
                  mt: 0,
                }}
                htmlFor="street-text"
              >
                Street
              </CustomFormLabel>

              <CustomTextField id="street-text" variant="outlined" fullWidth />
            </Grid>
            <Grid item lg={6} md={12} sm={12} xs={12}>
              <CustomFormLabel
                sx={{
                  mt: 0,
                }}
                htmlFor="city-text"
              >
                City
              </CustomFormLabel>
              <CustomTextField id="city-text" variant="outlined" fullWidth />
            </Grid>
            <Grid item lg={6} md={12} sm={12} xs={12}>
              <CustomFormLabel
                sx={{
                  mt: 0,
                }}
                htmlFor="state-text"
              >
                State
              </CustomFormLabel>
              <CustomTextField id="state-text" variant="outlined" fullWidth />
            </Grid>
            <Grid item lg={6} md={12} sm={12} xs={12}>
              <CustomFormLabel
                sx={{
                  mt: 0,
                }}
                htmlFor="post-text"
              >
                Post Code
              </CustomFormLabel>
              <CustomTextField id="post-text" variant="outlined" fullWidth />
            </Grid>
            <Grid item lg={6} md={12} sm={12} xs={12}>
              <CustomFormLabel
                sx={{
                  mt: 0,
                }}
                htmlFor="country-text"
              >
                Country
              </CustomFormLabel>
              <CustomSelect
                id="country-select"
                value={country}
                onChange={handleChange4}
                fullWidth
                variant="outlined"
              >
                {countries.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </CustomSelect>
            </Grid>
          </Grid>
        </>
      </ParentCard>
    </div>
  );
};

export default FbBasicHeaderForm;
