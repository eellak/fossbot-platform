import { useEffect, useState } from 'react';
import { Box } from '@mui/material';

const WebGLApp = () => {
  // const [isScriptLoaded, setIsScriptLoaded] = useState(false);

  // useEffect(() => {
  //   if (!window.myWebGLAppScriptLoaded) {
  //     const script = document.createElement('script');
  //     script.src = 'src/components/websimulator/index.js';
  //     script.async = true;
  //     script.onload = () => {
  //       window.myWebGLAppScriptLoaded = true;
  //       setIsScriptLoaded(true);
  //     };
  //     document.body.appendChild(script);
  //   } else {
  //     setIsScriptLoaded(true);
  //   }

  //   return () => {
  //     // Cleanup logic if necessary
  //   };
  // }, []);

  return (
    <Box width={'100%'}>
       <iframe
                src="http://localhost:5000"
                width={"100%"}
                height={"370px"}
                frameBorder="0"
                allowFullScreen
            ></iframe>
      {/* {isScriptLoaded && (
        <canvas id='canvas' style={{ display: 'block', width: '100%', position: 'relative' }}>
          HTML5 canvas appears to be unsupported in the current browser.<br />
          Please try updating or use a different browser.
        </canvas>
      )}
      Status elements */}
    </Box>
  );
};

export default WebGLApp;
