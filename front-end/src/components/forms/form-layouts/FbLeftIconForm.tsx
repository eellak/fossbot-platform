 
import React from 'react';
import {
  Button,
  FormControlLabel,
  FormControl,
  InputAdornment,
  OutlinedInput,
  Stack
} from '@mui/material';
import CustomCheckbox from '../theme-elements/CustomCheckbox';
import CustomFormLabel from '../theme-elements/CustomFormLabel';
import ParentCard from '../../shared/ParentCard';
import { IconLock, IconMail, IconUser } from '@tabler/icons-react';

const FbLeftIconForm = () => {
  const [state, setState] = React.useState({
    checkedA: false,
  });

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setState({ ...state, [event.target.name]: event.target.checked });
  };

  return (
    <ParentCard title='Form with Left Icon' footer={
      <>
        <Stack direction="row" spacing={2}>
          <Button
            color="primary"
            variant="contained">
            Submit
          </Button>
          <Button variant="contained" color="error">
            Cancel
          </Button>
        </Stack>

      </>
    }>
      <form>
        <FormControl fullWidth>
          <CustomFormLabel
            sx={{
              mt: 0,
            }}
            htmlFor="username-text"
          >
            Username
          </CustomFormLabel>
          <OutlinedInput
            startAdornment={
              <InputAdornment position="start">
                <IconUser width={20} />
              </InputAdornment>
            }
            id="username-text"
            placeholder="Username"
            fullWidth
          />
        </FormControl>
        {/* 2 */}
        <FormControl fullWidth>
          <CustomFormLabel htmlFor="mail-text">Email</CustomFormLabel>
          <OutlinedInput
            startAdornment={
              <InputAdornment position="start">
                <IconMail width={20} />
              </InputAdornment>
            }
            id="mail-text"
            placeholder="Email"
            fullWidth
          />
        </FormControl>
        {/* 3 */}
        <FormControl fullWidth>
          <CustomFormLabel htmlFor="pwd-text">Password</CustomFormLabel>
          <OutlinedInput
            type="password"
            startAdornment={
              <InputAdornment position="start">
                <IconLock width={20} />
              </InputAdornment>
            }
            id="pwd-text"
            placeholder="Password"
            fullWidth
          />
        </FormControl>

        <FormControl fullWidth>
          <CustomFormLabel htmlFor="cpwd-text">Confirm Password</CustomFormLabel>
          <OutlinedInput
            startAdornment={
              <InputAdornment position="start">
                <IconLock width={20} />
              </InputAdornment>
            }
            id="cpwd-text"
            placeholder="Confirm Password"
            fullWidth
          />
        </FormControl>

        <FormControlLabel
          control={
            <CustomCheckbox checked={state.checkedA} onChange={handleChange} name="checkedA" />
          }
          sx={{
            mt: '10px',
          }}
          label="Remember Me!"
        />
      </form>
    </ParentCard>
  );
};

export default FbLeftIconForm;
