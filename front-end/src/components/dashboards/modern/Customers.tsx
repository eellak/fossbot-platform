// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import React from 'react';
import Chart from 'react-apexcharts';
import { useTheme } from '@mui/material/styles';
import { Stack, Typography, Avatar } from '@mui/material';
import { IconArrowDownRight } from '@tabler/icons-react';

import DashboardCard from '../../shared/DashboardCard';
import { Props } from 'react-apexcharts';

const Customers = () => {
  // chart color
  const theme = useTheme();
  const secondary = theme.palette.secondary.main;
  const secondarylight = theme.palette.secondary.light;
  const errorlight = theme.palette.error.light;

  // chart
  const optionscolumnchart: Props = {
    chart: {
      type: 'area',
      fontFamily: "'Plus Jakarta Sans', sans-serif;",
      foreColor: '#adb0bb',
      toolbar: {
        show: false,
      },
      height: 80,
      sparkline: {
        enabled: true,
      },
      group: 'sparklines',
    },
    stroke: {
      curve: 'smooth',
      width: 2,
    },
    fill: {
      colors: [secondarylight],
      type: 'solid',
      opacity: 0.05,
    },
    markers: {
      size: 0,
    },
    tooltip: {
      theme: theme.palette.mode === 'dark' ? 'dark' : 'light',
      x: {
        show: false,
      },
    },
  };
  const seriescolumnchart = [
    {
      name: '',
      color: secondary,
      data: [30, 25, 35, 20, 30, 40],
    },
  ];

  return (
    <DashboardCard
      footer={
        <>
          <Chart
            options={optionscolumnchart}
            series={seriescolumnchart}
            type="area"
            height="80px"
          />
        </>
      }
    >
      <>
        <Typography variant="subtitle2" color="textSecondary">
          Customers
        </Typography>
        <Typography variant="h4">36,358</Typography>
        <Stack direction="row" spacing={1} mt={1} alignItems="center">
          <Avatar sx={{ bgcolor: errorlight, width: 24, height: 24 }}>
            <IconArrowDownRight width={18} color="#FA896B" />
          </Avatar>
          <Typography variant="subtitle2" fontWeight="600">
            +9%
          </Typography>
        </Stack>
      </>
    </DashboardCard>
  );
};

export default Customers;
