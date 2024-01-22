import React from 'react';
import { CardContent, Typography, Button, Avatar, Badge, Box, Stack } from '@mui/material';
import userBg from 'src/assets/images/dashboard/socked.jpeg';
import BlankCard from '../../shared/BlankCard';

const Banner3 = ( { onDelete, onCancel } ) => {
  return (
    <BlankCard>
      <CardContent sx={{ p: '30px' }}>
        <Typography variant="h5" textAlign="center" mb={3}>
          You tried to delete your project?
        </Typography>
        <Box textAlign="center">
          <Badge overlap="circular">
            <Avatar src={userBg} alt="userBg" sx={{ width: 140, height: 140 }} />
          </Badge>

          <Typography variant="h5" mt={3}>
            Are you sure?
          </Typography>
          <br></br>

          <Stack direction="row" spacing={2} justifyContent="center">
            <Button color="error" variant="contained" size="large" onClick={onDelete}>
              Delete
            </Button>
            <Button color="secondary" variant="outlined" size="large" onClick={onCancel}>
              Cancel
            </Button>
          </Stack>
        </Box>
      </CardContent>
    </BlankCard>
  );
};

export default Banner3;
