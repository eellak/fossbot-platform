import React from 'react';
import BlankCard from 'src/components/shared/BlankCard';
import huabuilding from 'src/assets/images/backgrounds/hua_building.jpg';
import userimg from 'src/assets/images/profile/user-1.jpg';
import { Box, Typography, CardMedia, styled } from '@mui/material';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';

const HuaBanner = () => {
  const { t } = useTranslation();
  const ProfileImage = styled(Box)(() => ({
    backgroundImage: 'linear-gradient(#50b2fc,#f44c66)',
    borderRadius: '50%',
    width: '110px',
    height: '110px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 auto',
  }));

  return (
    <motion.div
      initial={{ opacity: 0, translateY: 550 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{
        type: 'spring',
        stiffness: 150,
        damping: 10,
      }}
    >
      <BlankCard>
        <CardMedia
          component="img"
          image={huabuilding}
          alt={huabuilding}
          width="100%"
          sx={{
            mb: '-500px',
            mt: '-100px',
          }}
        />

        {/* <Box
                display="absolute"
                alignItems="center"
                textAlign="center"
                justifyContent="center"
                sx={{
                  pt: '-1000px',
                }}
              >  
          
            
          </Box> */}

        <Box bgcolor={'dark blue'} border={'10px'} width={'100%'} height={'100px'}>
          <Typography
            variant="h1"
            fontWeight={900}
            color={'white'}
            sx={{
              pl: '10px',
              fontSize: {
                md: '54px',
              },
              lineHeight: {
                md: '60px',
              },
            }}
          >
            {t('harokopioUniversityOfAthens')}
          </Typography>
        </Box>
      </BlankCard>
      <Box
        sx={{
          pt: '10px',
          pl: '10%',
          pr: '10%',
        }}
      >
        <Typography
          variant="body1"
          fontWeight={400}
          sx={{
            fontSize: {
              xs: '1rem',
              sm: '1.1rem',
              md: '1.2rem',
            },
            lineHeight: {
              xs: '1.5',
              sm: '1.6',
              md: '1.7',
            },
            letterSpacing: '0.05em',
            textAlign: 'justify',
            textJustify: 'inter-word',
          }}
        >
          {t('hua-banner.haorkopioUniversityDescription')}
        </Typography>
      </Box>
    </motion.div>
  );
};

export default HuaBanner;
