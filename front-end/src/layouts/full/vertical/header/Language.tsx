 
import React from 'react';
import { Box, Button, Menu, MenuItem, Typography, Stack } from '@mui/material';
import { useSelector, useDispatch } from 'src/store/Store';
import { setLanguage } from 'src/store/customizer/CustomizerSlice';
import { useTranslation } from 'react-i18next';
import { useEffect } from 'react';
import { AppState } from 'src/store/Store';
import { Languages } from 'src/utils/languages/Languages';

const Language = () => {
  const [anchorEl, setAnchorEl] = React.useState<HTMLElement | null>(null);
  const dispatch = useDispatch();
  const open = Boolean(anchorEl);
  const customizer = useSelector((state: AppState) => state.customizer);
  const currentLang =
    Languages.find((_lang) => _lang.value === customizer.isLanguage) || Languages[1];
  const { i18n, t } = useTranslation();
  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
  };
  const handleClose = () => {
    setAnchorEl(null);
  };
  useEffect(() => {
    i18n.changeLanguage(customizer.isLanguage);
  }, [customizer.isLanguage, i18n]);

  return (
    <>
      <Button
        id="language-button"
        aria-label={t('languageSelector')}
        aria-controls={open ? 'language-menu' : undefined}
        aria-expanded={open}
        aria-haspopup="true"
        onClick={handleClick}
        color="inherit"
        sx={{ minWidth: 0, gap: 1, whiteSpace: 'nowrap' }}
      >
        <Box
          component="img"
          src={currentLang.icon}
          alt=""
          sx={{ width: 20, height: 20, borderRadius: '50%' }}
        />
        <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>{t(currentLang.flagname)}</Box>
        <Box component="span" sx={{ display: { xs: 'inline', sm: 'none' } }}>{currentLang.value === 'gr' ? 'ΕΛ' : 'EN'}</Box>
      </Button>
      <Menu
        id="language-menu"
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        sx={{
          '& .MuiMenu-paper': {
            width: '200px',
          },
        }}
      >
        {Languages.map((option, index) => (
          <MenuItem
            key={index}
            selected={option.value === customizer.isLanguage}
            sx={{ py: 1.5, px: 2 }}
            onClick={() => {
              dispatch(setLanguage(option.value));
              handleClose();
            }}
          >
            <Stack direction="row" spacing={1} alignItems="center">
              <Box
                component="img"
                src={option.icon}
                alt={option.flagname}
                sx={{ width: 20, height: 20, borderRadius: '50%' }}
              />
              <Typography> {t(option.flagname)}</Typography>
            </Stack>
          </MenuItem>
        ))}
      </Menu>
    </>
  );
};

export default Language;
