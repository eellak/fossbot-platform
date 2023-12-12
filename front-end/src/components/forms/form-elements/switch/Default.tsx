// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import React from 'react';
import { Box, Switch } from '@mui/material';

const DefaultSwitch = () => (
    <Box textAlign="center">
        <Switch defaultChecked />
        <Switch />
        <Switch disabled defaultChecked />
        <Switch disabled />
    </Box>
);
export default DefaultSwitch;
