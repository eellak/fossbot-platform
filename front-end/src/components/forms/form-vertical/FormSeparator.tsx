import {
  Grid,
  InputAdornment,
  Button,
  Typography,
  Divider,
  MenuItem,
  IconButton,
  Stack
} from '@mui/material';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import React from 'react';
import CustomFormLabel from '../theme-elements/CustomFormLabel';
import CustomTextField from '../theme-elements/CustomTextField';
import CustomOutlinedInput from '../theme-elements/CustomOutlinedInput';
import CustomSelect from '../theme-elements/CustomSelect';
import { IconEye, IconEyeOff } from '@tabler/icons-react';

interface countryType {
  value: string;
  label: string;
}

const countries: countryType[] = [
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

const lang: countryType[]  = [
  {
    value: 'en',
    label: 'English',
  },
  {
    value: 'fr',
    label: 'French',
  },
];

const FormSeparator = () => {
  // country
  const [country, setCountry] = React.useState('');

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setCountry(event.target.value);
  };

  // language
  const [language, setLanguage] = React.useState('');

  const handleChange2 = (event: React.ChangeEvent<HTMLInputElement>) => {
    setLanguage(event.target.value);
  };

  //   password
  //
  const [showPassword, setShowPassword] = React.useState(false);

  const handleClickShowPassword = () => setShowPassword((show) => !show);

  const handleMouseDownPassword = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
  };

  //  confirm  password
  //
  const [showPassword2, setShowPassword2] = React.useState(false);

  const handleClickShowPassword2 = () => setShowPassword2((show) => !show);

  const handleMouseDownPassword2 = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
  };

  return (
    <div>
      <Typography variant="h6" mb={3}>
        Account Details
      </Typography>
      {/* ------------------------------------------------------------------------------------------------ */}
      {/* Basic Layout */}
      {/* ------------------------------------------------------------------------------------------------ */}
      <Grid container spacing={3}>
        <Grid item xs={12} sm={6}>
          <CustomFormLabel htmlFor="fs-uname" sx={{ mt: 0 }}>
            Username
          </CustomFormLabel>
          <CustomTextField id="fs-uname" placeholder="John Deo" fullWidth />

          <CustomFormLabel htmlFor="fs-pwd">Password</CustomFormLabel>
          <CustomOutlinedInput
            type={showPassword ? 'text' : 'password'}
            endAdornment={
              <InputAdornment position="end">
                <IconButton
                  aria-label="toggle password visibility"
                  onClick={handleClickShowPassword}
                  onMouseDown={handleMouseDownPassword}
                  edge="end"
                >
                  {showPassword ? <IconEyeOff size="20" /> : <IconEye size="20" />}
                </IconButton>
              </InputAdornment>
            }
            id="fs-pwd"
            placeholder="john.deo"
            fullWidth
          />
        </Grid>
        <Grid item xs={12} sm={6}>
          <CustomFormLabel htmlFor="fs-email" sx={{ mt: { sm: 0 } }}>
            Email
          </CustomFormLabel>
          <CustomOutlinedInput
            endAdornment={<InputAdornment position="end">@example.com</InputAdornment>}
            id="fs-email"
            placeholder="john.deo"
            fullWidth
          />
          <CustomFormLabel htmlFor="fs-pwd">Confirm Password</CustomFormLabel>
          <CustomOutlinedInput
            type={showPassword2 ? 'text' : 'password'}
            endAdornment={
              <InputAdornment position="end">
                <IconButton
                  aria-label="toggle password visibility"
                  onClick={handleClickShowPassword2}
                  onMouseDown={handleMouseDownPassword2}
                  edge="end"
                >
                  {showPassword2 ? <IconEyeOff size="20" /> : <IconEye size="20" />}
                </IconButton>
              </InputAdornment>
            }
            id="fs-pwd"
            placeholder="john.deo"
            fullWidth
          />
        </Grid>

        <Grid item xs={12}>
          <Divider sx={{ mx: '-24px' }} />
          <Typography variant="h6" mt={2}>
            Personal Info
          </Typography>
        </Grid>

        <Grid item xs={12} sm={6}>
          <CustomFormLabel htmlFor="fs-fname" sx={{ mt: 0 }}>
            First Name
          </CustomFormLabel>
          <CustomTextField id="fs-fname" placeholder="John" fullWidth />
          <CustomFormLabel htmlFor="fs-country">Country</CustomFormLabel>
          <CustomSelect
            id="standard-select-currency"
            value={country}
            onChange={handleChange}
            fullWidth
            variant="outlined"
          >
            {countries.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </CustomSelect>
          <CustomFormLabel htmlFor="fs-date">Birth Date</CustomFormLabel>
          <CustomTextField type="date" id="fs-date" placeholder="John Deo" fullWidth />
        </Grid>

        <Grid item xs={12} sm={6}>
          <CustomFormLabel htmlFor="fs-lname" sx={{ mt: { sm: 0 } }}>
            Last Name
          </CustomFormLabel>
          <CustomTextField id="fs-lname" placeholder="Deo" fullWidth />
          <CustomFormLabel htmlFor="fs-language">Language</CustomFormLabel>
          <CustomSelect value={language} onChange={handleChange2} fullWidth variant="outlined">
            {lang.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </CustomSelect>

          <CustomFormLabel htmlFor="fs-phone">Phone no</CustomFormLabel>
          <CustomTextField id="fs-phone" placeholder="123 4567 201" fullWidth />
        </Grid>

        <Grid item xs={12}>
          <Stack direction="row" spacing={2}>
            <Button variant="contained" color="primary">
              Submit
            </Button>
            <Button variant="text" color="error">
              Cancel
            </Button>
          </Stack>
        </Grid>
      </Grid>
    </div>
  );
};

export default FormSeparator;
