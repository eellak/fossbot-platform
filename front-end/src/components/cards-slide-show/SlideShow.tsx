import React, { useState, useEffect } from 'react';
import { Grid } from '@mui/material';
import LargeCard from './LargeCard';


const posts = [
  {
    coverImg: '/js-simulator/stages/stage_object.png',
    title: 'Objects on the floor',
    link: '#',
  },
  {
    coverImg: '/js-simulator/stages/stage_maze.png',
    title: 'The Maze',
    link: '#',
  },
  {
    coverImg: '/js-simulator/stages/stage_tiles.png',
    title: 'Colors on the floor',
    link: '#',    
  },
  {
    coverImg: '/js-simulator/stages/white_tiles.png',
    title: 'White Tiles',
    link: '#',  
  }
];

const SlideShow: React.FC = () => {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIndex((prevIndex) => (prevIndex + 1) % posts.length);
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  return (
    <Grid container spacing={3}>
      <LargeCard post={posts[currentIndex]} />
    </Grid>
  );
};

export default SlideShow;
