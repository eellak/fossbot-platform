 
import React from 'react';
import { Box, Radio } from '@mui/material';

const DefaultRadio = () => {
    // 2
    const [checked, setChecked] = React.useState(true);

    const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        setChecked(event.target.checked);
    };

    return (
        <Box textAlign="center">
            <Radio
                checked={checked}
                onChange={handleChange}
                inputProps={{ 'aria-label': 'primary checkbox' }}
            />

            <Radio disabled inputProps={{ 'aria-label': 'disabled checked checkbox' }} />
            <Radio color="default" inputProps={{ 'aria-label': 'checkbox with default color' }} />
        </Box>
    );
};

export default DefaultRadio;
