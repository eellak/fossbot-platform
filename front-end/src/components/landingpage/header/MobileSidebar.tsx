import React, { useState } from 'react';
import Logo from 'src/layouts/full/shared/logo/Logo';
import DemosDD from './DemosDD';
import AppLinks from 'src/layouts/full/vertical/header/AppLinks';
import QuickLinks from 'src/layouts/full/vertical/header/QuickLinks';
import { Button, Box, Collapse, Stack } from '@mui/material';
import { IconChevronDown } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';

const MobileSidebar = () => {
  const { t } = useTranslation();

  const [toggle, setToggle] = useState(false);
  const [toggle2, setToggle2] = useState(false);

  return (
    <>
      <Box px={3}>
        <Logo />
      </Box>
      <Box p={3}>
        <Stack direction="column" spacing={2}>
          <Button
            color="inherit"
            onClick={() => setToggle(!toggle)}
            endIcon={<IconChevronDown width={20} />}
            sx={{
              justifyContent: 'space-between',
            }}
          >
            {t('demos')}
          </Button>
          {toggle && (
            <Collapse in={toggle}>
              <Box m="-21px">
                <Box ml={1}>
                  <DemosDD />
                </Box>
              </Box>
            </Collapse>
          )}

          <Button
            color="inherit"
            onClick={() => setToggle2(!toggle2)}
            endIcon={<IconChevronDown width={20} />}
            sx={{
              justifyContent: 'space-between',
            }}
          >
            {t('pages')}
          </Button>
          {toggle2 && (
            <Collapse in={toggle2}>
              <Box overflow="hidden" ml={1}>
                <AppLinks />
                <QuickLinks />
              </Box>
            </Collapse>
          )}
          <Button
            color="inherit"
            href="#"
            sx={{
              justifyContent: 'start',
            }}
          >
            {t('documentation')}
          </Button>
          <Button
            color="inherit"
            href="https://adminmart.com/support"
            sx={{
              justifyContent: 'start',
            }}
          >
            {t('support')}
          </Button>
          <Button color="primary" variant="contained" href="#">
            {t('login')}
          </Button>
        </Stack>
      </Box>
    </>
  );
};

export default MobileSidebar;
