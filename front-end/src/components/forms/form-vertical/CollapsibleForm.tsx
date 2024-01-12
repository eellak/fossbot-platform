 
import React from 'react';
import {
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Typography,
  Grid,
  FormControlLabel,
  RadioGroup,
  FormControl,
  InputAdornment,
  Stack,
  Button,
  MenuItem,
  Box
} from '@mui/material';
import { IconChevronDown, IconHelp } from '@tabler/icons-react';

// components
import CustomFormLabel from '../theme-elements/CustomFormLabel';
import CustomTextField from '../theme-elements/CustomTextField';
import CustomRadio from '../theme-elements/CustomRadio';
import CustomOutlinedInput from '../theme-elements/CustomOutlinedInput';
import CustomSelect from '../theme-elements/CustomSelect';

interface statType {
  value: string;
  label: string;
}

const states: statType[] = [
  {
    value: '1',
    label: 'Alaska',
  },
  {
    value: '2',
    label: 'Arizona',
  },
  {
    value: '3',
    label: 'Hawaii',
  },
];

const CollapsibleForm = () => {
  // address type
  const [value, setValue] = React.useState('');

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setValue(event.target.value);
  };

  //   delivery options
  const [value2, setValue2] = React.useState('');

  const handleChange2 = (event: React.ChangeEvent<HTMLInputElement>) => {
    setValue2(event.target.value);
  };

  //   payment
  const [value3, setValue3] = React.useState('radio1');

  const handleChange3 = (event: React.ChangeEvent<HTMLInputElement>) => {
    setValue3(event.target.value);
  };

  // states
  // language
  const [state, setStates] = React.useState('');

  const handleChange4 = (event: React.ChangeEvent<HTMLInputElement>) => {
    setStates(event.target.value);
  };

  // default open slide
  const [expanded, setExpanded] = React.useState<string | false>('panel1');

  const handleChange5 =
    (panel: string) => (event: React.SyntheticEvent, newExpanded: boolean) => {
      setExpanded(newExpanded ? panel : false);
    };

  return (
    <div>
      {/* ------------------------------------------------------------------------------------------------ */}
      {/* Basic Layout */}
      {/* ------------------------------------------------------------------------------------------------ */}
      <Accordion elevation={9} sx={{ mb: 2 }} expanded={expanded === 'panel1'} onChange={handleChange5('panel1')}>
        <AccordionSummary
          expandIcon={<IconChevronDown size="20" />}
          aria-controls="panel1a-content"
          id="panel1a-header"
        >
          <Typography variant="h6">Delivery Address</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Grid container spacing={3}>
            <Grid item xs={12} sm={6}>
              <CustomFormLabel htmlFor="cs-fname" sx={{ mt: 0 }}>
                Full Name
              </CustomFormLabel>
              <CustomTextField id="cs-fname" placeholder="John Deo" fullWidth />
            </Grid>
            <Grid item xs={12} sm={6}>
              <CustomFormLabel htmlFor="cs-phone" sx={{ mt: 0 }}>
                Phone no
              </CustomFormLabel>
              <CustomTextField id="cs-phone" placeholder="1340 2154 123" fullWidth />
            </Grid>
            <Grid item xs={12}>
              <CustomFormLabel htmlFor="cs-address" sx={{ mt: 0 }}>
                Address
              </CustomFormLabel>
              <CustomTextField multiline id="cs-address" placeholder="150, Ring Road" fullWidth />
            </Grid>
            <Grid item xs={12} sm={6}>
              <CustomFormLabel htmlFor="cs-pin" sx={{ mt: 0 }}>
                Pincode
              </CustomFormLabel>
              <CustomTextField id="cs-pin" placeholder="120125" fullWidth />
            </Grid>
            <Grid item xs={12} sm={6}>
              <CustomFormLabel htmlFor="cs-landmark" sx={{ mt: 0 }}>
                Landmark
              </CustomFormLabel>
              <CustomTextField id="cs-landmark" placeholder="Nr. Wall Street" fullWidth />
            </Grid>
            <Grid item xs={12} sm={6}>
              <CustomFormLabel htmlFor="cs-city" sx={{ mt: 0 }}>
                City
              </CustomFormLabel>
              <CustomTextField id="cs-city" placeholder="Jackson" fullWidth />
            </Grid>
            <Grid item xs={12} sm={6}>
              <CustomFormLabel htmlFor="cs-state" sx={{ mt: 0 }}>
                State
              </CustomFormLabel>
              <CustomSelect value={state} onChange={handleChange4} fullWidth variant="outlined">
                {states.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </CustomSelect>
            </Grid>
            <Grid item xs={12}>
              <CustomFormLabel htmlFor="cs-addr" sx={{ mt: 0 }}>
                Address Type
              </CustomFormLabel>
              <FormControl component="fieldset">
                <RadioGroup row name="cs-addr" value={value} onChange={handleChange}>
                  <FormControlLabel
                    value="radio1"
                    control={<CustomRadio />}
                    label="Home (All day delivery)"
                  />
                  <FormControlLabel
                    value="radio2"
                    control={<CustomRadio />}
                    label="
                        Office (Delivery between 10 AM - 5 PM)"
                  />
                </RadioGroup>
              </FormControl>
            </Grid>
          </Grid>
        </AccordionDetails>
      </Accordion>
      <Accordion elevation={9} sx={{ mb: 2 }} expanded={expanded === 'panel2'} onChange={handleChange5('panel2')}>
        <AccordionSummary
          expandIcon={<IconChevronDown size="20" />}
          aria-controls="panel2a-content"
          id="panel2a-header"
        >
          <Typography variant="h6">Delivery Options</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <RadioGroup row name="delivery-opt" value={value2} onChange={handleChange2}>
            <FormControlLabel value="radio1" control={<CustomRadio />} label="Standard 3-5 Days" />
            <FormControlLabel value="radio2" control={<CustomRadio />} label="Express" />
            <FormControlLabel value="radio3" control={<CustomRadio />} label="Overnight" />
          </RadioGroup>
        </AccordionDetails>
      </Accordion>
      <Accordion elevation={9} sx={{ mb: 2 }} expanded={expanded === 'panel3'} onChange={handleChange5('panel3')}>
        <AccordionSummary
          expandIcon={<IconChevronDown size="20" />}
          aria-controls="panel3a-content"
          id="panel3a-header"
        >
          <Typography variant="h6">Payment Method</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Grid container spacing={3}>
            <Grid item xs={12} sm={8}>
              <RadioGroup row name="payment-method" value={value3} onChange={handleChange3}>
                <FormControlLabel
                  value="radio1"
                  control={<CustomRadio />}
                  label="Credit/Debit/ATM Card"
                />
                <FormControlLabel
                  value="radio2"
                  control={<CustomRadio />}
                  label="Cash on Delivery"
                />
              </RadioGroup>
            </Grid>
            <Grid item xs={12} sm={8}>
              <Box>
                <Grid container spacing={3}>
                  <Grid item xs={12}>
                    <CustomFormLabel htmlFor="cs-co" sx={{ mt: 0 }}>
                      Card Number
                    </CustomFormLabel>
                    <CustomTextField id="cs-co" placeholder="1250 4521 5630 1540" fullWidth />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <CustomFormLabel htmlFor="cs-name" sx={{ mt: 0 }}>
                      Name
                    </CustomFormLabel>
                    <CustomTextField id="cs-name" placeholder="John Deo" fullWidth />
                  </Grid>
                  <Grid item xs={12} sm={3}>
                    <CustomFormLabel htmlFor="cs-exdate" sx={{ mt: 0 }}>
                      Exp. Date
                    </CustomFormLabel>
                    <CustomTextField id="cs-exdate" placeholder="MM/YY" fullWidth />
                  </Grid>
                  <Grid item xs={12} sm={3}>
                    <CustomFormLabel htmlFor="cs-code" sx={{ mt: 0 }}>
                      CCV Code
                    </CustomFormLabel>
                    <CustomOutlinedInput
                      id="cs-code"
                      placeholder="456"
                      fullWidth
                      endAdornment={
                        <InputAdornment position="end">
                          <IconHelp width="20" />
                        </InputAdornment>
                      }
                    />
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
              </Box>
            </Grid>
          </Grid>
        </AccordionDetails>
      </Accordion>
    </div>
  );
};

export default CollapsibleForm;
