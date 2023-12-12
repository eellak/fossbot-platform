// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import React from 'react';
import { useFormik } from 'formik';
import * as yup from 'yup';
import { Link } from 'react-router-dom';

import { Box, Button, Stack, FormGroup, FormControlLabel, Typography } from '@mui/material';

import CustomTextField from '../theme-elements/CustomTextField';
import CustomFormLabel from '../theme-elements/CustomFormLabel';
import CustomCheckbox from '../theme-elements/CustomCheckbox';

const validationSchema = yup.object({
  firstName: yup
    .string()
    .min(2, 'Too Short!')
    .max(50, 'Too Long!')
    .required('Firstname is Required'),
  lastName: yup.string().min(2, 'Too Short!').max(50, 'Too Long!').required('Lastname is Required'),
  email: yup.string().email('Enter a valid email').required('Email is required'),
  password: yup
    .string()
    .min(8, 'Password should be of minimum 8 characters length')
    .required('Password is required'),
  changepassword: yup.string().when('password', {
    is: (val: string) => (val && val.length > 0 ? true : false),
    then: yup.string().oneOf([yup.ref('password')], 'Both password need to be the same'),
  }),
});

const FVRegister = () => {
  const formik = useFormik({
    initialValues: {
      firstName: '',
      email: '',
      password: '',
      changepassword: '',
    },
    validationSchema: validationSchema,
    onSubmit: (values) => {
      alert(JSON.stringify(values, null, 2));
    },
  });

  return (
    <form onSubmit={formik.handleSubmit}>
      <Stack>
        <Box>
          <CustomFormLabel>Email Address</CustomFormLabel>
          <CustomTextField
            fullWidth
            id="email"
            name="email"
            value={formik.values.email}
            onChange={formik.handleChange}
            error={formik.touched.email && Boolean(formik.errors.email)}
            helperText={formik.touched.email && formik.errors.email}
          />
        </Box>
        <Box mb={3}>
          <CustomFormLabel>Password</CustomFormLabel>
          <CustomTextField
            fullWidth
            id="password"
            name="password"
            type="password"
            value={formik.values.password}
            onChange={formik.handleChange}
            error={formik.touched.password && Boolean(formik.errors.password)}
            helperText={formik.touched.password && formik.errors.password}
          />
        </Box>
      </Stack>
      <Stack justifyContent="space-between" direction="row" alignItems="center" mb={2}>
        <FormGroup>
          <FormControlLabel
            control={<CustomCheckbox defaultChecked />}
            label="Remeber this Device"
          />
        </FormGroup>
        <Typography
          component={Link}
          to="/auth/forgot-password"
          fontWeight={600}
          sx={{
            textDecoration: 'none',
            color: 'primary.main',
          }}
        >
          Forgot Password ?
        </Typography>
      </Stack>
      <Button color="primary" variant="contained" type="submit">
        Sign In
      </Button>
    </form>
  );
};

export default FVRegister;
