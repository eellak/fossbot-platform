import { Grid, InputAdornment, Button } from '@mui/material';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import React , { useState } from 'react';
import CustomFormLabel from '../theme-elements/CustomFormLabel';
import CustomOutlinedInput from '../theme-elements/CustomOutlinedInput';
import { IconFileDescription, IconSourceCode, IconUser, IconFileTypography } from '@tabler/icons-react';

import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';

const NewProjectIcons = () => {

  const [selectedOption, setSelectedOption] = useState("Monaco");

  const handleChange = (event: any) => {
    setSelectedOption(event.target.value);
  };

  return (
    <div>
      {/* ------------------------------------------------------------------------------------------------ */}
      {/* Basic Layout */}
      {/* ------------------------------------------------------------------------------------------------ */}
      <Grid container spacing={3}>
        {/* 1 */}
        <Grid item xs={12} sm={3} display="flex" alignItems="center">
          <CustomFormLabel sx={{ mt: 0, mb: { xs: '-10px', sm: 0 } }}>
            Creator Name
          </CustomFormLabel>
        </Grid>
        <Grid item xs={12} sm={9}>
          <CustomOutlinedInput
            startAdornment={
              <InputAdornment position="start">
                <IconUser size="20" />
              </InputAdornment>
            }
            placeholder="John Deo"
            fullWidth
          />
        </Grid>
        {/* 2 */}
        <Grid item xs={12} sm={3} display="flex" alignItems="center">
          <CustomFormLabel sx={{ mt: 0, mb: { xs: '-10px', sm: 0 } }}>
            Project Name
          </CustomFormLabel>
        </Grid>
        <Grid item xs={12} sm={9}>
          <CustomOutlinedInput
            startAdornment={
              <InputAdornment position="start">
                <IconFileTypography size="20" />
              </InputAdornment>
            }
            placeholder="Give your project a name"
            fullWidth
          />
        </Grid>
        {/* 3 */}
        <Grid item xs={12} sm={3} display="flex" alignItems="center">
          <CustomFormLabel sx={{ mt: 0, mb: { xs: '-10px', sm: 0 } }}>
            Description
          </CustomFormLabel>
        </Grid>
        <Grid item xs={12} sm={9}>
          <CustomOutlinedInput
            startAdornment={
              <InputAdornment position="start">
                <IconFileDescription size="20" />
              </InputAdornment>
            }
            placeholder="Describe your project"
            fullWidth
          />
        </Grid>
        {/* 4 */}
        <Grid item xs={12} sm={3} display="flex" alignItems="center">
          <CustomFormLabel sx={{ mt: 0, mb: { xs: '-10px', sm: 0 } }}>
            Editor
          </CustomFormLabel>
        </Grid>
        <Grid item xs={12} sm={9}>
        <Select
            startAdornment={
              <InputAdornment position="start">
                <IconSourceCode size="20" />
              </InputAdornment>
            }
            fullWidth
            value={selectedOption}
            onChange={handleChange}
          >
            <MenuItem value={"Monaco"}>Monaco</MenuItem>
            <MenuItem value={"Blockly"}>Blockly</MenuItem>
          </Select>
        </Grid>
        <Grid item xs={12} sm={3}></Grid>
        <Grid item xs={12} sm={9}>
          <Button variant="contained" color="primary">
            Submit
          </Button>
        </Grid>
      </Grid>
    </div>
  );
};

export default NewProjectIcons;
