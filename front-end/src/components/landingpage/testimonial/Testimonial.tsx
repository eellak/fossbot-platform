// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import React from 'react';
import { Avatar, Box, CardContent, Container, Typography, Rating, Stack } from '@mui/material';
import TestimonialTitle from './TestimonialTitle';
import BlankCard from '../../shared/BlankCard';
import img1 from 'src/assets/images/profile/user-1.jpg';
import img2 from 'src/assets/images/profile/user-2.jpg';
import img3 from 'src/assets/images/profile/user-3.jpg';
import AnimationFadeIn from '../animation/Animation';

//Carousel slider for product
import Slider from 'react-slick';
import 'slick-carousel/slick/slick.css';
import 'slick-carousel/slick/slick-theme.css';
import './testimonial.css';

interface SliderType {
  title: string;
  subtitle: string;
  avatar: string;
  subtext: string;
}

const SliderData: SliderType[] = [
  {
    title: 'Jenny Wilson',
    subtitle: 'Features avaibility',
    avatar: img1,
    subtext:
      'The dashboard template from adminmart has helped me provide a clean and sleek look to my dashboard and made it look exactly the way I wanted it to, mainly without having.',
  },
  {
    title: 'Minshan Cui',
    subtitle: 'Features avaibility',
    avatar: img2,
    subtext:
      'The quality of design is excellent, customizability and flexibility much better than the other products available in the market.I strongly recommend the AdminMart to other.',
  },
  {
    title: 'Eminson Mendoza',
    subtitle: 'Features avaibility',
    avatar: img3,
    subtext:
      'This template is great, UI-rich and up-to-date. Although it is pretty much complete, I suggest to improve a bit of documentation. Thanks & Highly recomended!',
  },
  {
    title: 'Jenny Wilson',
    subtitle: 'Features avaibility',
    avatar: img1,
    subtext:
      'The dashboard template from adminmart has helped me provide a clean and sleek look to my dashboard and made it look exactly the way I wanted it to, mainly without having.',
  },
  {
    title: 'Minshan Cui',
    subtitle: 'Features avaibility',
    avatar: img2,
    subtext:
      'The quality of design is excellent, customizability and flexibility much better than the other products available in the market.I strongly recommend the AdminMart to other.',
  },
  {
    title: 'Eminson Mendoza',
    subtitle: 'Features avaibility',
    avatar: img3,
    subtext:
      'This template is great, UI-rich and up-to-date. Although it is pretty much complete, I suggest to improve a bit of documentation. Thanks & Highly recomended!',
  },
];

const Testimonial = () => {
  const [value, setValue] = React.useState<number | null>(5);

  const settings = {
    className: 'testimonial-slider',
    dots: true,
    arrows: false,
    infinite: true,
    speed: 500,
    slidesToShow: 3,
    slidesToScroll: 1,
    responsive: [
      {
        breakpoint: 1024,
        settings: {
          slidesToShow: 3,
        },
      },
      {
        breakpoint: 768,
        settings: {
          slidesToShow: 2,
        },
      },
      {
        breakpoint: 600,
        settings: {
          slidesToShow: 2,
        },
      },
      {
        breakpoint: 480,
        settings: {
          slidesToShow: 1,
        },
      },
    ],
  };

  return (
    <Box pt={14} pb={11}>
      <Container maxWidth="lg">
        <TestimonialTitle />
        <Box mt={5}>
          <AnimationFadeIn>
            <Slider {...settings}>
              {SliderData.map((slider, index) => (
                <Box p="15px" key={index}>
                  <BlankCard>
                    <CardContent>
                      <Stack direction="row">
                        <Avatar src={slider.avatar} alt="user" sx={{ width: 40, height: 40 }} />
                        <Box ml={2}>
                          <Typography variant="h6">{slider.title}</Typography>
                          <Typography color="textSecondary" variant="subtitle1">
                            {slider.subtitle}
                          </Typography>
                        </Box>
                        <Box ml="auto">
                          <Rating
                            size="small"
                            name="simple-controlled"
                            value={value}
                            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                            // @ts-ignore
                            onChange={(event, newValue) => {
                              setValue(newValue);
                            }}
                          />
                        </Box>
                      </Stack>
                      <Typography fontSize="15px" color="textSecondary" mt={3}>
                        {slider.subtext}
                      </Typography>
                    </CardContent>
                  </BlankCard>
                </Box>
              ))}
            </Slider>
          </AnimationFadeIn>
        </Box>
      </Container>
    </Box>
  );
};

export default Testimonial;
