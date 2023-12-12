// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import React from 'react';

import { Card, CardHeader, CardContent, Divider } from '@mui/material';

type Props = {
  title?: string;
  children: JSX.Element | JSX.Element[];
};

const ChildCard = ({ title, children }: Props) => (
  <Card sx={{ padding: 0, borderColor: (theme: any) => theme.palette.divider }} variant="outlined">
    {title ? (
      <>
        <CardHeader title={title} />
        <Divider />{' '}
      </>
    ) : (
      ''
    )}

    <CardContent>{children}</CardContent>
  </Card>
);

export default ChildCard;
