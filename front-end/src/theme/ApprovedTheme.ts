import type { ThemeOptions } from '@mui/material/styles';

export const approvedFontFamily = 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans", Arial, sans-serif';

export function approvedThemeOptions(dark: boolean): ThemeOptions {
  return {
    shape: { borderRadius: 8 },
    palette: {
      primary: { main: dark ? '#a9c3ff' : '#1e4fbf', light: dark ? '#263a61' : '#e6edff', dark: dark ? '#c4d6ff' : '#123b96', contrastText: dark ? '#14213b' : '#ffffff' },
      secondary: { main: dark ? '#a6b9d2' : '#485b75', light: dark ? '#253247' : '#edf1f6' },
      background: { default: dark ? '#101722' : '#eef2f7', paper: dark ? '#1c2635' : '#ffffff' },
      text: { primary: dark ? '#edf2fa' : '#202d40', secondary: dark ? '#b4c1d4' : '#53627a' },
      divider: dark ? '#52627a' : '#c8d2df',
      success: { main: dark ? '#83d9b0' : '#216b4a', light: dark ? '#203e34' : '#edf7f0', contrastText: dark ? '#13271e' : '#ffffff' },
      info: { main: dark ? '#a2c5ff' : '#315b91', light: dark ? '#23364d' : '#eef4fb' },
      warning: { main: dark ? '#f4c66a' : '#8a4b08', light: dark ? '#4b3918' : '#fff4dc', dark: dark ? '#ffd991' : '#623404', contrastText: dark ? '#2b1d05' : '#ffffff' },
      error: { main: dark ? '#ffb4ad' : '#b13932', light: dark ? '#422b2d' : '#fff0ee', contrastText: dark ? '#2a1211' : '#ffffff' },
    },
    typography: {
      fontFamily: approvedFontFamily,
      h1: { fontFamily: approvedFontFamily },
      h2: { fontFamily: approvedFontFamily },
      h3: { fontFamily: approvedFontFamily, fontSize: '1.5rem', lineHeight: 1.35 },
      h4: { fontFamily: approvedFontFamily },
      h5: { fontFamily: approvedFontFamily, fontSize: '1.125rem', lineHeight: 1.4, fontWeight: 600 },
      h6: { fontFamily: approvedFontFamily, fontSize: '0.875rem', lineHeight: 1.5 },
      subtitle1: { fontFamily: approvedFontFamily },
      subtitle2: { fontFamily: approvedFontFamily },
      body1: { fontFamily: approvedFontFamily, fontSize: '1rem', lineHeight: 1.5 },
      body2: { fontFamily: approvedFontFamily, fontSize: '0.875rem', lineHeight: 1.5 },
      caption: { fontFamily: approvedFontFamily, fontSize: '0.75rem', lineHeight: 1.5 },
      overline: { fontFamily: approvedFontFamily },
      button: { fontFamily: approvedFontFamily, fontSize: '0.875rem', fontWeight: 600, textTransform: 'none' },
    },
  };
}
