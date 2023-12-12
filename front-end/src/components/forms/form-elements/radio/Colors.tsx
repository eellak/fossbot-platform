// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import React from 'react';
import { Box, Radio } from '@mui/material';

const ColorsRadio = () => {
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
                color="primary"
                inputProps={{ 'aria-label': 'primary checkbox' }}
            />

            <Radio
                checked={checked}
                onChange={handleChange}
                color="secondary"
                inputProps={{ 'aria-label': 'primary checkbox' }}
            />

            <Radio
                checked={checked}
                onChange={handleChange}
                inputProps={{ 'aria-label': 'primary checkbox' }}
                sx={{
                    color: (theme) => theme.palette.success.main,
                    '&.Mui-checked': {
                        color: (theme) => theme.palette.success.main,
                    },
                }}
            />

            <Radio
                checked={checked}
                onChange={handleChange}
                inputProps={{ 'aria-label': 'primary checkbox' }}
                sx={{
                    color: (theme) => theme.palette.error.main,
                    '&.Mui-checked': {
                        color: (theme) => theme.palette.error.main,
                    },
                }}
            />

            <Radio
                checked={checked}
                onChange={handleChange}
                inputProps={{ 'aria-label': 'primary checkbox' }}
                sx={{
                    color: (theme) => theme.palette.warning.main,
                    '&.Mui-checked': {
                        color: (theme) => theme.palette.warning.main,
                    },
                }}
            />

        </Box>
    );
};

export default ColorsRadio;
