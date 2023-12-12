// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import React from 'react';
import Chart from 'react-apexcharts';
import { useTheme } from '@mui/material/styles';
import { Stack, Typography, Avatar, Box } from '@mui/material';
import DashboardCard from '../../shared/DashboardCard';
import { IconGridDots } from '@tabler/icons-react';
import { Props } from 'react-apexcharts';

interface Stat {
  title: string;
  subtitle: string;
  percent: string;
  color: string;
  lightcolor: string;
  icon: JSX.Element;
}

const WeeklyStats: React.FC = () => {
  // chart color
  const theme = useTheme();
  const primary = theme.palette.primary.main;
  const primarylight = theme.palette.primary.light;
  const error = theme.palette.error.main;
  const errorlight = theme.palette.error.light;
  const secondary = theme.palette.success.main;
  const secondarylight = theme.palette.success.light;

  // chart
  const optionscolumnchart: Props = {
    chart: {
      type: 'area',
      fontFamily: "'Plus Jakarta Sans', sans-serif;",
      foreColor: '#adb0bb',
      toolbar: {
        show: false,
      },
      height: 130,
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
      type: 'gradient',
      gradient: {
        shadeIntensity: 0,
        inverseColors: false,
        opacityFrom: 0.45,
        opacityTo: 0,
        stops: [20, 180],
      },
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
      name: 'Weekly Stats',
      color: primary,
      data: [5, 15, 5, 10, 5],
    },
  ];

  const stats: Stat[] = [
    {
      title: 'Top Sales',
      subtitle: 'Johnathan Doe',
      percent: '68',
      color: primary,
      lightcolor: primarylight,
      icon: <IconGridDots width={18} />,
    },
    {
      title: 'Best Seller',
      subtitle: 'Footware',
      percent: '45',
      color: secondary,
      lightcolor: secondarylight,
      icon: <IconGridDots width={18} />,
    },
    {
      title: 'Most Commented',
      subtitle: 'Fashionware',
      percent: '14',
      color: error,
      lightcolor: errorlight,
      icon: <IconGridDots width={18} />,
    },
  ];

  return (
    <DashboardCard title="Weekly Stats" subtitle="Average sales">
      <>
        <Stack mt={4}>
          <Chart
            options={optionscolumnchart}
            series={seriescolumnchart}
            type="area"
            height="130px"
          />
        </Stack>
        <Stack spacing={3} mt={3}>
          {stats.map((stat, i) => (
            <Stack
              direction="row"
              spacing={2}
              justifyContent="space-between"
              alignItems="center"
              key={i}
            >
              <Stack direction="row" alignItems="center" spacing={2}>
                <Avatar
                  variant="rounded"
                  sx={{ bgcolor: stat.lightcolor, color: stat.color, width: 40, height: 40 }}
                >
                  {stat.icon}
                </Avatar>
                <Box>
                  <Typography variant="h6" mb="4px">
                    {stat.title}
                  </Typography>
                  <Typography variant="subtitle2" color="textSecondary">
                    {stat.subtitle}
                  </Typography>
                </Box>
              </Stack>
              <Avatar
                sx={{
                  bgcolor: stat.lightcolor,
                  color: stat.color,
                  width: 42,
                  height: 24,
                  borderRadius: '4px',
                }}
              >
                <Typography variant="subtitle2" fontWeight="600">
                  +{stat.percent}
                </Typography>
              </Avatar>
            </Stack>
          ))}
        </Stack>
      </>
    </DashboardCard>
  );
};

export default WeeklyStats;
