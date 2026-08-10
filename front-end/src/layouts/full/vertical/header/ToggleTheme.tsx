import React from 'react';
import WbSunnyTwoToneIcon from '@mui/icons-material/WbSunnyTwoTone';
import DarkModeTwoToneIcon from '@mui/icons-material/DarkModeTwoTone';

import { useDispatch, useSelector } from 'src/store/Store';
import { ToggleButton, ToggleButtonGroup } from '@mui/material';
import { setDarkMode } from 'src/store/customizer/CustomizerSlice';
import { useTranslation } from 'react-i18next';
import { AppState } from 'src/store/Store';

const ModeToggle = () => {
    const { t } = useTranslation();
    const dispatch = useDispatch();
    const mode = useSelector((state: AppState) => state.customizer.activeMode) || 'light';

    const handleModeChange = (_event: React.MouseEvent<HTMLElement>, newMode: string | null) => {
        if (newMode === null) return;
        dispatch(setDarkMode(newMode));
    };

    return (
        <ToggleButtonGroup
            value={mode}
            exclusive
            onChange={handleModeChange}
            aria-label={t('theme.mode')}
        >
            <ToggleButton value="light" aria-label={t('theme.light')}>
                <WbSunnyTwoToneIcon color={mode === 'light' ? 'primary' : 'inherit'} />
                {t('theme.light')}
            </ToggleButton>
            <ToggleButton value="dark" aria-label={t('theme.dark')}>
                <DarkModeTwoToneIcon color={mode === 'dark' ? 'primary' : 'inherit'} />
                {t('theme.dark')}
            </ToggleButton>
        </ToggleButtonGroup>
    );
};

export default ModeToggle;
