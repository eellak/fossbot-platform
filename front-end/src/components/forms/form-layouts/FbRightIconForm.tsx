// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
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
import { IconLock, IconUser, IconMail } from '@tabler/icons-react';

const FbRightIconForm = () => {
  const [state, setState] = React.useState({
    checkedB: false,
  });

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setState({ ...state, [event.target.name]: event.target.checked });
  };

  return (
    <ParentCard title="Form with Right Icon" footer={
      <>
        <Stack direction="row" spacing={1}>
          <Button
            color="primary"
            variant="contained"
          >
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
            htmlFor="username2-text"
          >
            Username
          </CustomFormLabel>
          <OutlinedInput
            endAdornment={
              <InputAdornment position="end">
                <IconUser width={20} />
              </InputAdornment>
            }
            id="username2-text"
            placeholder="Username"
            fullWidth
          />
        </FormControl>
        {/* 2 */}
        <FormControl fullWidth>
          <CustomFormLabel htmlFor="mail2-text">Email</CustomFormLabel>
          <OutlinedInput
            endAdornment={
              <InputAdornment position="end">
                <IconMail width={20} />
              </InputAdornment>
            }
            id="mail2-text"
            placeholder="Email"
            fullWidth
          />
        </FormControl>
        {/* 3 */}
        <FormControl fullWidth>
          <CustomFormLabel htmlFor="pwd2-text">Password</CustomFormLabel>
          <OutlinedInput
            type="password"
            endAdornment={
              <InputAdornment position="end">
                <IconLock width={20} />
              </InputAdornment>
            }
            id="pwd2-text"
            placeholder="Password"
            fullWidth
          />
        </FormControl>

        <FormControl fullWidth>
          <CustomFormLabel htmlFor="cpwd2-text">Confirm Password</CustomFormLabel>
          <OutlinedInput
            endAdornment={
              <InputAdornment position="end">
                <IconLock width={20} />
              </InputAdornment>
            }
            id="cpwd2-text"
            placeholder="Confirm Password"
            fullWidth
          />
        </FormControl>
        <FormControlLabel
          control={
            <CustomCheckbox checked={state.checkedB} onChange={handleChange} name="checkedB" />
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

export default FbRightIconForm;
