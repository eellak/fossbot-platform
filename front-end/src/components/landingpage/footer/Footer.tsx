import React from 'react';
// import logoIcon from 'src/assets/images/logos/logoIcon.svg';
import logoIcon from 'src/assets/images/fossbot/logos-main/bot.png'
import { Grid, Link, Typography, Container } from '@mui/material';
import { useTranslation } from 'react-i18next';
import './Footer.css'; 

const Footer = () => {
  const { t } = useTranslation();

  return (
    <Container maxWidth="lg">
      <Grid container spacing={3} justifyContent="center" mt={0}>
        <Grid item xs={12} sm={5} lg={4} textAlign="center">
          <img src={logoIcon} alt="icon" width={'50px'} className="rotate-on-hover" />
          <Typography fontSize="16" color="textSecondary" mt={1} mb={4}>
            {t('footer.rights')}
            <Link target="_blank" href="https://hot.dit.hua.gr/">
              <Typography color="textSecondary" component="span" display="inline">
                {' '}
                {t('footer.fossbotTeam')}
              </Typography>{' '}
            </Link>
            .
          </Typography>
        </Grid>
      </Grid>
    </Container>
  );
};

export default Footer;
