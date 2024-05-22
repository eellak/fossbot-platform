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
  link: string;
}

const complexCard: cardType[] = [
  {
    avatar: user1,
    coveravatar: img1,
    title: 'Tutorial for Monaco Editor with the use of Python',
    category: 'Educational',
    link: '/monaco-tutorial-page',
  },
  {
    avatar: user2,
    coveravatar: img2,
    title: 'Tutorial for Blockly Editor with the use of programming blocks',
    category: 'Educational',
    link: '/blockly-tutorial-page',
  },
  {
    avatar: user3,
    coveravatar: img3,
    title: 'Tutorial for Kindergarten mode with a simpler blockly environment',
    category: 'Educational',
    link: '/kindergarten-tutorial-page',
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
              <Link to={author.link} style={{ textDecoration: 'none' }}>
                {isLoading ? (
                  <Skeleton variant="rectangular" animation="wave" width="100%" height={240} />
                ) : (
                  <CardMedia
                    component="img"
                    height="240"
                    image={author.coveravatar}
                    alt="Cover image"
                  />
                )}
                <CardContent>
                  <Chip label={author.category} size="small" sx={{ marginTop: 2 }} />
                  <Box my={3}>
                    <Typography
                      gutterBottom
                      variant="h5"
                      color="inherit"
                      component="div"
                    >
                      {author.title}
                    </Typography>
                  </Box>
                </CardContent>
              </Link>
            </BlankCard>
        </Grid>
      ))}
    </Grid>
  );
};

export default ComplexCard;
