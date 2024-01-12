import { FC } from 'react';
import { useSelector } from 'src/store/Store';
import { Link } from 'react-router-dom';
 

// import { ReactComponent as LogoDark } from 'src/assets/images/fossbot/g8.svg';
import { ReactComponent as LogoDark } from 'src/assets/images/logos/dark-logo.svg';
 
import { ReactComponent as LogoDarkRTL } from 'src/assets/images/logos/dark-rtl-logo.svg';
 
import { ReactComponent as LogoLight } from 'src/assets/images/logos/light-logo.svg';
// import { ReactComponent as LogoLight } from 'src/assets/images/fossbot/g8.svg';
 
import { ReactComponent as LogoLightRTL } from 'src/assets/images/logos/light-logo-rtl.svg';
import { Typography, styled } from '@mui/material';
import { AppState } from 'src/store/Store';

const Logo: FC = () => {
  const customizer = useSelector((state: AppState) => state.customizer);
  const LinkStyled = styled(Link)(() => ({
    height: customizer.TopbarHeight,
    width: customizer.isCollapse ? '40px' : '180px',
    overflow: 'hidden',
    display: 'block',
  }));

  if (customizer.activeDir === 'ltr') {
    return (
      <LinkStyled to="/" style={{
        display: 'flex',
        alignItems: 'center',
      }}>
        <Typography align={'center'} fontSize={18} lineHeight={40} fontWeight={1000} color={'primary'} > FOSSBOT Platform</Typography>
        {/* {customizer.activeMode === 'dark' ? (
          <LogoLight  />
        ) : (
          <LogoDark  />
        )} */}
      </LinkStyled>
    );
  }

  return (
    <LinkStyled to="/" style={{
      display: 'flex',
      alignItems: 'center',
    }}>
      <Typography align={'center'} fontSize={18} lineHeight={40} fontWeight={1000} color={'primary'} > FOSSBOT Platform</Typography>
      {/* {customizer.activeMode === 'dark' ? (
        <LogoDarkRTL  />
      ) : (
        <LogoLightRTL  />
      )} */}
    </LinkStyled>
  );
};

export default Logo;
