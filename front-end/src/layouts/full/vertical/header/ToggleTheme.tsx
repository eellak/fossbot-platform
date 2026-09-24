import { IconMoon, IconSun } from '@tabler/icons-react';
import { IconButton, Tooltip } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'src/store/Store';
import type { AppState } from 'src/store/Store';
import { setDarkMode } from 'src/store/customizer/CustomizerSlice';

const ModeToggle = () => {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const isDark = useSelector((state: AppState) => state.customizer.activeMode === 'dark');
  const label = t(isDark ? 'theme.switchToLight' : 'theme.switchToDark');

  return (
    <Tooltip title={label} arrow>
      <IconButton
        aria-label={label}
        onClick={() => dispatch(setDarkMode(isDark ? 'light' : 'dark'))}
        sx={{ width: 44, height: 44, borderRadius: 1, color: 'text.secondary', '&:hover': { color: 'text.primary', bgcolor: 'action.hover' } }}
      >
        {isDark ? <IconSun size={20} aria-hidden="true" /> : <IconMoon size={20} aria-hidden="true" />}
      </IconButton>
    </Tooltip>
  );
};

export default ModeToggle;
