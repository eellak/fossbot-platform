import { FC, useMemo } from 'react';
import { useSelector } from 'src/store/Store';
import { Link } from 'react-router-dom';
import { ReactComponent as LogoDark } from 'src/assets/images/logos/dark-logo.svg';
import { ReactComponent as LogoDarkRTL } from 'src/assets/images/logos/dark-rtl-logo.svg';
import { ReactComponent as LogoLight } from 'src/assets/images/logos/light-logo.svg';
import { ReactComponent as LogoLightRTL } from 'src/assets/images/logos/light-logo-rtl.svg';
import { Typography, styled } from '@mui/material';
import { AppState } from 'src/store/Store';
import { useTranslation } from 'react-i18next';

const Logo: FC<{ sidebar?: boolean }> = ({ sidebar = false }) => {
  const { t } = useTranslation();

  const customizer = useSelector((state: AppState) => state.customizer);
  const hideWordmark = sidebar && customizer.isCollapse && !customizer.isSidebarHover;
  const LinkStyled = useMemo(
    () => styled(Link)(() => ({
      height: customizer.TopbarHeight,
      width: 'auto',
      display: 'block',
    })),
    [customizer.TopbarHeight]
  );

  if (hideWordmark) return null;

  if (customizer.activeDir === 'ltr') {
    return (
      <LinkStyled
        to="/"
        style={{
          display: 'flex',
          alignItems: 'center',
        }}
      >
        {/* <Typography align={'center'} fontSize={18} lineHeight={40} color={'primary'} > FOSSBOT Platform</Typography> */}
        <Typography
          align={'center'}
          fontSize={20}
          lineHeight="40px"
          fontWeight={500}
          color={'primary'}
          sx={{ whiteSpace: 'nowrap' }}
        >
          <Typography component={'span'} variant="inherit" color={'primary'}>
            {t('foss')}
          </Typography>
          {''}
          <Typography component={'span'} variant="inherit" color={'orange'}>
            {t('bot')}
          </Typography>{' '}
          {t('platform')}
        </Typography>

        {/* {customizer.activeMode === 'dark' ? (
          <LogoLight  />
        ) : (
          <LogoDark  />
        )} */}
      </LinkStyled>
    );
  }

  return (
    <LinkStyled
      to="/"
      style={{
        display: 'flex',
        alignItems: 'center',
      }}
    >
      {/* <Typography align={'center'} fontSize={18} lineHeight={40} color={'primary'} > FOSSBOT Platform</Typography> */}
      <Typography align={'center'} fontSize={20} lineHeight="40px" fontWeight={500} color={'primary'} sx={{ whiteSpace: 'nowrap' }}>
        <Typography component={'span'} variant="inherit" color={'primary'}>
          {t('foss')}
        </Typography>
        {''}
        <Typography component={'span'} variant="inherit" color={'orange'}>
          {t('bot')}
        </Typography>{' '}
        {t('platform')}
      </Typography>
      {/* {customizer.activeMode === 'dark' ? (
        <LogoDarkRTL  />
      ) : (
        <LogoLightRTL  />
      )} */}
    </LinkStyled>
  );
};

export default Logo;
