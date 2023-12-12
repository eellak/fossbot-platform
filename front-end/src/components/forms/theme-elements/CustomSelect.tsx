// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import React from 'react';
import { styled } from '@mui/material/styles';
import { Select } from '@mui/material';

const CustomSelect = styled((props: any) => <Select {...props} />)(({}) => ({}));

export default CustomSelect;
