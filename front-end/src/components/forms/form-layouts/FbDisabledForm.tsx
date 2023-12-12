// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import React from 'react';
import { Box, Button } from '@mui/material';
import CustomTextField from '../theme-elements/CustomTextField';
import CustomFormLabel from '../theme-elements/CustomFormLabel';
import ParentCard from '../../shared/ParentCard';

const FbDisabledForm = () => (
  <ParentCard title="Disabled Form">
    <form>
      <CustomFormLabel
        sx={{
          mt: 0,
        }}
        htmlFor="df-name"
      >
        Name
      </CustomFormLabel>
      <CustomTextField
        id="df-name"
        variant="outlined"
        fullWidth
        disabled
      />
      <CustomFormLabel htmlFor="df-email-address">Email</CustomFormLabel>
      <CustomTextField
        id="df-email-address"
        helperText="We'll never share your email with anyone else."
        variant="outlined"
        fullWidth
        disabled
      />
      <CustomFormLabel htmlFor="df-outlined-password-input">Password</CustomFormLabel>
      <CustomTextField
        id="df-outlined-password-input"
        type="password"
        autoComplete="current-password"
        variant="outlined"
        fullWidth
        disabled
      />
      <Box mt={2}>
        <Button color="primary" variant="contained" disabled>
          Submit
        </Button>
      </Box>
    </form>
  </ParentCard>
);

export default FbDisabledForm;
