import React, { useEffect, useMemo } from 'react';
import { Box, CssBaseline, ThemeProvider, createTheme } from '@mui/material';
import { useSearchParams } from 'react-router-dom';
import FullLayout from 'src/layouts/full/FullLayout';
import { useDispatch, useSelector } from 'src/store/Store';
import { setDarkMode } from 'src/store/customizer/CustomizerSlice';
import { baselightTheme, baseDarkTheme } from 'src/theme/DefaultColors';
import { LightThemeColors } from 'src/theme/LightThemeColors';
import { DarkThemeColors } from 'src/theme/DarkThemeColors';
import { shadows, darkshadows } from 'src/theme/Shadows';
import typography from 'src/theme/Typography';
import components from 'src/theme/Components';
import { approvedThemeOptions } from 'src/theme/ApprovedTheme';

// Development-only experiment. The normal Dashboard never receives these styles.
export default function DashboardPreview({ proposed = false }: { proposed?: boolean }) {
  const [params] = useSearchParams();
  const dispatch = useDispatch();
  const customizer = useSelector((state) => state.customizer);
  const initialMode = params.get('mode') === 'dark' ? 'dark' : 'light';
  const mode = customizer.activeMode === 'dark' ? 'dark' : 'light';
  useEffect(() => {
    dispatch(setDarkMode(initialMode));
  }, [dispatch, initialMode]);
  useEffect(() => {
    const handleComparisonMode = (event: MessageEvent) => {
      if (event.source !== window.parent || event.data?.type !== 'ui-comparison-mode') return;
      dispatch(setDarkMode(event.data.mode === 'dark' ? 'dark' : 'light'));
    };
    window.addEventListener('message', handleComparisonMode);
    return () => window.removeEventListener('message', handleComparisonMode);
  }, [dispatch]);
  const theme = useMemo(() => {
    const dark = mode === 'dark';
    const base = dark ? baseDarkTheme : baselightTheme;
    const colors = (dark ? DarkThemeColors : LightThemeColors).find((item) => item.name === customizer.activeTheme);
    const result = createTheme({
      ...base,
      palette: { ...base.palette, ...colors?.palette, mode },
      shape: { borderRadius: customizer.borderRadius },
      typography,
      shadows: dark ? darkshadows : shadows,
    } as any);
    result.components = components(result);
    if (!proposed) return result;
    const proposal = createTheme(result, approvedThemeOptions(dark));
    proposal.components = components(proposal, true);
    return proposal;
  }, [mode, proposed, customizer.activeTheme, customizer.borderRadius]);
  return <ThemeProvider theme={theme}>
    <CssBaseline />
    <Box sx={proposed ? { minHeight: '100vh', bgcolor: 'background.default' } : undefined}>
      <FullLayout previewAppearance={proposed} />
    </Box>
  </ThemeProvider>;
}
