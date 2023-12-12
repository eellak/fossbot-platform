// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import React from 'react';
import { Box, Typography, Avatar, Stack, styled, Button } from '@mui/material';
import { NavLink } from 'react-router-dom';

import mainDemo from 'src/assets/images/landingpage/demos/demo-main.jpg';
import darkDemo from 'src/assets/images/landingpage/demos/demo-dark.jpg';
import horizontalDemo from 'src/assets/images/landingpage/demos/demo-horizontal.jpg';
import minisidebarDemo from 'src/assets/images/landingpage/demos/demo-firebase.jpg';
import rtlDemo from 'src/assets/images/landingpage/demos/demo-rtl.jpg';
import app1 from 'src/assets/images/landingpage/apps/app-calendar.jpg';
import app2 from 'src/assets/images/landingpage/apps/app-chat.jpg';
import app3 from 'src/assets/images/landingpage/apps/app-contact.jpg';
import app4 from 'src/assets/images/landingpage/apps/app-email.jpg';
import app5 from 'src/assets/images/landingpage/apps/app-note.jpg';

interface DemoTypes {
  link: string;
  img: string;
  title: string;
}

const demos: DemoTypes[] = [
  {
    link: 'https://modernize-react-main.netlify.app/dashboards/modern',
    img: mainDemo,
    title: 'Main',
  },
  {
    link: 'https://modernize-react-dark.netlify.app/dashboards/ecommerce',
    img: darkDemo,
    title: 'Dark',
  },
  {
    link: 'https://modernize-react-horizontal.netlify.app/dashboards/modern',
    img: horizontalDemo,
    title: 'Horizontal',
  },
  {
    link: 'https://modernize-react-firebase.netlify.app/auth/login',
    img: minisidebarDemo,
    title: 'Firebase',
  },
  {
    link: 'https://modernize-react-rtl.netlify.app/dashboards/modern',
    img: rtlDemo,
    title: 'RTL',
  },
];

const apps: DemoTypes[] = [
  {
    link: '/apps/calendar',
    img: app1,
    title: 'Calendar',
  },
  {
    link: '/apps/chats',
    img: app2,
    title: 'Chat',
  },
  {
    link: 'apps/contacts',
    img: app3,
    title: 'Contact',
  },
  {
    link: 'apps/email',
    img: app4,
    title: 'Email',
  },
  {
    link: '/apps/notes',
    img: app5,
    title: 'Note',
  },
];

const StyledBox = styled(Box)(() => ({
  overflow: 'auto',
  position: 'relative',
  '.MuiButton-root': {
    display: 'none',
  },
  '&:hover': {
    '.MuiButton-root': {
      display: 'block',
      transform: 'translate(-50%,-50%)',
      position: 'absolute',
      left: '50%',
      right: '50%',
      top: '50%',
      minWidth: '100px',
      zIndex: '9',
    },
    '&:before': {
      content: '""',
      position: 'absolute',
      top: '0',
      left: ' 0',
      width: '100%',
      height: '100%',
      zIndex: '8',
      backgroundColor: 'rgba(55,114,255,.2)',
    },
  },
}));

const DemosDD = () => {
  return (
    <>
      <Box p={4}>
        <Typography variant="h5">Different Demos</Typography>
        <Typography variant="subtitle1" color="textSecondary">
          Included with the package
        </Typography>

        <Stack mt={2} spacing={3} direction={{ xs: 'column', lg: 'row' }}>
          {demos.map((demo, index) => (
            <Box key={index}>
              {/* <Link href={demo.link}> */}
              <StyledBox>
                <Avatar
                  src={demo.img}
                  sx={{
                    borderRadius: '8px',
                    width: '100%',
                    height: '100%',
                  }}
                />
                <Button
                  variant="contained"
                  color="primary"
                  size="small"
                  href={demo.link}
                  target="_blank"
                >
                  Live Preview
                </Button>
              </StyledBox>
              {/* </Link> */}
              <Typography
                variant="body1"
                color="textPrimary"
                textAlign="center"
                fontWeight={500}
                mt={2}
              >
                {demo.title}
              </Typography>
            </Box>
          ))}
        </Stack>

        <Typography variant="h5" mt={5}>
          Different Apps
        </Typography>

        <Stack mt={2} spacing={3} mb={2} direction={{ xs: 'column', lg: 'row' }}>
          {apps.map((app, index) => (
            <Box key={index}>
              {/* <Link href={app.link}> */}
              <StyledBox>
                <Avatar
                  src={app.img}
                  sx={{
                    borderRadius: '8px',
                    width: '100%',
                    height: '100%',
                  }}
                />
                <NavLink to={app.link}>
                  <Button variant="contained" color="primary" size="small">
                    Live Preview
                  </Button>
                </NavLink>
                {/* </Link> */}
              </StyledBox>
              <Typography
                variant="body1"
                color="textPrimary"
                textAlign="center"
                fontWeight={500}
                mt={2}
              >
                {app.title}
              </Typography>
            </Box>
          ))}
        </Stack>
      </Box>
    </>
  );
};

export default DemosDD;
