// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import React from 'react';
import {
  Grid,
  Box,
  Typography,
  Button,
  Avatar,
  Stack,
  CardMedia,
  styled,
  Fab,
  Card
} from '@mui/material';
import huabuilding from 'src/assets/images/backgrounds/hua_building.jpg';
import userimg from 'src/assets/images/profile/user-1.jpg';
import {
  IconBrandDribbble,
  IconBrandFacebook,
  IconBrandTwitter,
  IconBrandYoutube,
  IconFileDescription,
  IconUserCheck,
  IconUserCircle,
} from '@tabler/icons-react';
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
      
      fontWeight={1}>
          There are many variations of passages of Lorem Ipsum available, 
          but the majority have suffered alteration in some form, by injected humour,
          or randomised words which don't look even slightly believable. If you are 
          going to use a passage of Lorem Ipsum, you need to be sure there isn't anything 
          embarrassing hidden in the middle of text. All the Lorem Ipsum generators on the 
          Internet tend to repeat predefined chunks as necessary, making this the first true 
          generator on the Internet. It uses a dictionary of over 200 Latin words, combined with a
            handful of model sentence structures, to generate Lorem Ipsum which looks reasonable. 
            The generated Lorem Ipsum is therefore 
          always free from repetition, injected humour, 
          or non-characteristic words etc.
          </Typography>
      </Box>
      </motion.div>
          


  );
};

export default HuaBanner;