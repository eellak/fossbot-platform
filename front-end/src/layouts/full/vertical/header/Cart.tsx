// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import React from 'react';

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { IconShoppingCart } from '@tabler/icons-react';
import { Box, Badge, IconButton } from '@mui/material';

const Cart = () => {
  return (
    <Box>
      <IconButton
        size="large"
        color="inherit"
        sx={{
          color: 'text.secondary',
        }}
      >
        <Badge color="error" badgeContent={0}>
          <IconShoppingCart size="21" stroke="1.5" />
        </Badge>
      </IconButton>
    </Box>
  );
};

export default Cart;
