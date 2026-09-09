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

const proposalFontFamily = 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans", Arial, sans-serif';

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
    const proposal = createTheme(result, {
      shape: { borderRadius: 8 },
      palette: {
        primary: { main: dark ? '#a9c3ff' : '#1e4fbf', light: dark ? '#263a61' : '#e6edff', dark: dark ? '#c4d6ff' : '#123b96', contrastText: dark ? '#14213b' : '#ffffff' },
        secondary: { main: dark ? '#a6b9d2' : '#485b75', light: dark ? '#253247' : '#edf1f6' },
        background: { default: dark ? '#101722' : '#eef2f7', paper: dark ? '#1c2635' : '#ffffff' },
        text: { primary: dark ? '#edf2fa' : '#202d40', secondary: dark ? '#b4c1d4' : '#53627a' },
        divider: dark ? '#52627a' : '#d9e0ea',
        success: { main: dark ? '#83d9b0' : '#216b4a', light: dark ? '#203e34' : '#edf7f0', contrastText: dark ? '#13271e' : '#ffffff' },
        info: { main: dark ? '#a2c5ff' : '#315b91', light: dark ? '#23364d' : '#eef4fb' },
        warning: { main: dark ? '#f4c66a' : '#8a4b08', light: dark ? '#4b3918' : '#fff4dc', dark: dark ? '#ffd991' : '#623404', contrastText: dark ? '#2b1d05' : '#ffffff' },
        error: { main: dark ? '#ffb4ad' : '#b13932', light: dark ? '#422b2d' : '#fff0ee', contrastText: dark ? '#2a1211' : '#ffffff' },
      },
      typography: {
        fontFamily: proposalFontFamily,
        h1: { fontFamily: proposalFontFamily },
        h2: { fontFamily: proposalFontFamily },
        h3: { fontFamily: proposalFontFamily, fontSize: '1.5rem', lineHeight: 1.35 },
        h4: { fontFamily: proposalFontFamily },
        h5: { fontFamily: proposalFontFamily, fontSize: '1.125rem', lineHeight: 1.4, fontWeight: 600 },
        h6: { fontFamily: proposalFontFamily, fontSize: '0.875rem', lineHeight: 1.5 },
        subtitle1: { fontFamily: proposalFontFamily },
        subtitle2: { fontFamily: proposalFontFamily },
        body1: { fontFamily: proposalFontFamily, fontSize: '1rem', lineHeight: 1.5 },
        body2: { fontFamily: proposalFontFamily, fontSize: '0.875rem', lineHeight: 1.5 },
        caption: { fontFamily: proposalFontFamily, fontSize: '0.75rem', lineHeight: 1.5 },
        overline: { fontFamily: proposalFontFamily },
        button: { fontFamily: proposalFontFamily, fontSize: '0.875rem', fontWeight: 600, textTransform: 'none' },
      },
    });
    proposal.components = components(proposal);
    return proposal;
  }, [mode, proposed, customizer.activeTheme, customizer.borderRadius]);
  return <ThemeProvider theme={theme}>
    <CssBaseline />
    <Box sx={proposed ? {
      minHeight: '100vh', bgcolor: 'background.default',
      '& .MuiBox-root': { borderRadius: 0 },
      '& .visual-language-supporting-panel': { borderRadius: '8px' },
      '& .MuiCard-root': { border: '1px solid', borderColor: 'divider', borderRadius: '8px', boxShadow: 'none' },
      '& .MuiCardContent-root': { p: '20px', '&:last-child': { pb: '20px' } },
      '& .MuiAppBar-root': { borderBottom: '1px solid', borderColor: 'divider' },
      '& .MuiDrawer-paper': { borderRight: '1px solid', borderColor: 'divider' },
      '& .MuiButton-root': { minHeight: 40, borderRadius: '8px', px: 2, fontWeight: 600, boxShadow: 'none' },
      '& .MuiButton-text': { bgcolor: 'transparent', '&:hover': { bgcolor: 'action.hover', color: 'primary.main' } },
      '& .MuiButton-outlined': { borderColor: 'divider', '&:hover': { bgcolor: 'primary.light', color: 'primary.main', borderColor: 'primary.main' } },
      '& .MuiButton-outlinedError': { borderColor: 'divider', '&:hover': { bgcolor: 'error.light', color: 'error.main', borderColor: 'error.main' } },
      '& .MuiIconButton-colorError:hover': { bgcolor: 'error.light', color: 'error.main' },
      '& .MuiAlert-root': { borderRadius: '8px', fontSize: '0.875rem' },
      '& .MuiChip-root': { fontWeight: 600 },
      '& .MuiButtonBase-root:focus-visible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: 3 },
    } : undefined}>
      <FullLayout />
    </Box>
  </ThemeProvider>;
}
