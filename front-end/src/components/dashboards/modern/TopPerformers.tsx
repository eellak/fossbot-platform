// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import React from 'react';
import DashboardCard from '../../shared/DashboardCard';
import CustomSelect from '../../forms/theme-elements/CustomSelect';
import {
  MenuItem,
  Typography,
  Box,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Avatar,
  Chip,
  TableContainer,
  Stack,
} from '@mui/material';
import TopPerformerData from './TopPerformerData';

const performers = TopPerformerData;

const TopPerformers = () => {
  // for select
  const [month, setMonth] = React.useState('1');

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setMonth(event.target.value);
  };

  return (
    <DashboardCard
      title="Top Projects"
      subtitle="Best Products"
      action={
        <CustomSelect
          labelId="month-dd"
          id="month-dd"
          size="small"
          value={month}
          onChange={handleChange}
        >
          <MenuItem value={1}>March 2023</MenuItem>
          <MenuItem value={2}>April 2023</MenuItem>
          <MenuItem value={3}>May 2023</MenuItem>
        </CustomSelect>
      }
    >
      <TableContainer>
        <Table
          aria-label="simple table"
          sx={{
            whiteSpace: 'nowrap',
          }}
        >
          <TableHead>
            <TableRow>
              <TableCell>
                <Typography variant="subtitle2" fontWeight={600}>
                  Assigned
                </Typography>
              </TableCell>
              <TableCell>
                <Typography variant="subtitle2" fontWeight={600}>
                  Project
                </Typography>
              </TableCell>
              <TableCell>
                <Typography variant="subtitle2" fontWeight={600}>
                  Priority
                </Typography>
              </TableCell>
              <TableCell>
                <Typography variant="subtitle2" fontWeight={600}>
                  Budget
                </Typography>
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {performers.map((basic) => (
              <TableRow key={basic.id}>
                <TableCell>
                  <Stack direction="row" spacing={2}>
                    <Avatar src={basic.imgsrc} alt={basic.imgsrc} sx={{ width: 40, height: 40 }} />
                    <Box>
                      <Typography variant="subtitle2" fontWeight={600}>
                        {basic.name}
                      </Typography>
                      <Typography color="textSecondary" fontSize="12px" variant="subtitle2">
                        {basic.post}
                      </Typography>
                    </Box>
                  </Stack>
                </TableCell>
                <TableCell>
                  <Typography color="textSecondary" variant="subtitle2" fontWeight={400}>
                    {basic.pname}
                  </Typography>
                </TableCell>
                <TableCell>
                  {/* <Chip chipcolor={basic.status == 'Active' ? 'success' : basic.status == 'Pending' ? 'warning' : basic.status == 'Completed' ? 'primary' : basic.status == 'Cancel' ? 'error' : 'secondary'} */}
                  <Chip
                    sx={{
                      bgcolor:
                        basic.status === 'High'
                          ? (theme) => theme.palette.error.light
                          : basic.status === 'Medium'
                          ? (theme) => theme.palette.warning.light
                          : basic.status === 'Low'
                          ? (theme) => theme.palette.success.light
                          : (theme) => theme.palette.secondary.light,
                      color:
                        basic.status === 'High'
                          ? (theme) => theme.palette.error.main
                          : basic.status === 'Medium'
                          ? (theme) => theme.palette.warning.main
                          : basic.status === 'Low'
                          ? (theme) => theme.palette.success.main
                          : (theme) => theme.palette.secondary.main,
                      borderRadius: '8px',
                    }}
                    size="small"
                    label={basic.status}
                  />
                </TableCell>
                <TableCell>
                  <Typography variant="subtitle2">${basic.budget}k</Typography>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </DashboardCard>
  );
};

export default TopPerformers;
