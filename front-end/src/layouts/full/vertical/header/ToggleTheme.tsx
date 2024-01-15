import React from 'react';
import { useDispatch } from 'react-redux';
import { ToggleButton, ToggleButtonGroup } from '@mui/material';
import WbSunnyTwoToneIcon from '@mui/icons-material/WbSunnyTwoTone';
import DarkModeTwoToneIcon from '@mui/icons-material/DarkModeTwoTone';
import { toggleSidebar, toggleMobileSidebar } from 'src/store/customizer/CustomizerSlice';
import { setDarkMode} from 'src/store/customizer/CustomizerSlice';

const ModeToggle = () => {
    const dispatch = useDispatch();
    let mode = String('light');

    const handleModeChange = (event, newMode) => {
        if (newMode === null) {
            // If newMode is null, keep the current mode
            newMode = mode;
        }
        dispatch(setDarkMode(newMode));
    };

    return (
        <ToggleButtonGroup
            value={mode}
            defaultValue={'light'}
            exclusive
            onChange={handleModeChange}
            aria-label="text alignment"
        >
            <ToggleButton value="light" aria-label="left aligned">
                <WbSunnyTwoToneIcon color={mode === 'light' ? 'primary' : 'inherit'} />
                Light
            </ToggleButton>
            <ToggleButton value="dark" aria-label="centered">
                <DarkModeTwoToneIcon color={mode === 'dark' ? 'primary' : 'inherit'} />
                Dark
            </ToggleButton>
        </ToggleButtonGroup>
    );
};

export default ModeToggle;
