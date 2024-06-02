import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useDispatch } from 'src/store/Store';
import {
  Stack,
  Typography,
  CardMedia,
  Grid,
  Skeleton,
  Box
} from '@mui/material';
import BlankCard from 'src/components/shared/BlankCard';

interface LargeCardProps {
  post: {
    coverImg: string;
    title: string;   
  };
  index?: number;
}

const LargeCard: React.FC<LargeCardProps> = ({ post }) => {
  const { coverImg, title} = post;
  const linkTo = title
    .toLowerCase()
    .replace(/ /g, '-')
    .replace(/[^\w-]+/g, '');

  // skeleton
  const [isLoading, setLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(false);
    }, 700);

    return () => clearTimeout(timer);
  }, []);

  return (
    <Grid item xs={12} lg={12} md={12} sm={12} display="flex" alignItems="stretch">
      {isLoading ? (
        <Skeleton
          animation="wave"
          variant="rectangular"
          width="100%"
          height={300}
          sx={{ borderRadius: (theme) => theme.shape.borderRadius / 5 }}
        />
      ) : (
        <BlankCard className="hoverCard" sx={{ position: 'relative', height: 100 }}>
          {/* <Link to={`/apps/blog/detail/${linkTo}`}> */}
            <CardMedia component="img" height={300} image={coverImg} alt={title} />
            <Box
              sx={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                backgroundColor: 'rgba(0, 0, 0, 0.3)',
              }}
            />
            <Box
              sx={{
                position: 'absolute',
                top: '5%',
                left: '5%',
                transform: 'translate(-5%, -5%)',

              }}
            >
              <Typography variant="h3" align="center" color={'white'}>
                New Simulator Stages
              </Typography>
            </Box>
            <Box
              sx={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                padding: '8px 16px',
                borderRadius: '8px'
              }}
            >
              {/* <Typography variant="h2" align="center" color={'black'}>
                {title}
              </Typography> */}
            </Box>
          {/* </Link> */}
        </BlankCard>
      )}
    </Grid>
  );
};

export default LargeCard;
