// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import React from 'react';
import { Box, Switch } from '@mui/material';

const ColorsSwitch = () => (
    <Box textAlign="center">
        <Switch defaultChecked />
        <Switch defaultChecked color="secondary" />
        <Switch defaultChecked color="error" />
        <Switch defaultChecked color="warning" />
        <Switch defaultChecked color="success" />
        <Switch defaultChecked color="default" />
    </Box>
);
export default ColorsSwitch;
