import React from 'react';
import { Stack, Typography } from '@mui/material';

import ChildCard from 'src/components/shared/ChildCard';
import { IconBriefcase, IconDeviceDesktop, IconMail, IconMapPin } from '@tabler/icons-react';

const IntroCard = () => (
  <ChildCard>
    <Typography fontWeight={600} variant="h4" mb={2}>
      Introduction
    </Typography>
    <Typography color="textSecondary" variant="subtitle2" mb={2}>
      Hello, I am Julia Roberts. I love making websites and graphics. Lorem ipsum dolor sit amet,
      consectetur adipiscing elit.
    </Typography>
    <Stack direction="row" gap={2} alignItems="center" mb={3}>
      <IconBriefcase size="21" />
      <Typography variant="h6">Sir, P P Institute Of Science</Typography>
    </Stack>
    <Stack direction="row" gap={2} alignItems="center" mb={3}>
      <IconMail size="21" />
      <Typography variant="h6">xyzjonathan@gmail.com</Typography>
    </Stack>
    <Stack direction="row" gap={2} alignItems="center" mb={3}>
      <IconDeviceDesktop size="21" />
      <Typography variant="h6">www.xyz.com</Typography>
    </Stack>
    <Stack direction="row" gap={2} alignItems="center" mb={1}>
      <IconMapPin size="21" />
      <Typography variant="h6">Newyork, USA - 100001</Typography>
    </Stack>
  </ChildCard>
);

export default IntroCard;
