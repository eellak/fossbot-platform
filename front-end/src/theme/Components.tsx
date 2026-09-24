// project imports
import './DefaultColors';
import { alpha, Theme } from '@mui/material/styles';

const components: any = (theme: Theme, approved = false) => {
  // One scrollbar treatment for the whole app: a thin, low-contrast thumb over a
  // transparent track. The standard properties win in Chromium and Firefox; the
  // WebKit pseudo-elements are the fallback for Safari.
  const scrollbarSize = 10;
  const scrollThumb = alpha(theme.palette.text.primary, theme.palette.mode === 'dark' ? 0.28 : 0.26);
  const scrollThumbHover = alpha(theme.palette.text.primary, theme.palette.mode === 'dark' ? 0.5 : 0.45);
  const result: any = {
    MuiCssBaseline: {
      styleOverrides: {
        '*': {
          boxSizing: 'border-box',
          scrollbarWidth: 'thin',
          scrollbarColor: `${scrollThumb} transparent`,
        },
        '*::-webkit-scrollbar': {
          width: scrollbarSize,
          height: scrollbarSize,
        },
        '*::-webkit-scrollbar-track, *::-webkit-scrollbar-corner': {
          backgroundColor: 'transparent',
        },
        '*::-webkit-scrollbar-thumb': {
          backgroundColor: scrollThumb,
          borderRadius: 999,
          border: '2px solid transparent',
          backgroundClip: 'content-box',
        },
        '*::-webkit-scrollbar-thumb:hover': {
          backgroundColor: scrollThumbHover,
        },
        // SimpleBar (the shared `custom-scroll/Scrollbar`) draws its own thumb, so match it
        // to the native thin scrollbar above instead of its default 11px black bar.
        '[data-simplebar] .simplebar-track.simplebar-vertical': {
          width: scrollbarSize,
        },
        '[data-simplebar] .simplebar-track.simplebar-horizontal': {
          height: scrollbarSize,
        },
        '.simplebar-track .simplebar-scrollbar:before': {
          backgroundColor: scrollThumb,
          borderRadius: 999,
        },
        '.simplebar-track .simplebar-scrollbar.simplebar-visible:before': {
          opacity: 1,
        },
        '.simplebar-track .simplebar-scrollbar.simplebar-visible:hover:before': {
          backgroundColor: scrollThumbHover,
        },
        html: {
          height: '100%',
          width: '100%',
        },
        a: {
          textDecoration: 'none',
        },
        body: {
          height: '100%',
          margin: 0,
          padding: 0,
        },
        '#root': {
          height: '100%',
          width: '100%',
        },
        "*[dir='rtl'] .buyNowImg": {
          transform: 'scaleX(-1)',
        },
        '.border-none': {
          border: '0px',
          td: {
            border: '0px',
          },
        },
        '.btn-xs': {
          minWidth: '30px !important',
          width: '30px',
          height: '30px',
          borderRadius: '6px !important',
          padding: '0px !important',
        },
        '.hover-text-primary:hover .text-hover': {
          color: theme.palette.primary.main,
        },
        '.hoverCard:hover': {
          scale: '1.01',
          transition: ' 0.1s ease-in',
        },
        '.signup-bg': {
          position: 'absolute',
          top: 0,
          right: 0,
          height: '100%',
        },
        '.MuiBox-root': {
          borderRadius: `var(--fossbot-box-border-radius, ${theme.shape.borderRadius}px)`,
        },
        '.MuiCardHeader-action': {
          alignSelf: 'center !important',
        },
        '.emoji-picker-react .emoji-scroll-wrapper': {
          overflowX: 'hidden',
        },
        '.scrollbar-container': {
          borderRight: '0 !important',
        },
        '.theme-timeline .MuiTimelineOppositeContent-root': {
          minWidth: '90px',
        },
        '.MuiAlert-root .MuiAlert-icon': {
          color: 'inherit!important',
        },
        '.MuiTimelineConnector-root': {
          width: '1px !important',
        },
        '@keyframes gradient': {
          '0%': {
            backgroundPosition: '0% 50%',
          },
          '50%': {
            backgroundPosition: ' 100% 50%',
          },
          '100% ': {
            backgroundPosition: ' 0% 50%',
          },
        },
      },
    },
    MuiButtonGroup: {
      styleOverrides: {
        root: {
          boxShadow: 'none',
        },
      },
    },
    MuiAccordion: {
      styleOverrides: {
        root: {
          ':before': {
            backgroundColor: theme.palette.grey[100],
          },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          // border: `1px solid ${theme.palette.grey[100]}`,
          backgroundImage: 'none',
        },
      },
    },
    MuiStepConnector: {
      styleOverrides: {
        line: {
          borderColor: theme.palette.grey[100],
        },
      },
    },
    MuiFab: {
      styleOverrides: {
        root: {
          boxShadow: 'none',
        },
        sizeSmall: {
          width: 30,
          height: 30,
          minHeight: 30,
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          boxShadow: 'none',
        },
        text: {
          padding: '5px 15px',
        },
        textPrimary: {
          backgroundColor: theme.palette.primary.light,
          '&:hover': {
            backgroundColor: theme.palette.primary.main,
            color: 'white',
          },
        },
        textSecondary: {
          backgroundColor: theme.palette.secondary.light,
          '&:hover': {
            backgroundColor: theme.palette.secondary.main,
            color: 'white',
          },
        },
        textSuccess: {
          backgroundColor: theme.palette.success.light,
          '&:hover': {
            backgroundColor: theme.palette.success.main,
            color: 'white',
          },
        },
        textError: {
          backgroundColor: theme.palette.error.light,
          '&:hover': {
            backgroundColor: theme.palette.error.main,
            color: 'white',
          },
        },
        textInfo: {
          backgroundColor: theme.palette.info.light,
          '&:hover': {
            backgroundColor: theme.palette.info.main,
            color: 'white',
          },
        },
        textWarning: {
          backgroundColor: theme.palette.warning.light,
          '&:hover': {
            backgroundColor: theme.palette.warning.main,
            color: 'white',
          },
        },
        outlinedPrimary: {
          '&:hover': {
            backgroundColor: theme.palette.primary.main,
            color: 'white',
          },
        },
        outlinedSecondary: {
          '&:hover': {
            backgroundColor: theme.palette.secondary.main,
            color: 'white',
          },
        },
        outlinedError: {
          '&:hover': {
            backgroundColor: theme.palette.error.main,
            color: 'white',
          },
        },
        outlinedSuccess: {
          '&:hover': {
            backgroundColor: theme.palette.success.main,
            color: 'white',
          },
        },
        outlinedInfo: {
          '&:hover': {
            backgroundColor: theme.palette.info.main,
            color: 'white',
          },
        },
        outlinedWarning: {
          '&:hover': {
            backgroundColor: theme.palette.warning.main,
            color: 'white',
          },
        },
      },
    },
    MuiCardHeader: {
      styleOverrides: {
        root: {
          padding: '16px 24px',
        },
        title: {
          fontSize: '1.125rem',
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          width: '100%',
          padding: '15px',
          backgroundImage: 'none',
        },
      },
    },
    MuiCardContent: {
      styleOverrides: {
        root: {
          padding: '24px',
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          borderBottom: `1px solid ${theme.palette.grey[100]}`,
        },
      },
    },
    MuiTableRow: {
      styleOverrides: {
        root: {
          '&:last-child td': {
            borderBottom: 0,
          },
        },
      },
    },
    MuiGridItem: {
      styleOverrides: {
        root: {
          paddingTop: '30px',
          paddingLeft: '30px !important',
        },
      },
    },
    MuiLinearProgress: {
      styleOverrides: {
        root: {
          backgroundColor: '#ecf0f2',
          borderRadius: '6px',
        },
      },
    },
    MuiTimelineConnector: {
      styleOverrides: {
        root: {
          backgroundColor: theme.palette.grey[100],
        },
      },
    },
    MuiDivider: {
      styleOverrides: {
        root: {
          borderColor: theme.palette.grey[100],
        },
      },
    },

    MuiChip: {
      styleOverrides: {
        root: {
          fontWeight: 600,
          fontSize: '0.75rem',
        },
      },
    },
    MuiAlert: {
      styleOverrides: {
        filledSuccess: {
          color: 'white',
        },
        filledInfo: {
          color: 'white',
        },
        filledError: {
          color: 'white',
        },
        filledWarning: {
          color: 'white',
        },
        standardSuccess: {
          backgroundColor: theme.palette.success.light,
          color: theme.palette.success.main,
        },
        standardError: {
          backgroundColor: theme.palette.error.light,
          color: theme.palette.error.main,
        },
        standardWarning: {
          backgroundColor: theme.palette.warning.light,
          color: theme.palette.warning.main,
        },
        standardInfo: {
          backgroundColor: theme.palette.info.light,
          color: theme.palette.info.main,
        },
        outlinedSuccess: {
          borderColor: theme.palette.success.main,
          color: theme.palette.success.main,
        },
        outlinedWarning: {
          borderColor: theme.palette.warning.main,
          color: theme.palette.warning.main,
        },
        outlinedError: {
          borderColor: theme.palette.error.main,
          color: theme.palette.error.main,
        },
        outlinedInfo: {
          borderColor: theme.palette.info.main,
          color: theme.palette.info.main,
        },
        successIcon: {
          color: theme.palette.info.main,
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-notchedOutline': {
            borderColor: theme.palette.grey[100],
          },
        },
        input: {
          padding: '12px 14px',
        },
        inputSizeSmall: {
          padding: '8px 14px',
        },
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          color: theme.palette.background.paper,
          background: theme.palette.text.primary,
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          borderLeft: `1px solid ${theme.palette.grey[100]}`,
          borderRight: `1px solid ${theme.palette.grey[100]}`,
        },
      },
    },
    MuiDialogTitle: {
      styleOverrides: {
        root: {
          fontSize: '1.25rem',
        },
      },
    },
    MuiPopover: {
      styleOverrides: {
        paper: {
          boxShadow: 'rgb(145 158 171 / 30%) 0px 0px 2px 0px, rgb(145 158 171 / 12%) 0px 12px 24px -4px'
        },
      },
    },
  };

  if (approved) {
    result.MuiCssBaseline.styleOverrides['.MuiBox-root'] = { borderRadius: 0 };
    result.MuiCssBaseline.styleOverrides['.visual-language-supporting-panel'] = { borderRadius: '8px' };
    result.MuiButtonBase = {
      styleOverrides: {
        root: {
          '&:focus-visible': { outline: `2px solid ${theme.palette.primary.main}`, outlineOffset: 3 },
        },
      },
    };
    result.MuiButton.styleOverrides = {
      ...result.MuiButton.styleOverrides,
      root: { minHeight: 40, borderRadius: 8, paddingLeft: 16, paddingRight: 16, fontWeight: 600, textTransform: 'none', boxShadow: 'none' },
      // MUI re-adds elevation for contained buttons in these states; the approved button spec is no shadow.
      contained: {
        '&:hover, &:active, &.Mui-focusVisible': { boxShadow: 'none' },
        '@media (hover: none)': { '&:hover': { boxShadow: 'none' } },
      },
      text: { backgroundColor: 'transparent', '&:hover': { backgroundColor: theme.palette.action.hover, color: theme.palette.primary.main } },
      textPrimary: { backgroundColor: 'transparent', '&:hover': { backgroundColor: theme.palette.action.hover, color: theme.palette.primary.main } },
      // Destructive text buttons keep the quiet red tint at rest and fill with error.main on hover.
      // The foreground must be error.contrastText, not a hardcoded white: dark-mode error.main is a light
      // red, so white-on-red would fall to ~1.7:1 in dark mode.
      textError: { backgroundColor: theme.palette.error.light, '&:hover': { backgroundColor: theme.palette.error.main, color: theme.palette.error.contrastText } },
      outlinedPrimary: { borderColor: theme.palette.divider, '&:hover': { backgroundColor: theme.palette.primary.light, color: theme.palette.primary.main, borderColor: theme.palette.primary.main } },
      outlinedError: { borderColor: theme.palette.divider, '&:hover': { backgroundColor: theme.palette.error.light, color: theme.palette.error.main, borderColor: theme.palette.error.main } },
    };
    // Unselected toggle labels use the approved secondary text role; MUI's default palette.action.active
    // (rgba(0,0,0,0.54)) falls short of 4.5:1 on the light page background.
    result.MuiToggleButton = {
      styleOverrides: {
        root: { color: theme.palette.text.secondary },
      },
    };
    // MUI's default checked switch leaves the track translucent behind a saturated
    // thumb, so it reads as a ball hanging off a pill. Fill the track and use the
    // contrasting thumb so the on/off state is unambiguous in both modes.
    result.MuiSwitch = {
      styleOverrides: {
        switchBase: {
          '&.Mui-checked': { color: theme.palette.primary.contrastText },
          '&.Mui-checked + .MuiSwitch-track': { backgroundColor: theme.palette.primary.main, opacity: 1 },
        },
        track: { borderRadius: 7 },
      },
    };
    result.MuiCard.styleOverrides.root = {
      ...result.MuiCard.styleOverrides.root,
      border: `1px solid ${theme.palette.divider}`,
      borderRadius: 8,
      boxShadow: 'none',
    };
    result.MuiCardContent.styleOverrides.root = { padding: 20, '&:last-child': { paddingBottom: 20 } };
    result.MuiDrawer.styleOverrides.paper = { borderLeft: `1px solid ${theme.palette.divider}`, borderRight: `1px solid ${theme.palette.divider}` };
    result.MuiAlert.styleOverrides.root = { borderRadius: 8, fontSize: '0.875rem' };
    result.MuiIconButton = {
      styleOverrides: {
        colorError: { '&:hover': { backgroundColor: theme.palette.error.light, color: theme.palette.error.main } },
      },
    };
    result.MuiOutlinedInput.styleOverrides.root = {
      '&:not(.Mui-focused):not(.Mui-error):not(.Mui-disabled) .MuiOutlinedInput-notchedOutline': { borderColor: theme.palette.divider },
      '&:hover:not(.Mui-focused):not(.Mui-error):not(.Mui-disabled) .MuiOutlinedInput-notchedOutline': { borderColor: theme.palette.text.secondary },
    };
  }

  return result;
};
export default components;
