import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  CardContent,
  Typography,
  Avatar,
  Grid,
  CardMedia,
  Stack,
  Tooltip,
  Chip,
  Box,
  Skeleton
} from '@mui/material';
import { IconMessage2, IconEye, IconPoint } from '@tabler/icons-react';
import user1 from 'src/assets/images/profile/user-1.jpg';
import user2 from 'src/assets/images/profile/user-2.jpg';
import user3 from 'src/assets/images/profile/user-3.jpg';
import img1 from 'src/assets/images/tutorials/python-logo.png';
import img2 from 'src/assets/images/tutorials/blockly-logo.png';
import img3 from 'src/assets/images/tutorials/kindergarten-logo.png';

import BlankCard from '../../shared/BlankCard';

interface cardType {
  avatar: string;
  coveravatar: string;
  title: string;
  category: string;
//   name: string;
//   view: string;
//   comments: string;
//   time: string;
}

const complexCard: cardType[] = [
  {
    avatar: user1,
    coveravatar: img1,
    title: 'Tutorial for Monaco Editor with the use of Python',
    category: 'Educational',
    // name: 'Georgeanna Ramero',
    // view: '9,125',
    // comments: '3',
    // time: 'Mon, Dec 19',
  },
  {
    avatar: user2,
    coveravatar: img2,
    title: 'Tutorial for Blockly Editor with the use of programming blocks',
    category: 'Educational',
    // name: 'Georgeanna Ramero',
    // view: '4,150',
    // comments: '38',
    // time: 'Sun, Dec 18',
  },
  {
    avatar: user3,
    coveravatar: img3,
    title: 'Tutorial for Kindergarten mode with a simpler blockly environment',
    category: 'Educational',
    // name: 'Georgeanna Ramero',
    // view: '9,480',
    // comments: '12',
    // time: 'Sat, Dec 17',
  },
];

const ComplexCard = () => {
  const [isLoading, setLoading] = React.useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(false);
    }, 700);

    return () => clearTimeout(timer);
  }, []);

  return (
    <Grid container spacing={3}>
      {complexCard.map((author, index) => (
        <Grid item xs={12} sm={4} key={index}>
          <BlankCard className="hoverCard">
            <>
              <Typography component={Link} to="/monaco-page">
                {isLoading ? (
                  <Skeleton variant="rectangular" animation="wave" width="100%" height={240}></Skeleton>
                ) : (
                  <CardMedia
                    component="img"
                    height="240"
                    image={author.coveravatar}
                    alt="green iguana"
                  />
                )}
              </Typography>
              <CardContent>
                {/* <Stack direction="row" sx={{ marginTop: '-45px' }}>
                  <Tooltip title={author.name} placement="top">
                    <Avatar aria-label="recipe" src={author.avatar}></Avatar>
                  </Tooltip>
                  <Chip
                    sx={{ marginLeft: 'auto', marginTop: '-21px', backgroundColor: 'white' }}
                    label="2 min Read"
                    size="small"
                  ></Chip>
                </Stack> */}
                <Chip label={author.category} size="small" sx={{ marginTop: 2 }}></Chip>
                <Box my={3}>
                  <Typography
                    gutterBottom
                    variant="h5"
                    color="inherit"
                    sx={{ textDecoration: 'none' }}
                    component={Link}
                    to="/monaco-page"
                  >
                    {author.title}
                  </Typography>
                </Box>
                {/* <Stack direction="row" gap={3} alignItems="center">
                  <Stack direction="row" gap={1} alignItems="center">
                    <IconEye size="18" /> {author.view}
                  </Stack>
                  <Stack direction="row" gap={1} alignItems="center">
                    <IconMessage2 size="18" /> {author.comments}
                  </Stack>

                  <Stack direction="row" ml="auto" alignItems="center">
                    <IconPoint size="16" />
                    <small>{author.time}</small>
                  </Stack>
                </Stack> */}
              </CardContent>
            </>
          </BlankCard>
        </Grid>
      ))}
    </Grid>
  );
};

export default ComplexCard;