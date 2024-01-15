 
import React from 'react';
import { Typography, Box, Button, Stack, styled, useMediaQuery, Theme } from '@mui/material';
import { IconRocket } from '@tabler/icons-react';


// third party

import { motion } from 'framer-motion';

const StyledButton = styled(Button)(() => ({
  padding: '13px 48px',
  fontSize: '16px',
}));

const BannerContent = () => {

  const lgDown = useMediaQuery((theme: Theme) => theme.breakpoints.down('lg'));
  
  return (
    <Box mt={lgDown ? 8 : 0}>
      <motion.div
        initial={{ opacity: 0, translateY: 550 }}
        animate={{ opacity: 1, translateY: 0 }}
        transition={{
          type: 'spring',
          stiffness: 150,
          damping: 30,
        }}
      >
        {/* <Typography variant="h6" display={'flex'} gap={1} mb={2}>
          <Typography color={'secondary'}>
            <IconRocket size={'21'} />
          </Typography>{' '}
          An Open Technologies robot for education
        </Typography> */}

        <Typography
          variant="h1"
          fontWeight={900}
          sx={{
            fontSize: {
              md: '54px',
            },
            lineHeight: {
              md: '60px',
            },
          }}
        >
          {/* Most powerful &{' '} */}
          <Typography component={'span'} variant="inherit" color={'primary'}>
            FOSS
          </Typography>{''}
          <Typography component={'span'} variant="inherit" color={'orange'}>
            Bot
          </Typography>{' '}
          an open technologies robot for education.
        </Typography>
      </motion.div>
      <Box pt={4} pb={3}>
        <motion.div
          initial={{ opacity: 0, translateY: 550 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{
            type: 'spring',
            stiffness: 150,
            damping: 30,
            delay: 0.2,
          }}
        >
          <Typography variant="h5" fontWeight={300}>
            Let's democratize robotics education! 
          </Typography>
        </motion.div>
      </Box>
      <motion.div
        initial={{ opacity: 0, translateY: 550 }}
        animate={{ opacity: 1, translateY: 0 }}
        transition={{
          type: 'spring',
          stiffness: 150,
          damping: 30,
          delay: 0.4,
        }}
      >
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} mt={3}>
          <StyledButton variant="contained" color="primary" href="/dashboard">
            Try it now
          </StyledButton>

          {/* <StyledButton variant="outlined" href="/dashboards/modern">
            Live Preview
          </StyledButton> */}
        </Stack>
      </motion.div>
    </Box>
  );
};

export default BannerContent;
