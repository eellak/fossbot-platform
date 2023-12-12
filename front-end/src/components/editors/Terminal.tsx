import React from 'react';
import { TextField, Box } from '@mui/material';

type TerminalProps = {
    terminalOutput: string;
};

const Terminal = ({ terminalOutput }: TerminalProps) => (
    <Box >
        <TextField
            fullWidth
            multiline
            rows={17}
            value={terminalOutput}
            variant="outlined"
            inputProps={{ style: { color: 'white' } }}
            style={{ backgroundColor: 'black',border: '0px solid #fff' }}
        />
    </Box>
);

export default Terminal;