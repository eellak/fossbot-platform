// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import React from 'react';
import { useFormik } from 'formik';
import * as yup from 'yup';

import { Box, Button, Stack, FormHelperText, MenuItem } from '@mui/material';

import CustomFormLabel from '../theme-elements/CustomFormLabel';
import CustomSelect from '../theme-elements/CustomSelect';

const validationSchema = yup.object({
  age: yup.number().required('Age selection is required.'),
});

const FVSelect = () => {
  const formik = useFormik({
    initialValues: {
      age: '',
    },
    validationSchema,
    onSubmit: (values) => {
      alert(values.age);
    },
  });

  return (
    <form onSubmit={formik.handleSubmit}>
      <Stack>
        <Box mt="-10px" mb={3}>
          <CustomFormLabel>Age</CustomFormLabel>
          <CustomSelect
            labelId="age-select"
            id="age"
            fullWidth
            name="age"
            value={formik.values.age}
            onChange={formik.handleChange}
          >
            <MenuItem value="">
              <em>None</em>
            </MenuItem>
            <MenuItem value={10}>Ten</MenuItem>
            <MenuItem value={20}>Twenty</MenuItem>
            <MenuItem value={30}>Thirty</MenuItem>
          </CustomSelect>
          {formik.errors.age && (
            <FormHelperText error id="standard-weight-helper-text-email-login">
              {' '}
              {formik.errors.age}{' '}
            </FormHelperText>
          )}
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

export default FVSelect;
