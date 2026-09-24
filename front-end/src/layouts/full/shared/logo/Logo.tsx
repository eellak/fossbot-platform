import { FC } from 'react';
import { Link } from 'react-router-dom';
import { Box, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'src/store/Store';
import type { AppState } from 'src/store/Store';

const Logo: FC = () => {
  const { t } = useTranslation();
  const { isCollapse, isSidebarHover, TopbarHeight } = useSelector((state: AppState) => state.customizer);
  const collapsed = isCollapse && !isSidebarHover;

  return (
    <Box
      component={Link}
      to="/"
      aria-label="FOSSBot"
      sx={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        height: TopbarHeight,
        width: { xs: 112, sm: collapsed ? 40 : 180 },
        overflow: 'hidden',
        flexShrink: 0,
        textDecoration: 'none',
        whiteSpace: 'nowrap',
      }}
    >
      <Typography component="span" sx={{ color: 'primary.main', fontSize: 20, fontWeight: 600, lineHeight: 1.2 }}>
        FOSSBot
      </Typography>
      <Typography component="span" sx={{ color: 'text.secondary', fontSize: 13, lineHeight: 1.3, display: { xs: 'none', sm: collapsed ? 'none' : 'block' } }}>
        {t('platform')}
      </Typography>
    </Box>
  );
};

export default Logo;
