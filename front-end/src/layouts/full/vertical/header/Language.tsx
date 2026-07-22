 
import React from 'react';
import { Box, IconButton, Menu, MenuItem, Typography, Stack } from '@mui/material';
import { useSelector, useDispatch } from 'src/store/Store';
import { setLanguage } from 'src/store/customizer/CustomizerSlice';
import { useTranslation } from 'react-i18next';
import { useEffect } from 'react';
import { AppState } from 'src/store/Store';
import { Languages } from 'src/utils/languages/Languages';

const Language = () => {
  const [anchorEl, setAnchorEl] = React.useState(null);
  const dispatch = useDispatch();
  const open = Boolean(anchorEl);
  const customizer = useSelector((state: AppState) => state.customizer);
  const currentLang =
    Languages.find((_lang) => _lang.value === customizer.isLanguage) || Languages[1];
  const { i18n, t } = useTranslation();
  const handleClick = (event: any) => {
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
      <IconButton
        aria-label="more"
        id="long-button"
        aria-controls={open ? 'long-menu' : undefined}
        aria-expanded={open ? 'true' : undefined}
        aria-haspopup="true"
        onClick={handleClick}
      >
        <Box
          component="img"
          src={currentLang.icon}
          alt={currentLang.value}
          sx={{ width: 20, height: 20, borderRadius: '50%' }}
        />
      </IconButton>
      <Menu
        id="long-menu"
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
            sx={{ py: 2, px: 3 }}
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
