// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import React from 'react';
import { useFormik } from 'formik';
import * as yup from 'yup';

import { Box, Button, Stack } from '@mui/material';

import CustomTextField from '../theme-elements/CustomTextField';
import CustomFormLabel from '../theme-elements/CustomFormLabel';

const validationSchema = yup.object({
  emailInstant: yup.string().email('Enter a valid email').required('Email is required'),
  passwordInstant: yup
    .string()
    .min(8, 'Password should be of minimum 8 characters length')
    .required('Password is required'),
});

const FVOnLeave = () => {
  const formik = useFormik({
    initialValues: {
      emailInstant: '',
      passwordInstant: '',
    },
    validationSchema,
    onSubmit: (values) => {
      alert(values.emailInstant);
    },
  });

  return (
    <form onSubmit={formik.handleSubmit}>
      <Stack>
        <Box mt="-10px">
          <CustomFormLabel>Email Address</CustomFormLabel>
          <CustomTextField
            fullWidth
            id="emailInstant"
            name="emailInstant"
            value={formik.values.emailInstant}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
            error={formik.touched.emailInstant && Boolean(formik.errors.emailInstant)}
            helperText={formik.touched.emailInstant && formik.errors.emailInstant}
          />
        </Box>
        <Box mb={3}>
          <CustomFormLabel>Password</CustomFormLabel>
          <CustomTextField
            fullWidth
            id="passwordInstant"
            name="passwordInstant"
            type="password"
            value={formik.values.passwordInstant}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
            error={formik.touched.passwordInstant && Boolean(formik.errors.passwordInstant)}
            helperText={formik.touched.passwordInstant && formik.errors.passwordInstant}
          />
        </Box>
        <Stack direction="row" justifyContent="flex-end">
          <Button variant="contained" type="submit">
            Submit
          </Button>
        </Stack>
      </Stack>
    </form>
  );
};

export default FVOnLeave;
