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
} from '@mui/material';
import profilecover from 'src/assets/images/backgrounds/profilebg.jpg';
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
import ProfileTab from './ProfileTab';
import BlankCard from '../../shared/BlankCard';

const ProfileBanner = () => {
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
    <>
      <BlankCard>
        <CardMedia component="img" image={profilecover} alt={profilecover} width="100%" />
        <Grid container spacing={0} justifyContent="center" alignItems="center">
          {/* Post | Followers | Following */}
          <Grid
            item
            lg={4}
            sm={12}
            md={5}
            xs={12}
            sx={{
              order: {
                xs: '2',
                sm: '2',
                lg: '1',
              },
            }}
          >
            <Stack direction="row" textAlign="center" justifyContent="center" gap={6} m={3}>
              <Box>
                <Typography color="text.secondary">
                  <IconFileDescription width="20" />
                </Typography>
                <Typography variant="h4" fontWeight="600">
                  938
                </Typography>
                <Typography color="textSecondary" variant="h6" fontWeight={400}>
                  Posts
                </Typography>
              </Box>
              <Box>
                <Typography color="text.secondary">
                  <IconUserCircle width="20" />
                </Typography>
                <Typography variant="h4" fontWeight="600">
                  3,586
                </Typography>
                <Typography color="textSecondary" variant="h6" fontWeight={400}>
                  Followers
                </Typography>
              </Box>
              <Box>
                <Typography color="text.secondary">
                  <IconUserCheck width="20" />
                </Typography>
                <Typography variant="h4" fontWeight="600">
                  2,659
                </Typography>
                <Typography color="textSecondary" variant="h6" fontWeight={400}>
                  Following
                </Typography>
              </Box>
            </Stack>
          </Grid>
          {/* about profile */}
          <Grid
            item
            lg={4}
            sm={12}
            xs={12}
            sx={{
              order: {
                xs: '1',
                sm: '1',
                lg: '2',
              },
            }}
          >
            <Box
              display="flex"
              alignItems="center"
              textAlign="center"
              justifyContent="center"
              sx={{
                mt: '-85px',
              }}
            >
              <Box>
                <ProfileImage>
                  <Avatar
                    src={userimg}
                    alt={userimg}
                    sx={{
                      borderRadius: '50%',
                      width: '100px',
                      height: '100px',
                      border: '4px solid #fff',
                    }}
                  />
                </ProfileImage>
                <Box mt={1}>
                  <Typography fontWeight={600} variant="h5">
                  Mathew Anderson
                  </Typography>
                  <Typography color="textSecondary" variant="h6" fontWeight={400}>
                    Designer
                  </Typography>
                </Box>
              </Box>
            </Box>
          </Grid>
          {/* friends following buttons */}
          <Grid
            item
            lg={4}
            sm={12}
            xs={12}
            sx={{
              order: {
                xs: '3',
                sm: '3',
                lg: '3',
              },
            }}
          >
            <Stack direction={'row'} gap={2} alignItems="center" justifyContent="center" my={2}>
              <Fab size="small" color="primary" sx={{ backgroundColor: '#1877F2' }}>
                <IconBrandFacebook size="16" />
              </Fab>
              <Fab size="small" color="primary" sx={{ backgroundColor: '#1DA1F2' }}>
                <IconBrandTwitter size="18" />
              </Fab>
              <Fab size="small" color="error" sx={{ backgroundColor: '#EA4C89' }}>
                <IconBrandDribbble size="18" />
              </Fab>
              <Fab size="small" color="error" sx={{ backgroundColor: '#CD201F' }}>
                <IconBrandYoutube size="18" />
              </Fab>
              <Button color="primary" variant="contained">
                Add To Story
              </Button>
            </Stack>
          </Grid>
        </Grid>
        {/**TabbingPart**/}
        <ProfileTab />
      </BlankCard>
    </>
  );
};

export default ProfileBanner;
