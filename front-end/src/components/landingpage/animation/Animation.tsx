// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import React, { useEffect } from 'react';

// third party
import { useInView } from 'react-intersection-observer';
import { motion, useAnimation } from 'framer-motion';

function AnimateFadeIn({ children }: { children: React.ReactElement }) {
  const controls = useAnimation();
  const [ref, inView] = useInView();

  useEffect(() => {
    if (inView) {
      controls.start('visible');
    }
  }, [controls, inView]);

  return (
    <motion.div
      ref={ref}
      animate={controls}
      initial="hidden"
      transition={{ duration: 0.3 }}
      variants={{
        visible: { opacity: 1, translateY: 0 },
        hidden: { opacity: 0, translateY: 275 },
      }}
    >
      {children}
    </motion.div>
  );
}

export default AnimateFadeIn;
