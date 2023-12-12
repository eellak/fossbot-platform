import { Grid, InputAdornment, Button } from '@mui/material';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import React from 'react';
import CustomFormLabel from '../theme-elements/CustomFormLabel';
import CustomOutlinedInput from '../theme-elements/CustomOutlinedInput';
import { IconBuildingArch, IconMail, IconMessage2, IconPhone, IconUser } from '@tabler/icons-react';

const BasicIcons = () => {
  return (
    <div>
      {/* ------------------------------------------------------------------------------------------------ */}
      {/* Basic Layout */}
      {/* ------------------------------------------------------------------------------------------------ */}
      <Grid container>
        {/* 1 */}
        <Grid item xs={12}>
          <CustomFormLabel htmlFor="bi-name" sx={{ mt: 0 }}>
            Name
          </CustomFormLabel>
        </Grid>
        <Grid item xs={12}>
          <CustomOutlinedInput
            startAdornment={
              <InputAdornment position="start">
                <IconUser size="20" />
              </InputAdornment>
            }
            id="bi-name"
            placeholder="John Deo"
            fullWidth
          />
        </Grid>
        {/* 2 */}
        <Grid item xs={12}>
          <CustomFormLabel htmlFor="bi-company">
            Company
          </CustomFormLabel>
        </Grid>
        <Grid item xs={12}>
          <CustomOutlinedInput
            startAdornment={
              <InputAdornment position="start">
                <IconBuildingArch size="20" />
              </InputAdornment>
            }
            id="bi-company"
            placeholder="ACME Inc."
            fullWidth
          />
        </Grid>
        {/* 3 */}
        <Grid item xs={12}>
          <CustomFormLabel htmlFor="bi-email">
            Email
          </CustomFormLabel>
        </Grid>
        <Grid item xs={12}>
          <CustomOutlinedInput
            startAdornment={
              <InputAdornment position="start">
                <IconMail size="20" />
              </InputAdornment>
            }
            id="bi-email"
            placeholder="john.deo"
            fullWidth
          />
        </Grid>
        {/* 4 */}
        <Grid item xs={12}>
          <CustomFormLabel htmlFor="bi-phone">
            Phone No
          </CustomFormLabel>
        </Grid>
        <Grid item xs={12}>
          <CustomOutlinedInput
            startAdornment={
              <InputAdornment position="start">
                <IconPhone size="20" />
              </InputAdornment>
            }
            id="bi-phone"
            placeholder="412 2150 451"
            fullWidth
          />
        </Grid>
        {/* 5 */}
        <Grid item xs={12}>
          <CustomFormLabel htmlFor="bi-message">
            Message
          </CustomFormLabel>
        </Grid>
        <Grid item xs={12}>
          <CustomOutlinedInput
            id="bi-message"
            startAdornment={
              <InputAdornment position="start">
                <IconMessage2 size="20" />
              </InputAdornment>
            }
            placeholder="Hi, Do you  have a moment to talk Jeo ?"
            multiline
            fullWidth
          />
        </Grid>
        <Grid item xs={12} mt={3}>
          <Button variant="contained" color="primary">
            Send
          </Button>
        </Grid>
      </Grid>
    </div>
  );
};

export default BasicIcons;
