// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import React from 'react';
import {
  Box,
  Typography,
  CardMedia,
  styled,
} from '@mui/material';
import huabuilding from 'src/assets/images/backgrounds/hua_building.jpg';
import userimg from 'src/assets/images/profile/user-1.jpg';
// import {
//   IconBrandDribbble,
//   IconBrandFacebook,
//   IconBrandTwitter,
//   IconBrandYoutube,
//   IconFileDescription,
//   IconUserCheck,
//   IconUserCircle,
// } from '@tabler/icons-react';
// import ProfileTab from './ProfileTab';
import BlankCard from 'src/components/shared/BlankCard';
import { motion } from 'framer-motion';

const HuaBanner = () => {
  const ProfileImage = styled(Box)(() => ({
    backgroundImage: 'linear-gradient(#50b2fc,#f44c66)',
    borderRadius: '50%',
    width: '110px',
    height: '110px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 auto'
  }));

  return (
    
    <motion.div
            initial={{ opacity: 0, translateY: 550 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{
              type: 'spring',
              stiffness: 150,
              damping: 10,
            }}>
      <BlankCard>
      
        <CardMedia component="img" image={huabuilding} alt={huabuilding} width="100%"  sx={{
                mb: '-500px',
                mt: '-100px',

              }}/>
                

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
         
      
        
      <Box
      bgcolor={'dark blue'}
      border={"10px"}
      width={"100%"}
      height={"100px"}
      >
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
          }} >
          Harokopio University of Athens
    
          </Typography>
          </Box>
          </BlankCard>

      <Box
      sx={{
        pt: '10px',
        pl: '10%',
        pr: '10%'
      }}>

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
          }}>
          Harokopio University of Athens is a public university dedicated to promoting research
          and learning in a small, well focused set of intellectual areas. The university,
          situated in the centre of Athens and close to the Unesco World Heritage Centre of the Acropolis,
          originates from an educational institution that was first established in 1929 and
          gained the status of University in 1990. It takes its name from the national benefactor
          Panagis Harokopos. The University’s excellent campus facilities houses four academic
          departments, the central administration, the library, the IT centre and student advisory
          services. Harokopio University of Athens is located close to many important cultural
          sites of interest such as the Acropolis Museum, Thissio, Panathenaic Stadium (Kallimarmaron),
          Keramikos and the Benaki Museum.
        </Typography>
      </Box>
      </motion.div>
          


  );
};

export default HuaBanner;