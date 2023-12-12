// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import React from 'react';
import { Box, Button, Grid, IconButton, InputAdornment, MenuItem, Stack, Tab } from '@mui/material';
import TabContext from '@mui/lab/TabContext';
import TabList from '@mui/lab/TabList';
import TabPanel from '@mui/lab/TabPanel';

// components
import BlankCard from '../../shared/BlankCard';
import CustomFormLabel from '../theme-elements/CustomFormLabel';
import CustomSelect from '../theme-elements/CustomSelect';
import CustomTextField from '../theme-elements/CustomTextField';
import CustomOutlinedInput from '../theme-elements/CustomOutlinedInput';
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

const lang: countryType[] = [
  {
    value: 'en',
    label: 'English',
  },
  {
    value: 'fr',
    label: 'French',
  },
];

const FormTabs = () => {
  const [value, setValue] = React.useState('1');
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore  
  const handleChange = (event: React.SyntheticEvent, newValue: string) => {
    setValue(newValue);
  };

  //   country
  const [country, setCountry] = React.useState('');

  const handleChange2 = (event: React.ChangeEvent<HTMLInputElement>) => {
    setCountry(event.target.value);
  };

  //   language
  const [language, setLanguage] = React.useState('en');

  const handleChange3 = (event: React.ChangeEvent<HTMLInputElement>) => {
    setLanguage(event.target.value);
  };

  //   password
  //
  const [showPassword, setShowPassword] = React.useState(false);

  const handleClickShowPassword = () => setShowPassword((show) => !show);

  const handleMouseDownPassword = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
  };

  //   confirm password
  //
  const [showPassword2, setShowPassword2] = React.useState(false);

  const handleClickShowPassword2 = () => setShowPassword2((show) => !show);

  const handleMouseDownPassword2 = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
  };

  return (
    <div>
      {/* ------------------------------------------------------------------------------------------------ */}
      {/* Basic Layout */}
      {/* ------------------------------------------------------------------------------------------------ */}
      <BlankCard>
        <TabContext value={value}>
          <Box sx={{ borderBottom: 1, borderColor: (theme: any) => theme.palette.divider }}>
            <TabList onChange={handleChange} aria-label="lab API tabs example" variant="scrollable"
              scrollButtons="auto">
              <Tab label="Personal Info" value="1" />
              <Tab label="Account Details" value="2" />
              <Tab label="Social Links" value="3" />
            </TabList>
          </Box>
          <TabPanel value="1">
            <Grid container spacing={3}>
              <Grid item xs={12} lg={6}>
                <Grid container spacing={3}>
                  <Grid item xs={12} sm={3} display="flex" alignItems="center">
                    <CustomFormLabel htmlFor="ft-fname" sx={{ mt: 0, mb: { xs: '-10px', sm: 0 } }}>
                      First Name
                    </CustomFormLabel>
                  </Grid>
                  <Grid item xs={12} sm={9}>
                    <CustomTextField id="ft-fname" placeholder="John" fullWidth />
                  </Grid>
                  {/* 4 */}
                  <Grid item xs={12} sm={3} display="flex" alignItems="center">
                    <CustomFormLabel
                      htmlFor="ft-country"
                      sx={{ mt: 0, mb: { xs: '-10px', sm: 0 } }}
                    >
                      Country
                    </CustomFormLabel>
                  </Grid>
                  <Grid item xs={12} sm={9}>
                    <CustomSelect
                      id="standard-select-currency"
                      value={country}
                      onChange={handleChange2}
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
                  {/* 4 */}
                  <Grid item xs={12} sm={3} display="flex" alignItems="center">
                    <CustomFormLabel htmlFor="ft-date" sx={{ mt: 0, mb: { xs: '-10px', sm: 0 } }}>
                      Birth Date
                    </CustomFormLabel>
                  </Grid>
                  <Grid item xs={12} sm={9}>
                    <CustomTextField type="date" id="ft-date" placeholder="John Deo" fullWidth />
                  </Grid>
                </Grid>
              </Grid>
              {/* 2 column */}
              <Grid item xs={12} lg={6}>
                <Grid container spacing={3}>
                  <Grid item xs={12} sm={3} display="flex" alignItems="center">
                    <CustomFormLabel htmlFor="ft-fname" sx={{ mt: 0, mb: { xs: '-10px', sm: 0 } }}>
                      Last Name
                    </CustomFormLabel>
                  </Grid>
                  <Grid item xs={12} sm={9}>
                    <CustomTextField id="ft-fname" placeholder="Deo" fullWidth />
                  </Grid>
                  {/* 4 */}
                  <Grid item xs={12} sm={3} display="flex" alignItems="center">
                    <CustomFormLabel htmlFor="ft-lang" sx={{ mt: 0, mb: { xs: '-10px', sm: 0 } }}>
                      Language
                    </CustomFormLabel>
                  </Grid>
                  <Grid item xs={12} sm={9}>
                    <CustomSelect
                      value={language}
                      onChange={handleChange3}
                      fullWidth
                      variant="outlined"
                    >
                      {lang.map((option) => (
                        <MenuItem key={option.value} value={option.value}>
                          {option.label}
                        </MenuItem>
                      ))}
                    </CustomSelect>
                  </Grid>
                  {/* 4 */}
                  <Grid item xs={12} sm={3} display="flex" alignItems="center">
                    <CustomFormLabel htmlFor="ft-phone" sx={{ mt: 0, mb: { xs: '-10px', sm: 0 } }}>
                      Phone no
                    </CustomFormLabel>
                  </Grid>
                  <Grid item xs={12} sm={9}>
                    <CustomTextField id="ft-phone" placeholder="123 4567 201" fullWidth />
                  </Grid>
                </Grid>
              </Grid>
              <Grid item xs={12} sm={3}></Grid>
              <Grid item xs={12} sm={9}>
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
          </TabPanel>
          <TabPanel value="2">
            <Grid container spacing={3}>
              <Grid item xs={12} lg={6}>
                <Grid container spacing={3}>
                  <Grid item xs={12} sm={3} display="flex" alignItems="center">
                    <CustomFormLabel htmlFor="ft-uname" sx={{ mt: 0, mb: { xs: '-10px', sm: 0 } }}>
                      Username
                    </CustomFormLabel>
                  </Grid>
                  <Grid item xs={12} sm={9}>
                    <CustomTextField id="ft-uname" placeholder="John.Deo" fullWidth />
                  </Grid>
                  {/* 4 */}
                  <Grid item xs={12} sm={3} display="flex" alignItems="center">
                    <CustomFormLabel htmlFor="ft-pwd" sx={{ mt: 0, mb: { xs: '-10px', sm: 0 } }}>
                      Password
                    </CustomFormLabel>
                  </Grid>
                  <Grid item xs={12} sm={9}>
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
                </Grid>
              </Grid>
              {/* 2 column */}
              <Grid item xs={12} lg={6}>
                <Grid container spacing={3}>
                  <Grid item xs={12} sm={3} display="flex" alignItems="center">
                    <CustomFormLabel htmlFor="ft-email" sx={{ mt: 0, mb: { xs: '-10px', sm: 0 } }}>
                      Email
                    </CustomFormLabel>
                  </Grid>
                  <Grid item xs={12} sm={9}>
                    <CustomOutlinedInput
                      endAdornment={<InputAdornment position="end">@example.com</InputAdornment>}
                      id="fs-email"
                      placeholder="john.deo"
                      fullWidth
                    />
                  </Grid>
                  {/* 4 */}
                  <Grid item xs={12} sm={3} display="flex" alignItems="center">
                    <CustomFormLabel htmlFor="ft-lang" sx={{ mt: 0, mb: { xs: '-10px', sm: 0 } }}>
                      Confirm
                    </CustomFormLabel>
                  </Grid>
                  <Grid item xs={12} sm={9}>
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
                </Grid>
              </Grid>
              <Grid item xs={12} sm={3}></Grid>
              <Grid item xs={12} sm={9}>
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
          </TabPanel>
          <TabPanel value="3">
            <Grid container spacing={3}>
              <Grid item xs={12} lg={6}>
                <Grid container spacing={3}>
                  <Grid item xs={12} sm={3} display="flex" alignItems="center">
                    <CustomFormLabel
                      htmlFor="ft-twitter"
                      sx={{ mt: 0, mb: { xs: '-10px', sm: 0 } }}
                    >
                      Twitter
                    </CustomFormLabel>
                  </Grid>
                  <Grid item xs={12} sm={9}>
                    <CustomTextField
                      id="ft-twitter"
                      placeholder="https://twitter.com/abc"
                      fullWidth
                    />
                  </Grid>
                  <Grid item xs={12} sm={3} display="flex" alignItems="center">
                    <CustomFormLabel htmlFor="ft-google" sx={{ mt: 0, mb: { xs: '-10px', sm: 0 } }}>
                      Google
                    </CustomFormLabel>
                  </Grid>
                  <Grid item xs={12} sm={9}>
                    <CustomTextField
                      id="ft-google"
                      placeholder="https://plus.google.com/abc"
                      fullWidth
                    />
                  </Grid>
                  <Grid item xs={12} sm={3} display="flex" alignItems="center">
                    <CustomFormLabel htmlFor="ft-insta" sx={{ mt: 0, mb: { xs: '-10px', sm: 0 } }}>
                      Instagram
                    </CustomFormLabel>
                  </Grid>
                  <Grid item xs={12} sm={9}>
                    <CustomTextField
                      id="ft-insta"
                      placeholder="https://instagram.com/abc"
                      fullWidth
                    />
                  </Grid>
                </Grid>
              </Grid>
              <Grid item xs={12} lg={6}>
                <Grid container spacing={3}>
                  <Grid item xs={12} sm={3} display="flex" alignItems="center">
                    <CustomFormLabel htmlFor="ft-fb" sx={{ mt: 0, mb: { xs: '-10px', sm: 0 } }}>
                      Facebook
                    </CustomFormLabel>
                  </Grid>
                  <Grid item xs={12} sm={9}>
                    <CustomTextField id="ft-fb" placeholder="https://facebook.com/abc" fullWidth />
                  </Grid>
                  <Grid item xs={12} sm={3} display="flex" alignItems="center">
                    <CustomFormLabel
                      htmlFor="ft-linkedin"
                      sx={{ mt: 0, mb: { xs: '-10px', sm: 0 } }}
                    >
                      Linkedin
                    </CustomFormLabel>
                  </Grid>
                  <Grid item xs={12} sm={9}>
                    <CustomTextField
                      id="ft-linkedin"
                      placeholder="https://linkedin.com/abc"
                      fullWidth
                    />
                  </Grid>
                  <Grid item xs={12} sm={3} display="flex" alignItems="center">
                    <CustomFormLabel htmlFor="ft-quora" sx={{ mt: 0, mb: { xs: '-10px', sm: 0 } }}>
                      Quora
                    </CustomFormLabel>
                  </Grid>
                  <Grid item xs={12} sm={9}>
                    <CustomTextField id="ft-quora" placeholder="https://quora.com/abc" fullWidth />
                  </Grid>
                </Grid>
              </Grid>
              <Grid item xs={12} sm={3}></Grid>
              <Grid item xs={12} sm={9}>
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
          </TabPanel>
        </TabContext>
      </BlankCard>
    </div>
  );
};

export default FormTabs;
