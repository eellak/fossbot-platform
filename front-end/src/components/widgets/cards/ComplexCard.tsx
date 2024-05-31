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
  Skeleton,
  Card
} from '@mui/material';
import { IconMessage2, IconEye, IconPoint, IconPlus } from '@tabler/icons-react';
import user1 from 'src/assets/images/profile/user-1.jpg';
import user2 from 'src/assets/images/profile/user-2.jpg';
import user3 from 'src/assets/images/profile/user-3.jpg';
import img1 from 'src/assets/images/tutorials/python-logo.png';
import img2 from 'src/assets/images/tutorials/blockly-logo.png';
import img3 from 'src/assets/images/tutorials/kindergarten-logo.png';

import BlankCard from '../../shared/BlankCard';

interface cardType {
  avatar: string;
  coveravatar: string | null;
  title: string;
  category: string;
  link: string;
}

const complexCard: cardType[] = [
  {
    avatar: user1,
    coveravatar: img1,
    title: 'Tutorial for Monaco Editor with the use of Python',
    category: 'Coding Tutorials',
    link: '/monaco-tutorial-page',
  },
  {
    avatar: user2,
    coveravatar: img2,
    title: 'Tutorial for Blockly Editor with the use of programming blocks',
    category: 'Coding Tutorials',
    link: '/blockly-tutorial-page',
  },
  {
    avatar: user3,
    coveravatar: null,
    title: ' ',
    category: 'Robotics Tutorials',
    link: ' ',
  },
  {
    avatar: user3,
    coveravatar: null,
    title: ' ',
    category: 'Platform Tutorials',
    link: ' ',
  },
];

const categories = ['Coding Tutorials', 'Platform Tutorials', 'Robotics Tutorials'];

const ComplexCard = () => {
  const [isLoading, setLoading] = React.useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(false);
    }, 700);

    return () => clearTimeout(timer);
  }, []);

  return (
    <Box>
      {categories.map((category) => (
        <Box key={category} mb={5}>
          <Typography variant="h3" color={"primary"} gutterBottom>{category}</Typography>
          <Grid container spacing={3}>
            {complexCard.filter(card => card.category === category).map((author, index) => (
              <Grid item xs={12} sm={6} md={4} lg={3} xl={2.4} key={index}>
                <BlankCard className="hoverCard" sx={{ width: '100%', height: '400px', display: 'flex', flexDirection: 'column' }}>
                  <Link to={author.link} style={{ textDecoration: 'none', height: '100%', display: 'flex', flexDirection: 'column' }}>
                    {isLoading ? (
                      <Skeleton variant="rectangular" animation="wave" width="100%" height={'140px'} />
                    ) : (
                      author.coveravatar ? (
                        <Box sx={{ mt: 2 }}>
                        <CardMedia
                          component="img"
                          height="140"
                          image={author.coveravatar}
                          alt="Cover image"
                          sx={{ objectFit: 'contain' }}
                        />
                      </Box>
                      ) : (
                        <Box
                          sx={{
                            height: '140px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            mt: 2
                          }}
                        >
                          <Typography variant="h1" color="textSecondary">
                            ...
                          </Typography>
                        </Box>
                      )
                    )}
                    <CardContent sx={{ flexGrow: 1 }}>
                      {/* <Chip label={author.category} size="small" sx={{ marginTop: 2 }} /> */}
                      <Box my={3}>
                        <Typography
                          gutterBottom
                          variant="h5"
                          color="inherit"
                          component="div"
                          sx={{ fontSize: '1rem', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}
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
        </Box>
      ))}
    </Box>
  );
};

export default ComplexCard;
